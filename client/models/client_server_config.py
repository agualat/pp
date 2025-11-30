"""
Modelos para almacenar configuración de servidores conectados al cliente
Esto permite que el cliente sepa a qué servidores puede conectarse por SSH
"""
from pydantic import BaseModel
from typing import Optional


class ServerConfig(BaseModel):
    """Configuración de un servidor para almacenar en el cliente"""
    server_id: int
    name: str
    ip_address: str
    ssh_port: int = 22
    ssh_user: str = "root"
    description: Optional[str] = None


class ServerConfigResponse(BaseModel):
    """Respuesta al registrar/obtener configuración de servidor"""
    success: bool
    message: str
    server_id: Optional[int] = None
