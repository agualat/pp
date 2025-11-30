"""
Gestor de configuraciones de servidores en el cliente
Guarda la información de servidores conectados en un archivo JSON local
"""
import json
import os
from typing import List, Optional, Dict
from pathlib import Path


CONFIG_FILE = "/app/client_data/servers_config.json"


def ensure_config_dir():
    """Crea el directorio de configuración si no existe"""
    config_dir = os.path.dirname(CONFIG_FILE)
    os.makedirs(config_dir, exist_ok=True)


def load_servers_config() -> Dict[str, dict]:
    """Carga la configuración de servidores desde el archivo JSON"""
    ensure_config_dir()
    
    if not os.path.exists(CONFIG_FILE):
        return {}
    
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading server config: {e}")
        return {}


def save_servers_config(config: Dict[str, dict]) -> bool:
    """Guarda la configuración de servidores en el archivo JSON"""
    ensure_config_dir()
    
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving server config: {e}")
        return False


def add_server_config(server_id: int, name: str, ip_address: str, 
                      ssh_port: int = 22, ssh_user: str = "root", 
                      description: Optional[str] = None) -> bool:
    """Agrega o actualiza la configuración de un servidor"""
    config = load_servers_config()
    
    config[str(server_id)] = {
        "server_id": server_id,
        "name": name,
        "ip_address": ip_address,
        "ssh_port": ssh_port,
        "ssh_user": ssh_user,
        "description": description
    }
    
    return save_servers_config(config)


def get_server_config(server_id: int) -> Optional[dict]:
    """Obtiene la configuración de un servidor específico"""
    config = load_servers_config()
    return config.get(str(server_id))


def get_all_servers_config() -> List[dict]:
    """Obtiene la configuración de todos los servidores"""
    config = load_servers_config()
    return list(config.values())


def remove_server_config(server_id: int) -> bool:
    """Elimina la configuración de un servidor"""
    config = load_servers_config()
    
    if str(server_id) in config:
        del config[str(server_id)]
        return save_servers_config(config)
    
    return False


def server_exists(server_id: int) -> bool:
    """Verifica si existe la configuración de un servidor"""
    config = load_servers_config()
    return str(server_id) in config


def get_server_by_ip(ip_address: str) -> Optional[dict]:
    """Busca un servidor por su dirección IP"""
    config = load_servers_config()
    
    for server in config.values():
        if server.get("ip_address") == ip_address:
            return server
    
    return None


def count_servers() -> int:
    """Cuenta el número total de servidores configurados"""
    config = load_servers_config()
    return len(config)
