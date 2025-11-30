from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..utils.db import get_db
from .auth import get_current_staff_user
from ..models.models import AnsibleTask, AnsibleTaskCreate, ExecutedPlaybook, ExecutedPlaybookCreate, ExecutionState, User
from ..CRUD.servers import get_server_by_id
from ..CRUD.ansible import (
    create_ansible_task,
    get_task_by_id,
    get_task_by_name,
    get_all_tasks,
    get_tasks_by_playbook,
    get_tasks_by_inventory,
    update_task,
    update_task_playbook,
    update_task_inventory,
    update_task_name,
    delete_task,
    delete_task_by_name,
    create_multiple_tasks,
    count_tasks,
)
from ..CRUD.executed_playbooks import create_execution

router = APIRouter(prefix="/ansible", tags=["ansible"], dependencies=[Depends(get_current_staff_user)])

# --------- Playbooks CRUD ---------

@router.post("/playbooks", response_model=AnsibleTask)
def create_playbook(payload: AnsibleTaskCreate, db: Session = Depends(get_db)):
    # validar duplicados por nombre
    existing = get_task_by_name(db, payload.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Playbook name already exists")
    return create_ansible_task(db, payload)


@router.get("/playbooks/{task_id}", response_model=AnsibleTask)
def read_playbook(task_id: int, db: Session = Depends(get_db)):
    task = get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return task


@router.get("/playbooks", response_model=List[AnsibleTask])
def list_playbooks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_all_tasks(db, skip=skip, limit=limit)


@router.get("/playbooks/by-playbook", response_model=List[AnsibleTask])
def list_by_playbook(playbook: str, db: Session = Depends(get_db)):
    return get_tasks_by_playbook(db, playbook)


@router.get("/playbooks/by-inventory", response_model=List[AnsibleTask])
def list_by_inventory(inventory: str, db: Session = Depends(get_db)):
    return get_tasks_by_inventory(db, inventory)


@router.patch("/playbooks/{task_id}", response_model=AnsibleTask)
def patch_playbook(task_id: int, updates: dict, db: Session = Depends(get_db)):
    # Validar que el playbook exista primero
    if not get_task_by_id(db, task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    
    updated = update_task(db, task_id, updates)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name already exists or invalid update")
    return updated


@router.put("/playbooks/{task_id}/playbook", response_model=AnsibleTask)
def put_playbook_name(task_id: int, playbook: str, db: Session = Depends(get_db)):
    updated = update_task_playbook(db, task_id, playbook)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return updated


@router.put("/playbooks/{task_id}/inventory", response_model=AnsibleTask)
def put_playbook_inventory(task_id: int, inventory: str, db: Session = Depends(get_db)):
    updated = update_task_inventory(db, task_id, inventory)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return updated


@router.put("/playbooks/{task_id}/name", response_model=AnsibleTask)
def put_playbook_task_name(task_id: int, name: str, db: Session = Depends(get_db)):
    updated = update_task_name(db, task_id, name)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Playbook not found or name already exists")
    return updated


@router.delete("/playbooks/{task_id}")
def remove_playbook(task_id: int, db: Session = Depends(get_db)):
    deleted = delete_task(db, task_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return {"deleted": True}


@router.delete("/playbooks/by-name")
def remove_playbook_by_name(name: str, db: Session = Depends(get_db)):
    deleted = delete_task_by_name(db, name)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return {"deleted": True}


@router.post("/playbooks/bulk", response_model=List[AnsibleTask])
def bulk_create_playbooks(payload: List[AnsibleTaskCreate], db: Session = Depends(get_db)):
    return create_multiple_tasks(db, payload)


@router.get("/playbooks/count")
def count_playbooks(db: Session = Depends(get_db)):
    return {"count": count_tasks(db)}


# --------- Execute Playbook ---------

@router.post("/playbooks/{playbook_id}/run")
def run_playbook(
    playbook_id: int, 
    server_ids: List[int],
    user: User = Depends(get_current_staff_user),
    db: Session = Depends(get_db)
):
    """
    Ejecuta un playbook de Ansible en los servidores especificados.
    Retorna el execution_id para hacer seguimiento.
    """
    from ..utils.ansible_tasks import run_ansible_playbook
    
    # Validar que playbook exista
    playbook = get_task_by_id(db, playbook_id)
    if not playbook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    
    # Validar que servidores existan
    for sid in server_ids:
        if not get_server_by_id(db, sid):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid server id {sid}")
    
    # Crear registro de ejecución con estado "dry" (pending)
    execution_data = ExecutedPlaybookCreate(
        playbook_id=playbook_id,
        user_id=user.id,
        servers=server_ids,
        state=ExecutionState.dry
    )
    execution = create_execution(db, execution_data)
    
    # Encolar tarea de Celery
    run_ansible_playbook.delay(execution.id)
    
    return {
        "execution_id": execution.id,
        "status": "queued",
        "message": "Playbook execution started. Check /executions/{execution_id} for status."
    }
