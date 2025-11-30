from sqlalchemy.orm import Session
from sqlalchemy import and_
from ..models.models import ExecutedPlaybook, ExecutedPlaybookCreate, ExecutionState
from typing import List, Optional

# CREATE

def create_execution(db: Session, exec_data: ExecutedPlaybookCreate) -> ExecutedPlaybook:
    """Registra una ejecución de un playbook."""
    db_exec = ExecutedPlaybook(
        playbook_id=exec_data.playbook_id,
        user_id=exec_data.user_id,
        servers=exec_data.servers,
        state=exec_data.state.value,
    )
    db.add(db_exec)
    db.commit()
    db.refresh(db_exec)
    return db_exec

# READ

def get_execution_by_id(db: Session, execution_id: int) -> Optional[ExecutedPlaybook]:
    return db.query(ExecutedPlaybook).filter(ExecutedPlaybook.id == execution_id).first()


def get_executions(db: Session, skip: int = 0, limit: int = 100) -> List[ExecutedPlaybook]:
    return db.query(ExecutedPlaybook).offset(skip).limit(limit).all()


def get_executions_by_playbook(db: Session, playbook_id: int) -> List[ExecutedPlaybook]:
    return db.query(ExecutedPlaybook).filter(ExecutedPlaybook.playbook_id == playbook_id).all()


def get_executions_by_user(db: Session, user_id: int) -> List[ExecutedPlaybook]:
    return db.query(ExecutedPlaybook).filter(ExecutedPlaybook.user_id == user_id).all()


def get_executions_by_state(db: Session, state: str) -> List[ExecutedPlaybook]:
    """Obtiene ejecuciones por estado (acepta string o ExecutionState)"""
    state_value = state if isinstance(state, str) else state.value
    return db.query(ExecutedPlaybook).filter(ExecutedPlaybook.state == state_value).all()


def get_executions_by_server(db: Session, server_id: int) -> List[ExecutedPlaybook]:
    # Busca ejecuciones donde la lista de servidores contiene server_id
    return db.query(ExecutedPlaybook).filter(server_id == any_(ExecutedPlaybook.servers)).all()  # type: ignore


def get_latest_execution_for_playbook(db: Session, playbook_id: int) -> Optional[ExecutedPlaybook]:
    return (
        db.query(ExecutedPlaybook)
        .filter(ExecutedPlaybook.playbook_id == playbook_id)
        .order_by(ExecutedPlaybook.executed_at.desc())
        .first()
    )

# UPDATE

def update_execution_state(db: Session, execution_id: int, new_state: ExecutionState) -> Optional[ExecutedPlaybook]:
    db_exec = get_execution_by_id(db, execution_id)
    if not db_exec:
        return None
    setattr(db_exec, 'state', new_state.value)
    db.commit()
    db.refresh(db_exec)
    return db_exec


def append_servers_to_execution(db: Session, execution_id: int, more_servers: List[int]) -> Optional[ExecutedPlaybook]:
    db_exec = get_execution_by_id(db, execution_id)
    if not db_exec:
        return None
    current_servers = list(db_exec.servers)
    existing = set(current_servers)
    for s in more_servers:
        existing.add(s)
    db_exec.servers = list(existing)
    db.commit()
    db.refresh(db_exec)
    return db_exec

# DELETE

def delete_execution(db: Session, execution_id: int) -> bool:
    db_exec = get_execution_by_id(db, execution_id)
    if not db_exec:
        return False
    db.delete(db_exec)
    db.commit()
    return True


def delete_executions_by_playbook(db: Session, playbook_id: int) -> int:
    count = db.query(ExecutedPlaybook).filter(ExecutedPlaybook.playbook_id == playbook_id).delete()
    db.commit()
    return count

# REPORTING / COUNTS

def count_executions(db: Session) -> int:
    return db.query(ExecutedPlaybook).count()


def count_executions_by_state(db: Session, state: str) -> int:
    """Cuenta ejecuciones por estado (acepta string o ExecutionState)"""
    state_value = state if isinstance(state, str) else state.value
    return db.query(ExecutedPlaybook).filter(ExecutedPlaybook.state == state_value).count()


def count_executions_for_playbook(db: Session, playbook_id: int) -> int:
    return db.query(ExecutedPlaybook).filter(ExecutedPlaybook.playbook_id == playbook_id).count()
