"""
Utilidad para registrar servidores en el cliente
Cuando un servidor se agrega al sistema, se registra automáticamente en el cliente
para que pueda ser usado en autenticación NSS/PAM
"""
import httpx
from typing import Optional


async def register_server_in_client(
    client_url: str,
    server_id: int,
    name: str,
    ip_address: str,
    ssh_port: int = 22,
    ssh_user: str = "root",
    description: Optional[str] = None
) -> bool:
    """
    Registra un servidor en el cliente para NSS/PAM
    
    Args:
        client_url: URL del cliente (ej: http://client:8100)
        server_id: ID del servidor en la base de datos
        name: Nombre del servidor
        ip_address: Dirección IP del servidor
        ssh_port: Puerto SSH del servidor (default 22)
        ssh_user: Usuario SSH (default root)
        description: Descripción opcional del servidor
    
    Returns:
        True si el registro fue exitoso, False en caso contrario
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{client_url}/api/server-config/register",
                json={
                    "server_id": server_id,
                    "name": name,
                    "ip_address": ip_address,
                    "ssh_port": ssh_port,
                    "ssh_user": ssh_user,
                    "description": description
                }
            )
            
            if response.status_code == 200:
                print(f"✓ Server {name} registered in client successfully")
                return True
            else:
                print(f"✗ Failed to register server {name} in client: {response.status_code}")
                return False
                
    except Exception as e:
        print(f"✗ Error registering server {name} in client: {e}")
        return False


async def unregister_server_from_client(client_url: str, server_id: int) -> bool:
    """
    Elimina un servidor del cliente
    
    Args:
        client_url: URL del cliente (ej: http://client:8100)
        server_id: ID del servidor en la base de datos
    
    Returns:
        True si la eliminación fue exitosa, False en caso contrario
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(
                f"{client_url}/api/server-config/servers/{server_id}"
            )
            
            if response.status_code == 200:
                print(f"✓ Server {server_id} unregistered from client successfully")
                return True
            else:
                print(f"✗ Failed to unregister server {server_id} from client: {response.status_code}")
                return False
                
    except Exception as e:
        print(f"✗ Error unregistering server {server_id} from client: {e}")
        return False
