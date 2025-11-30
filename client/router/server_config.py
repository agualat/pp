"""
Router para gestionar configuraciones de servidores en el cliente
"""
from fastapi import APIRouter, HTTPException
from ..models.client_server_config import ServerConfig, ServerConfigResponse
from ..utils.server_config_manager import (
    add_server_config,
    get_server_config,
    get_all_servers_config,
    remove_server_config,
    server_exists
)
from typing import List


router = APIRouter(prefix="/api/server-config", tags=["Server Configuration"])


@router.post("/register", response_model=ServerConfigResponse)
def register_server(server: ServerConfig):
    """
    Registra o actualiza la configuración de un servidor
    Este endpoint es llamado por el servidor central cuando conecta un nuevo servidor
    """
    try:
        success = add_server_config(
            server_id=server.server_id,
            name=server.name,
            ip_address=server.ip_address,
            ssh_port=server.ssh_port,
            ssh_user=server.ssh_user,
            description=server.description
        )
        
        if success:
            return ServerConfigResponse(
                success=True,
                message=f"Server {server.name} registered successfully",
                server_id=server.server_id
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to save server configuration")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/servers", response_model=List[ServerConfig])
def list_servers():
    """
    Lista todos los servidores configurados en el cliente
    """
    servers = get_all_servers_config()
    return servers


@router.get("/servers/{server_id}", response_model=ServerConfig)
def get_server(server_id: int):
    """
    Obtiene la configuración de un servidor específico
    """
    server = get_server_config(server_id)
    
    if not server:
        raise HTTPException(status_code=404, detail=f"Server {server_id} not found")
    
    return server


@router.delete("/servers/{server_id}", response_model=ServerConfigResponse)
def unregister_server(server_id: int):
    """
    Elimina la configuración de un servidor
    """
    if not server_exists(server_id):
        raise HTTPException(status_code=404, detail=f"Server {server_id} not found")
    
    success = remove_server_config(server_id)
    
    if success:
        return ServerConfigResponse(
            success=True,
            message=f"Server {server_id} unregistered successfully",
            server_id=server_id
        )
    else:
        raise HTTPException(status_code=500, detail="Failed to remove server configuration")


@router.get("/servers/{server_id}/exists")
def check_server_exists(server_id: int):
    """
    Verifica si existe la configuración de un servidor
    """
    return {"exists": server_exists(server_id)}
