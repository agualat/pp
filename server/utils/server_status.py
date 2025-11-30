import subprocess
import socket
from typing import Optional

def check_server_online(ip_address: str, timeout: int = 3) -> bool:
    """
    Verifica si un servidor está online usando ping.
    
    Args:
        ip_address: Dirección IP del servidor
        timeout: Timeout en segundos
        
    Returns:
        True si el servidor responde, False en caso contrario
    """
    try:
        # Intentar ping
        result = subprocess.run(
            ['ping', '-n', '1', '-w', str(timeout * 1000), ip_address],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout
        )
        return result.returncode == 0
    except Exception:
        return False

def check_port_open(ip_address: str, port: int = 22, timeout: int = 3) -> bool:
    """
    Verifica si un puerto está abierto en el servidor.
    
    Args:
        ip_address: Dirección IP del servidor
        port: Puerto a verificar (default 22 para SSH)
        timeout: Timeout en segundos
        
    Returns:
        True si el puerto está abierto, False en caso contrario
    """
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip_address, port))
        sock.close()
        return result == 0
    except Exception:
        return False

def get_server_status(ip_address: str) -> str:
    """
    Determina el estado real del servidor.
    
    Args:
        ip_address: Dirección IP del servidor
        
    Returns:
        "online" si el servidor responde, "offline" en caso contrario
    """
    # Primero intentar ping
    if check_server_online(ip_address):
        return "online"
    
    # Si ping falla, intentar conexión SSH
    if check_port_open(ip_address, 22):
        return "online"
    
    return "offline"
