"""
Utilidad para consultar el estado de contenedores en clientes remotos.

Este módulo proporciona funciones para:
- Obtener el estado actual de contenedores desde un cliente (consultando Docker directamente)
- Actualizar el estado en la BD central basado en el reporte del cliente
"""

import os
from typing import List, Optional

import httpx
from sqlalchemy.orm import Session

from server.models.models import Container, Server, User


def get_client_url(server: Server) -> str:
    """
    Obtiene la URL del cliente basado en la IP del servidor.

    Args:
        server: Objeto Server de la base de datos

    Returns:
        URL completa del cliente (ej: http://192.168.1.100:8100)
    """
    # Por defecto el cliente escucha en el puerto 8100
    client_port = os.getenv("CLIENT_PORT", "8100")
    return f"http://{server.ip_address}:{client_port}"


async def get_containers_status_from_client(server: Server, timeout: int = 10) -> dict:
    """
    Obtiene el estado actual de todos los contenedores desde un cliente.

    Este método consulta al cliente para obtener el estado real de los contenedores
    en su sistema Docker local mediante 'docker ps -a'.

    Args:
        server: Servidor del cual obtener el estado
        timeout: Timeout en segundos para la petición HTTP

    Returns:
        dict con la respuesta del cliente incluyendo lista de contenedores

    Raises:
        Exception: Si hay error en la comunicación
    """
    try:
        client_url = get_client_url(server)

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{client_url}/api/containers/report")
            response.raise_for_status()
            result = response.json()

        print(
            f"✅ Retrieved {result.get('containers_count', 0)} containers from {server.name}"
        )
        return result

    except httpx.ConnectError as e:
        error_msg = (
            f"Cannot connect to client on {server.name} ({server.ip_address}): {str(e)}"
        )
        print(f"❌ {error_msg}")
        raise Exception(error_msg)

    except httpx.TimeoutException as e:
        error_msg = f"Timeout connecting to client on {server.name}: {str(e)}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)

    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error from client on {server.name}: {e.response.status_code} - {e.response.text}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)

    except Exception as e:
        error_msg = f"Unexpected error getting status from {server.name}: {str(e)}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)


async def update_containers_status_from_client(db: Session, server: Server) -> dict:
    """
    Actualiza el estado de contenedores en la BD central basándose en el reporte del cliente.

    Este método:
    1. Obtiene el estado actual de contenedores desde el cliente (vía Docker)
    2. Actualiza el estado en la BD central para que coincida con la realidad
    3. Crea registros para contenedores que existen en Docker pero no en la BD
    4. Retorna estadísticas de la actualización

    Args:
        db: Sesión de base de datos
        server: Servidor del cual actualizar el estado

    Returns:
        dict con estadísticas de actualización
    """
    try:
        # Obtener estado desde el cliente
        client_report = await get_containers_status_from_client(server)
        containers_from_docker = client_report.get("containers", [])

        # Crear un mapa de nombre -> info del contenedor
        docker_containers_map = {c["name"]: c for c in containers_from_docker}

        # Obtener contenedores de este servidor en la BD central
        db_containers = (
            db.query(Container).filter(Container.server_id == server.id).all()
        )

        # Crear un mapa de nombre -> container de BD
        db_containers_map = {c.name: c for c in db_containers}

        updated_count = 0
        created_count = 0
        mismatches = []

        # 1. Actualizar contenedores existentes en la BD
        for db_container in db_containers:
            docker_info = docker_containers_map.get(db_container.name)

            if docker_info:
                # Contenedor existe en Docker, actualizar estado
                old_status = db_container.status
                new_status = docker_info["status"]
                new_container_id = docker_info["container_id"]

                if (
                    old_status != new_status
                    or db_container.container_id != new_container_id
                ):
                    db_container.status = new_status
                    db_container.container_id = new_container_id
                    updated_count += 1

                    mismatches.append(
                        {
                            "name": db_container.name,
                            "old_status": old_status,
                            "new_status": new_status,
                        }
                    )

                    print(
                        f"  📝 Updated {db_container.name}: {old_status} → {new_status}"
                    )
            else:
                # Contenedor no existe en Docker pero está en BD
                # Marcar como stopped si no lo está ya
                if db_container.status != "stopped":
                    db_container.status = "stopped"
                    db_container.container_id = None
                    updated_count += 1

                    mismatches.append(
                        {
                            "name": db_container.name,
                            "old_status": db_container.status,
                            "new_status": "stopped",
                            "note": "Container not found in Docker",
                        }
                    )

                    print(
                        f"  ⚠️ Container {db_container.name} not found in Docker, marked as stopped"
                    )

        # 2. Crear registros para contenedores que existen en Docker pero no en la BD
        for docker_name, docker_info in docker_containers_map.items():
            if docker_name not in db_containers_map:
                # Intentar detectar el propietario del contenedor
                detected_user_id = _detect_container_owner(db, docker_name)
                owner_note = ""

                if detected_user_id != 1:
                    owner_note = f" (owner detected from name)"
                else:
                    owner_note = " (assigned to admin - owner unknown)"

                # Este contenedor existe en Docker pero no en la BD, crearlo
                new_container = Container(
                    name=docker_name,
                    user_id=detected_user_id,
                    server_id=server.id,
                    image=docker_info.get("image", "unknown"),
                    ports=docker_info.get("ports", ""),
                    status=docker_info.get("status", "unknown"),
                    is_public=False,
                    container_id=docker_info.get("container_id"),
                )
                db.add(new_container)
                created_count += 1

                print(
                    f"  ✨ Created new container record: {docker_name} (status: {docker_info.get('status')}){owner_note}"
                )

                mismatches.append(
                    {
                        "name": docker_name,
                        "action": "created",
                        "status": docker_info.get("status"),
                        "user_id": detected_user_id,
                        "note": f"Container found in Docker but not in database{owner_note}",
                    }
                )

        # Commit cambios
        db.commit()

        result = {
            "success": True,
            "server_name": server.name,
            "containers_in_docker": len(containers_from_docker),
            "containers_in_db": len(db_containers),
            "updated_count": updated_count,
            "created_count": created_count,
            "mismatches": mismatches,
        }

        print(
            f"✅ Updated {updated_count} and created {created_count} container records for {server.name}"
        )
        return result

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to update container status from client: {str(e)}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)


async def sync_all_servers(db: Session) -> dict:
    """
    Actualiza el estado de contenedores desde todos los servidores activos.

    Args:
        db: Sesión de base de datos

    Returns:
        dict con estadísticas de sincronización
    """
    servers = db.query(Server).filter(Server.ssh_status == "deployed").all()

    results = {
        "total_servers": len(servers),
        "success": 0,
        "failed": 0,
        "errors": [],
        "updates": [],
    }

    for server in servers:
        try:
            update_result = await update_containers_status_from_client(db, server)
            results["success"] += 1
            results["updates"].append(update_result)
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({"server_name": server.name, "error": str(e)})

    return results


def _detect_container_owner(db: Session, container_name: str) -> int:
    """
    Intenta detectar el propietario de un contenedor basándose en su nombre.

    Patrones comunes:
    - colab_username
    - username_service
    - service_username

    Args:
        db: Sesión de base de datos
        container_name: Nombre del contenedor

    Returns:
        user_id detectado o 1 (admin) si no se puede detectar
    """
    # Patrones comunes de nombres de contenedor
    # Ejemplo: colab_jdoe, colab_msmith, etc.

    # Obtener todos los usuarios para hacer matching
    users = db.query(User).all()

    # Convertir nombre a minúsculas para comparación
    name_lower = container_name.lower()

    # Patrón 1: colab_username o similar_username
    if "_" in name_lower:
        parts = name_lower.split("_")
        # Buscar username en cualquier parte después del primer guión bajo
        for part in parts[1:]:  # Ignorar primera parte (colab, service, etc.)
            for user in users:
                if user.username.lower() == part:
                    print(
                        f"    🔍 Owner detected: {user.username} (from pattern prefix_username)"
                    )
                    return user.id

    # Patrón 2: username_service o username-service
    if "_" in name_lower or "-" in name_lower:
        separator = "_" if "_" in name_lower else "-"
        parts = name_lower.split(separator)
        # Buscar username en la primera parte
        first_part = parts[0]
        for user in users:
            if user.username.lower() == first_part:
                print(
                    f"    🔍 Owner detected: {user.username} (from pattern username_service)"
                )
                return user.id

    # Patrón 3: nombre contiene username completo
    for user in users:
        if user.username.lower() in name_lower:
            print(
                f"    🔍 Owner detected: {user.username} (username found in container name)"
            )
            return user.id

    # No se pudo detectar, asignar a admin
    print(f"    ⚠️ Could not detect owner for '{container_name}', assigning to admin")
    return 1  # admin por defecto
