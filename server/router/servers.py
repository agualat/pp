from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import os

from ..utils.db import get_db
from .auth import get_current_staff_user
from ..models.models import Server, ServerCreate, ServerResponse, MetricResponse
from ..CRUD.servers import (
    create_server,
    get_server_by_id,
    get_server_by_name,
    get_server_by_ip,
    get_all_servers,
    get_servers_by_status,
    get_online_servers,
    get_offline_servers,
    update_server,
    update_server_status,
    set_server_online,
    set_server_offline,
    update_server_name,
    update_server_ip,
    delete_server,
    delete_server_by_name,
    create_multiple_servers,
    count_servers,
    count_servers_by_status,
)
from ..utils.client_registration import register_server_in_client, unregister_server_from_client

router = APIRouter(prefix="/servers", tags=["servers"], dependencies=[Depends(get_current_staff_user)])

# URL del cliente desde variable de entorno
CLIENT_URL = os.getenv("CLIENT_URL", "http://client:8100")


async def register_in_client_background(server: Server):
    """Tarea en background para registrar servidor en el cliente"""
    await register_server_in_client(
        client_url=CLIENT_URL,
        server_id=server.id,
        name=server.name,
        ip_address=server.ip_address,
        ssh_port=22,
        ssh_user=server.ssh_user,
        description=f"Server managed by {server.ssh_user}"
    )


async def unregister_from_client_background(server_id: int):
    """Tarea en background para eliminar servidor del cliente"""
    await unregister_server_from_client(
        client_url=CLIENT_URL,
        server_id=server_id
    )


@router.post("/register", response_model=ServerResponse)
def register_server_auto(
    payload: ServerCreate,
    db: Session = Depends(get_db)
):
    """
    Auto-registra un servidor desde el cliente.
    Si ya existe por IP, actualiza la información.
    Si no existe, lo crea.
    """
    # Buscar si ya existe por IP
    existing = get_server_by_ip(db, payload.ip_address)
    
    if existing:
        # Actualizar información del servidor existente
        updates = {
            "name": payload.name,
            "ssh_user": payload.ssh_user
        }
        updated = update_server(db, existing.id, updates)
        return updated
    
    # Crear nuevo servidor
    return create_server(db, payload)


@router.post("/", response_model=ServerResponse)
async def create_new_server(
    payload: ServerCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Validar que no exista servidor con mismo nombre o IP
    if get_server_by_name(db, payload.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Server name already exists")
    if get_server_by_ip(db, payload.ip_address):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IP address already in use")
    
    # Crear servidor en BD
    new_server = create_server(db, payload)
    
    # Registrar en el cliente en background
    background_tasks.add_task(register_in_client_background, new_server)
    
    return new_server


@router.get("/", response_model=List[ServerResponse])
def list_servers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_all_servers(db, skip=skip, limit=limit)


# Rutas de conteo ANTES de las rutas con parámetros dinámicos
@router.get("/count/total")
def count_all_servers(db: Session = Depends(get_db)):
    count = count_servers(db)
    print(f"[SERVERS] Total count: {count}")
    return {"count": count}


@router.get("/count/by-status/{status_filter}")
def count_servers_by_status_filter(status_filter: str, db: Session = Depends(get_db)):
    count = count_servers_by_status(db, status_filter)
    print(f"[SERVERS] Count by status '{status_filter}': {count}")
    return {"count": count}


@router.get("/{server_id}", response_model=ServerResponse)
def read_server(server_id: int, db: Session = Depends(get_db)):
    server = get_server_by_id(db, server_id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return server


@router.get("/by-name/{name}", response_model=ServerResponse)
def read_server_by_name(name: str, db: Session = Depends(get_db)):
    server = get_server_by_name(db, name)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return server


@router.get("/by-ip/{ip_address}", response_model=ServerResponse)
def read_server_by_ip(ip_address: str, db: Session = Depends(get_db)):
    server = get_server_by_ip(db, ip_address)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return server


@router.get("/status/{status_filter}", response_model=List[ServerResponse])
def list_servers_by_status(status_filter: str, db: Session = Depends(get_db)):
    return get_servers_by_status(db, status_filter)


@router.get("/status/online/list", response_model=List[ServerResponse])
def list_online_servers(db: Session = Depends(get_db)):
    return get_online_servers(db)


@router.get("/status/offline/list", response_model=List[ServerResponse])
def list_offline_servers(db: Session = Depends(get_db)):
    return get_offline_servers(db)


@router.patch("/{server_id}", response_model=ServerResponse)
def patch_server(server_id: int, updates: dict, db: Session = Depends(get_db)):
    # Validar que el servidor exista
    if not get_server_by_id(db, server_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    
    # Validar unicidad de nombre e IP si se están actualizando
    if "name" in updates:
        existing = get_server_by_name(db, updates["name"])
        if existing and existing.id != server_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Server name already exists")
    
    if "ip_address" in updates:
        existing = get_server_by_ip(db, updates["ip_address"])
        if existing and existing.id != server_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IP address already in use")
    
    updated = update_server(db, server_id, updates)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Update failed")
    return updated


@router.put("/{server_id}/status", response_model=ServerResponse)
def put_server_status(server_id: int, new_status: str, db: Session = Depends(get_db)):
    updated = update_server_status(db, server_id, new_status)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return updated


@router.put("/{server_id}/online", response_model=ServerResponse)
def mark_server_online(server_id: int, db: Session = Depends(get_db)):
    updated = set_server_online(db, server_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return updated


@router.put("/{server_id}/offline", response_model=ServerResponse)
def mark_server_offline(server_id: int, db: Session = Depends(get_db)):
    updated = set_server_offline(db, server_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return updated


@router.put("/{server_id}/name", response_model=ServerResponse)
def put_server_name(server_id: int, name: str, db: Session = Depends(get_db)):
    # Validar unicidad
    existing = get_server_by_name(db, name)
    if existing and existing.id != server_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Server name already exists")
    
    updated = update_server_name(db, server_id, name)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return updated


@router.put("/{server_id}/ip", response_model=ServerResponse)
def put_server_ip(server_id: int, ip_address: str, db: Session = Depends(get_db)):
    # Validar unicidad
    existing = get_server_by_ip(db, ip_address)
    if existing and existing.id != server_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IP address already in use")
    
    updated = update_server_ip(db, server_id, ip_address)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return updated


@router.delete("/{server_id}")
async def remove_server(
    server_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    deleted = delete_server(db, server_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    
    # Eliminar del cliente en background
    background_tasks.add_task(unregister_from_client_background, server_id)
    
    return {"deleted": True}


@router.delete("/by-name/{name}")
def remove_server_by_name(name: str, db: Session = Depends(get_db)):
    deleted = delete_server_by_name(db, name)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return {"deleted": True}


@router.post("/bulk", response_model=List[ServerResponse])
def bulk_create_servers(payload: List[ServerCreate], db: Session = Depends(get_db)):
    # Validar duplicados antes de crear
    for server_data in payload:
        if get_server_by_name(db, server_data.name):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Server name '{server_data.name}' already exists")
        if get_server_by_ip(db, server_data.ip_address):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"IP '{server_data.ip_address}' already in use")
    
    return create_multiple_servers(db, payload)


# --------- Metrics Endpoints ---------

@router.get("/{server_id}/metrics", response_model=List[MetricResponse])
def get_server_metrics(server_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """Obtiene las últimas métricas de un servidor específico"""
    from ..models.models import Metric
    if not get_server_by_id(db, server_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return db.query(Metric).filter(Metric.server_id == server_id).order_by(Metric.timestamp.desc()).limit(limit).all()


@router.get("/metrics/all")
def get_all_metrics(db: Session = Depends(get_db)):
    """Obtiene la última métrica de todos los servidores"""
    from ..models.models import Metric
    servers = get_all_servers(db)
    result = {}
    for server in servers:
        latest = db.query(Metric).filter(Metric.server_id == server.id).order_by(Metric.timestamp.desc()).first()
        result[server.id] = {
            "server": {"id": server.id, "name": server.name, "ip_address": server.ip_address, "status": server.status},
            "latest_metric": latest
        }
    return result
