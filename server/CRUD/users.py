from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..models.models import User, UserCreate
from ..utils.auth import hash_password
import asyncio


def _trigger_user_sync(db: Session):
    """
    Dispara la sincronización de usuarios con todos los clientes.
    Se ejecuta después de cualquier operación que modifique la tabla users.
    """
    try:
        from ..utils.user_sync import sync_users_to_all_clients_sync
        # Ejecutar sincronización en segundo plano
        sync_users_to_all_clients_sync(db)
    except Exception as e:
        # No fallar la operación principal si la sincronización falla
        print(f"Warning: User sync failed: {e}")


# CREATE
def create_user(db: Session, user: UserCreate, auto_sync: bool = True) -> User:
    """Crea un nuevo usuario en la base de datos con system_uid auto-asignado"""
    hashed_password = hash_password(user.password)
    
    # Get the next available system_uid (starting from 2000)
    max_uid = db.query(func.max(User.system_uid)).scalar()
    if max_uid is None or max_uid < 2000:
        next_uid = 2000
    else:
        next_uid = max_uid + 1
    
    db_user = User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        is_admin=user.is_admin,
        is_active=user.is_active,
        system_uid=next_uid,
        system_gid=2000,  # Default group for all users
        ssh_public_key=user.ssh_public_key
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Sincronizar con todos los clientes si auto_sync=True
    if auto_sync:
        _trigger_user_sync(db)
    
    return db_user


# READ
def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Obtiene un usuario por su ID"""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Obtiene un usuario por su nombre de usuario"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Obtiene un usuario por su email"""
    return db.query(User).filter(User.email == email).first()


def get_all_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """Obtiene todos los usuarios con paginación"""
    return db.query(User).offset(skip).limit(limit).all()


def get_active_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """Obtiene todos los usuarios activos"""
    return db.query(User).filter(User.is_active == 1).offset(skip).limit(limit).all()


def get_admin_users(db: Session) -> List[User]:
    """Obtiene todos los usuarios administradores"""
    return db.query(User).filter(User.is_admin == 1).all()


# UPDATE
def update_user(db: Session, user_id: int, user_data: dict) -> Optional[User]:
    """Actualiza los datos de un usuario"""
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        return None
    
    # Si se incluye una nueva contraseña, hashearla
    if "password" in user_data:
        user_data["password_hash"] = hash_password(user_data.pop("password"))
    
    # Actualizar los campos
    for key, value in user_data.items():
        if hasattr(db_user, key):
            setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    
    # Sincronizar con todos los clientes
    _trigger_user_sync(db)
    
    return db_user


def update_user_password(db: Session, user_id: int, new_password: str) -> Optional[User]:
    """Actualiza solo la contraseña de un usuario"""
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        return None

    # Use a query-based update to avoid assigning directly to the Column-typed attribute
    hashed = hash_password(new_password)
    db.query(User).filter(User.id == user_id).update({"password_hash": hashed})
    db.commit()
    
    # Sincronizar con todos los clientes
    _trigger_user_sync(db)
    
    # Return a fresh instance from the DB
    return get_user_by_id(db, user_id)


def deactivate_user(db: Session, user_id: int) -> Optional[User]:
    """Desactiva un usuario (soft delete)"""
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        return None
    
    db.query(User).filter(User.id == user_id).update({"is_active": 0})
    db.commit()
    
    # Sincronizar con todos los clientes
    _trigger_user_sync(db)
    
    return get_user_by_id(db, user_id)


def activate_user(db: Session, user_id: int) -> Optional[User]:
    """Activa un usuario"""
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        return None
    
    db.query(User).filter(User.id == user_id).update({"is_active": 1})
    db.commit()
    
    # Sincronizar con todos los clientes
    _trigger_user_sync(db)
    
    return get_user_by_id(db, user_id)

def toggle_admin(db: Session, user_id: int) -> Optional[User]:
    """Alterna el estado de administrador de un usuario"""
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        return None
    
    new_value = 0 if getattr(db_user, 'is_admin') == 1 else 1
    db.query(User).filter(User.id == user_id).update({"is_admin": new_value})
    db.commit()
    
    # Sincronizar con todos los clientes
    _trigger_user_sync(db)
    
    return get_user_by_id(db, user_id)

# DELETE
def delete_user(db: Session, user_id: int) -> bool:
    """Elimina permanentemente un usuario de la base de datos"""
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        return False
    
    db.delete(db_user)
    db.commit()
    
    # Sincronizar con todos los clientes
    _trigger_user_sync(db)
    
    return True


# AUTHENTICATION
# Autenticación movida a utils/auth.py (authenticate_user devuelve JWT)
