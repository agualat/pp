from sqlalchemy.orm import Session
from ..models.models import Server, ServerCreate
from typing import List, Optional


# CREATE
def create_server(db: Session, server: ServerCreate) -> Server:
    """Crea un nuevo servidor en la base de datos"""
    db_server = Server(
        name=server.name,
        ip_address=server.ip_address,
        status="offline"
    )
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    return db_server


# READ
def get_server_by_id(db: Session, server_id: int) -> Optional[Server]:
    """Obtiene un servidor por su ID"""
    return db.query(Server).filter(Server.id == server_id).first()


def get_server_by_name(db: Session, name: str) -> Optional[Server]:
    """Obtiene un servidor por su nombre"""
    return db.query(Server).filter(Server.name == name).first()


def get_server_by_ip(db: Session, ip_address: str) -> Optional[Server]:
    """Obtiene un servidor por su dirección IP"""
    return db.query(Server).filter(Server.ip_address == ip_address).first()


def get_all_servers(db: Session, skip: int = 0, limit: int = 100) -> List[Server]:
    """Obtiene todos los servidores con paginación"""
    return db.query(Server).offset(skip).limit(limit).all()


def get_servers_by_status(db: Session, status: str) -> List[Server]:
    """Obtiene todos los servidores por estado (online/offline)"""
    return db.query(Server).filter(Server.status == status).all()


def get_online_servers(db: Session) -> List[Server]:
    """Obtiene todos los servidores online"""
    return get_servers_by_status(db, "online")


def get_offline_servers(db: Session) -> List[Server]:
    """Obtiene todos los servidores offline"""
    return get_servers_by_status(db, "offline")


def count_servers(db: Session) -> int:
    """Cuenta el total de servidores"""
    return db.query(Server).count()


def count_servers_by_status(db: Session, status: str) -> int:
    """Cuenta servidores por estado"""
    return db.query(Server).filter(Server.status == status).count()


# UPDATE
def update_server(db: Session, server_id: int, server_data: dict) -> Optional[Server]:
    """Actualiza los datos de un servidor"""
    db_server = get_server_by_id(db, server_id)
    if not db_server:
        return None
    
    # Actualizar los campos
    for key, value in server_data.items():
        if hasattr(db_server, key):
            setattr(db_server, key, value)
    
    db.commit()
    db.refresh(db_server)
    return db_server


def update_server_status(db: Session, server_id: int, status: str) -> Optional[Server]:
    """Actualiza solo el estado de un servidor"""
    db_server = get_server_by_id(db, server_id)
    if not db_server:
        return None
    
    db_server.status = status  # type: ignore
    db.commit()
    db.refresh(db_server)
    return db_server


def set_server_online(db: Session, server_id: int) -> Optional[Server]:
    """Marca un servidor como online"""
    return update_server_status(db, server_id, "online")


def set_server_offline(db: Session, server_id: int) -> Optional[Server]:
    """Marca un servidor como offline"""
    return update_server_status(db, server_id, "offline")


def update_server_name(db: Session, server_id: int, new_name: str) -> Optional[Server]:
    """Actualiza el nombre de un servidor"""
    db_server = get_server_by_id(db, server_id)
    if not db_server:
        return None
    
    db_server.name = new_name  # type: ignore
    db.commit()
    db.refresh(db_server)
    return db_server


def update_server_ip(db: Session, server_id: int, new_ip: str) -> Optional[Server]:
    """Actualiza la dirección IP de un servidor"""
    db_server = get_server_by_id(db, server_id)
    if not db_server:
        return None
    
    db_server.ip_address = new_ip  # type: ignore
    db.commit()
    db.refresh(db_server)
    return db_server


# DELETE
def delete_server(db: Session, server_id: int) -> bool:
    """Elimina permanentemente un servidor de la base de datos"""
    db_server = get_server_by_id(db, server_id)
    if not db_server:
        return False
    
    db.delete(db_server)
    db.commit()
    return True


def delete_server_by_name(db: Session, name: str) -> bool:
    """Elimina un servidor por su nombre"""
    db_server = get_server_by_name(db, name)
    if not db_server:
        return False
    
    db.delete(db_server)
    db.commit()
    return True


# BULK OPERATIONS
def create_multiple_servers(db: Session, servers: List[ServerCreate]) -> List[Server]:
    """Crea múltiples servidores en una sola operación"""
    db_servers = []
    for server in servers:
        db_server = Server(
            name=server.name,
            ip_address=server.ip_address,
            status="offline"
        )
        db_servers.append(db_server)
    
    db.add_all(db_servers)
    db.commit()
    for db_server in db_servers:
        db.refresh(db_server)
    
    return db_servers


def set_all_servers_offline(db: Session) -> int:
    """Marca todos los servidores como offline. Retorna el número de servidores actualizados"""
    count = db.query(Server).update({"status": "offline"})
    db.commit()
    return count


def delete_all_offline_servers(db: Session) -> int:
    """Elimina todos los servidores offline. Retorna el número de servidores eliminados"""
    count = db.query(Server).filter(Server.status == "offline").delete()
    db.commit()
    return count
