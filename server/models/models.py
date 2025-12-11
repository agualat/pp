from pydantic import BaseModel
from ..utils.db import Base
from sqlalchemy import Integer, String, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
from enum import Enum
from datetime import datetime
from typing import Optional

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "username ~ '^[a-z_][a-z0-9_-]*$'",
            name="username_valid_pattern",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    is_admin: Mapped[int] = mapped_column(Integer, default=0)  # 0 = False, 1 = True
    is_active: Mapped[int] = mapped_column(Integer, default=1)  # 0 = False, 1 = True
    must_change_password: Mapped[int] = mapped_column(Integer, default=0)  # 0 = False, 1 = True
    system_uid: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    system_gid: Mapped[int] = mapped_column(Integer, default=2000)
    ssh_public_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    is_admin: int = 0
    is_active: int = 1
    ssh_public_key: str | None = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: int
    is_active: int
    must_change_password: int
    system_uid: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True

class ServerCreate(BaseModel):
    name: str
    ip_address: str
    ssh_user: str = "root"
    ssh_password: str  # Password requerido para configurar SSH key
    ssh_port: int = 22
    description: str = ""

class ServerResponse(BaseModel):
    id: int
    name: str
    ip_address: str
    status: str
    ssh_user: str
    ssh_private_key_path: str | None
    ssh_status: str | None = "pending"

    class Config:
        from_attributes = True

class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    ip_address: Mapped[str] = mapped_column(String, unique=True, index=True)
    status: Mapped[str] = mapped_column(String, default="offline")
    ssh_user: Mapped[str] = mapped_column(String, default="root")
    ssh_private_key_path: Mapped[str | None] = mapped_column(String, nullable=True)
    ssh_status: Mapped[str] = mapped_column(String, default="pending")  # pending, deployed, failed

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

class MetricResponse(BaseModel):
    id: int
    server_id: int
    cpu_usage: str
    memory_usage: str
    disk_usage: str
    timestamp: str
    gpu_usage: str

    class Config:
        from_attributes = True

class AnsibleTaskCreate(BaseModel):
    name: str
    playbook: str
    inventory: str

class AnsibleTaskResponse(BaseModel):
    id: int
    name: str
    playbook: str
    inventory: str

    class Config:
        from_attributes = True

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

class ExecutedPlaybookResponse(BaseModel):
    id: int
    playbook_id: int
    user_id: int
    servers: list[int]
    executed_at: datetime
    state: str

    class Config:
        from_attributes = True


class ExecutedPlaybookResponseWithUser(BaseModel):
    id: int
    playbook_id: int
    user_id: int
    user_username: str | None = None
    servers: list[int]
    executed_at: datetime
    state: str

    class Config:
        from_attributes = True


class SignupRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    must_change_password: int = 0  # Indica si debe cambiar contraseña

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    token_type: str = "bearer"


class VerifyTokenResponse(BaseModel):
    valid: bool
    user_id: Optional[int] = None
    username: Optional[str] = None