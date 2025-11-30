from pydantic import BaseModel
from ..utils.db import Base
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
from enum import Enum
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    is_admin: Mapped[int] = mapped_column(Integer, default=0)  # 0 = False, 1 = True
    is_active: Mapped[int] = mapped_column(Integer, default=1)  # 0 = False, 1 = True

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    is_admin: int = 0
    is_active: int = 1

class ServerCreate(BaseModel):
    name: str
    ip_address: str

class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    ip_address: Mapped[str] = mapped_column(String, unique=True, index=True)
    status: Mapped[str] = mapped_column(String, default="offline")

class Metric(Base):
    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    server_id: Mapped[int] = mapped_column(Integer, index=True)
    cpu_usage: Mapped[str] = mapped_column(String)
    memory_usage: Mapped[str] = mapped_column(String)
    disk_usage: Mapped[str] = mapped_column(String)
    timestamp: Mapped[str] = mapped_column(String)
    gpu_usage: Mapped[str] = mapped_column(String, default="N/A")

class MetricCreate(BaseModel):
    server_id: int
    cpu_usage: str
    memory_usage: str
    disk_usage: str
    timestamp: str
    gpu_usage: str = "N/A"

class AnsibleTaskCreate(BaseModel):
    name: str
    playbook: str
    inventory: str

class AnsibleTask(Base):
    __tablename__ = "ansible_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    playbook: Mapped[str] = mapped_column(String)
    inventory: Mapped[str] = mapped_column(String)


class ExecutionState(str, Enum):
    success = "success"
    error = "error"
    dry = "dry"


class ExecutedPlaybook(Base):
    __tablename__ = "executed_playbooks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    playbook_id: Mapped[int] = mapped_column(Integer, ForeignKey("ansible_tasks.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    servers: Mapped[list[int]] = mapped_column(ARRAY(Integer))  # Lista de IDs de servidores
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    state: Mapped[str] = mapped_column(String, index=True)  # success | error | dry


class ExecutedPlaybookCreate(BaseModel):
    playbook_id: int
    user_id: int
    servers: list[int]
    state: ExecutionState