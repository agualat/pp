from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..utils.db import get_db
from .auth import get_current_staff_user
from ..models.models import ExecutedPlaybook, ExecutionState
from ..CRUD.executed_playbooks import (
    get_execution_by_id,
    get_executions,
    get_executions_by_playbook,
    get_executions_by_user,
    get_executions_by_state,
    get_latest_execution_for_playbook,
    count_executions,
    count_executions_by_state,
    count_executions_for_playbook,
)

router = APIRouter(prefix="/executions", tags=["executions"], dependencies=[Depends(get_current_staff_user)])


@router.get("/{execution_id}", response_model=ExecutedPlaybook)
def read_execution(execution_id: int, db: Session = Depends(get_db)):
    exec_ = get_execution_by_id(db, execution_id)
    if not exec_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return exec_


@router.get("/", response_model=List[ExecutedPlaybook])
def list_executions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_executions(db, skip=skip, limit=limit)


@router.get("/by-playbook/{playbook_id}", response_model=List[ExecutedPlaybook])
def list_exec_by_playbook(playbook_id: int, db: Session = Depends(get_db)):
    return get_executions_by_playbook(db, playbook_id)


@router.get("/by-user/{user_id}", response_model=List[ExecutedPlaybook])
def list_exec_by_user(user_id: int, db: Session = Depends(get_db)):
    return get_executions_by_user(db, user_id)


@router.get("/by-state/{state}", response_model=List[ExecutedPlaybook])
def list_exec_by_state(state: ExecutionState, db: Session = Depends(get_db)):
    return get_executions_by_state(db, state)


@router.get("/latest/{playbook_id}", response_model=ExecutedPlaybook)
def latest_exec(playbook_id: int, db: Session = Depends(get_db)):
    exec_ = get_latest_execution_for_playbook(db, playbook_id)
    if not exec_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No executions found")
    return exec_


@router.get("/count/total")
def count_all_execs(db: Session = Depends(get_db)):
    return {"count": count_executions(db)}


@router.get("/count/by-state/{state}")
def count_execs_by_state(state: ExecutionState, db: Session = Depends(get_db)):
    return {"count": count_executions_by_state(db, state)}


@router.get("/count/by-playbook/{playbook_id}")
def count_execs_by_playbook(playbook_id: int, db: Session = Depends(get_db)):
    return {"count": count_executions_for_playbook(db, playbook_id)}
