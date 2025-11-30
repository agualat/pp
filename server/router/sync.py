"""
Router para operaciones de sincronización manual
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..utils.db import get_db
from ..utils.user_sync import sync_users_to_all_clients_sync
from .auth import get_current_staff_user


router = APIRouter(prefix="/sync", tags=["Synchronization"], dependencies=[Depends(get_current_staff_user)])


@router.post("/users/manual")
async def manual_sync_users(db: Session = Depends(get_db)):
    """
    Sincronización manual de usuarios con todos los clientes.
    
    Este endpoint permite forzar una sincronización manual en caso de que
    la sincronización automática falle o para verificar el estado.
    """
    result = sync_users_to_all_clients_sync(db)
    return result
