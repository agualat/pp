"""
Utilidades para sincronizar usuarios con todos los clientes registrados
"""
from sqlalchemy.orm import Session
from typing import List
import httpx
import asyncio
import logging
from ..models.models import User, Server
from ..CRUD.servers import get_all_servers
from ..CRUD.users import get_all_users

logger = logging.getLogger(__name__)


async def sync_users_to_client(client_url: str, users_data: List[dict], server_name: str = "Unknown") -> dict:
    """
    Envía la lista de usuarios a un cliente específico
    
    Args:
        client_url: URL base del cliente (http://ip:puerto)
        users_data: Lista de usuarios serializados
        server_name: Nombre del servidor para logging
    
    Returns:
        dict con el resultado de la sincronización
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{client_url}/api/sync/users",
                json=users_data
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"✅ Users synced to '{server_name}' ({client_url}): {result.get('users_synced', 0)} users")
            return {
                "success": True,
                "client": client_url,
                "server_name": server_name,
                "response": result
            }
    except Exception as e:
        logger.error(f"❌ Failed to sync users to '{server_name}' ({client_url}): {str(e)}")
        return {
            "success": False,
            "client": client_url,
            "server_name": server_name,
            "error": str(e)
        }


async def sync_users_to_all_clients(db: Session) -> dict:
    """
    Sincroniza todos los usuarios con todos los clientes registrados
    
    Args:
        db: Sesión de base de datos
    
    Returns:
        dict con el resumen de la sincronización
    """
    # Obtener todos los usuarios de la base de datos central
    users = get_all_users(db)
    
    # Serializar usuarios
    users_data = [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "password_hash": user.password_hash,
            "is_admin": user.is_admin,
            "is_active": user.is_active,
            "system_uid": user.system_uid,
            "system_gid": user.system_gid,
            "ssh_public_key": user.ssh_public_key,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
        for user in users
    ]
    
    # Obtener todos los servidores/clientes registrados que estén online
    servers = get_all_servers(db, check_status=False)  # No verificar estado para ser más rápido
    online_servers = [s for s in servers if s.status == "online"]
    
    if not online_servers:
        logger.info("ℹ️  No online clients to sync")
        return {
            "success": True,
            "message": "No online clients to sync",
            "clients_synced": 0,
            "clients_failed": 0,
            "results": []
        }
    
    logger.info(f"🔄 Starting user sync: {len(users)} users to {len(online_servers)} online clients")
    
    # Crear tareas asíncronas para sincronizar con todos los clientes
    # Asumimos que los clientes corren en el puerto 8100 (configurable)
    tasks = []
    for server in online_servers:
        client_url = f"http://{server.ip_address}:8100"
        tasks.append(sync_users_to_client(client_url, users_data, server.name))
    
    # Ejecutar todas las sincronizaciones en paralelo
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Contar éxitos y fallos
    successful = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
    failed = len(results) - successful
    
    # Obtener nombres de servidores sincronizados
    synced_servers = [r.get("server_name", "Unknown") for r in results if isinstance(r, dict) and r.get("success")]
    failed_servers = [r.get("server_name", "Unknown") for r in results if isinstance(r, dict) and not r.get("success")]
    
    if successful > 0:
        logger.info(f"✅ Sync completed: {len(users)} users synced to {successful}/{len(online_servers)} clients")
        logger.info(f"   Synced to: {', '.join(synced_servers)}")
    
    if failed > 0:
        logger.warning(f"⚠️  Failed to sync to {failed} clients: {', '.join(failed_servers)}")
    
    return {
        "success": True,
        "message": f"Synced {len(users)} users to {successful}/{len(online_servers)} clients",
        "users_count": len(users),
        "clients_synced": successful,
        "clients_failed": failed,
        "synced_servers": synced_servers,
        "failed_servers": failed_servers,
        "results": results
    }


def sync_users_to_all_clients_sync(db: Session) -> dict:
    """
    Versión síncrona de sync_users_to_all_clients para usar en contextos síncronos
    """
    return asyncio.run(sync_users_to_all_clients(db))
