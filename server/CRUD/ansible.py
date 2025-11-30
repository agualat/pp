from sqlalchemy.orm import Session
from ..models.models import AnsibleTask, AnsibleTaskCreate
from typing import List, Optional


# CREATE
def create_ansible_task(db: Session, task: AnsibleTaskCreate) -> AnsibleTask:
    """Crea una nueva tarea de Ansible en la base de datos"""
    db_task = AnsibleTask(
        name=task.name,
        playbook=task.playbook,
        inventory=task.inventory,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


# READ
def get_task_by_id(db: Session, task_id: int) -> Optional[AnsibleTask]:
    """Obtiene una tarea por su ID"""
    return db.query(AnsibleTask).filter(AnsibleTask.id == task_id).first()


def get_task_by_name(db: Session, name: str) -> Optional[AnsibleTask]:
    """Obtiene una tarea por su nombre"""
    return db.query(AnsibleTask).filter(AnsibleTask.name == name).first()


def get_all_tasks(db: Session, skip: int = 0, limit: int = 100) -> List[AnsibleTask]:
    """Obtiene todas las tareas con paginación"""
    return db.query(AnsibleTask).offset(skip).limit(limit).all()


# (Funciones relacionadas con 'status' removidas; el estado de ejecución vive en ExecutedPlaybook)


def get_tasks_by_playbook(db: Session, playbook: str) -> List[AnsibleTask]:
    """Obtiene todas las tareas que usan un playbook específico"""
    return db.query(AnsibleTask).filter(AnsibleTask.playbook == playbook).all()


def get_tasks_by_inventory(db: Session, inventory: str) -> List[AnsibleTask]:
    """Obtiene todas las tareas que usan un inventory específico"""
    return db.query(AnsibleTask).filter(AnsibleTask.inventory == inventory).all()


def count_tasks(db: Session) -> int:
    """Cuenta el total de tareas"""
    return db.query(AnsibleTask).count()


# UPDATE
def update_task(db: Session, task_id: int, task_data: dict) -> Optional[AnsibleTask]:
    """Actualiza datos arbitrarios del playbook (name, playbook, inventory)."""
    db_task = get_task_by_id(db, task_id)
    if not db_task:
        return None
    
    # Validar unicidad de nombre si se está actualizando
    if "name" in task_data:
        existing = db.query(AnsibleTask).filter(
            AnsibleTask.name == task_data["name"],
            AnsibleTask.id != task_id
        ).first()
        if existing:
            return None
    
    for key, value in task_data.items():
        if hasattr(db_task, key):
            setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task_playbook(db: Session, task_id: int, new_playbook: str) -> Optional[AnsibleTask]:
    """Actualiza el playbook de una tarea"""
    db_task = get_task_by_id(db, task_id)
    if not db_task:
        return None
    
    setattr(db_task, 'playbook', new_playbook)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task_inventory(db: Session, task_id: int, new_inventory: str) -> Optional[AnsibleTask]:
    """Actualiza el inventory de una tarea"""
    db_task = get_task_by_id(db, task_id)
    if not db_task:
        return None
    setattr(db_task, 'inventory', new_inventory)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task_name(db: Session, task_id: int, new_name: str) -> Optional[AnsibleTask]:
    """Actualiza el nombre de una tarea"""
    # Validar que el nombre no exista en otro playbook
    existing = db.query(AnsibleTask).filter(
        AnsibleTask.name == new_name,
        AnsibleTask.id != task_id
    ).first()
    if existing:
        return None
    
    db_task = get_task_by_id(db, task_id)
    if not db_task:
        return None
    setattr(db_task, 'name', new_name)
    db.commit()
    db.refresh(db_task)
    return db_task


# DELETE
def delete_task(db: Session, task_id: int) -> bool:
    """Elimina permanentemente una tarea de la base de datos"""
    db_task = get_task_by_id(db, task_id)
    if not db_task:
        return False
    
    db.delete(db_task)
    db.commit()
    return True


def delete_task_by_name(db: Session, name: str) -> bool:
    """Elimina una tarea por su nombre"""
    db_task = get_task_by_name(db, name)
    if not db_task:
        return False
    
    db.delete(db_task)
    db.commit()
    return True


# BULK OPERATIONS
def create_multiple_tasks(db: Session, tasks: List[AnsibleTaskCreate]) -> List[AnsibleTask]:
    """Crea múltiples tareas en una sola operación"""
    db_tasks = []
    for task in tasks:
        db_task = AnsibleTask(
            name=task.name,
            playbook=task.playbook,
            inventory=task.inventory,
        )
        db_tasks.append(db_task)
    
    db.add_all(db_tasks)
    db.commit()
    for db_task in db_tasks:
        db.refresh(db_task)
    
    return db_tasks


def delete_tasks_by_playbook(db: Session, playbook: str) -> int:
    """Elimina todas las tareas que usan un playbook específico. Retorna el número de tareas eliminadas"""
    count = db.query(AnsibleTask).filter(AnsibleTask.playbook == playbook).delete()
    db.commit()
    return count
