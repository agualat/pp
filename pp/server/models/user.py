from pydantic import BaseModel
from ..utils.db import Base
from sqlalchemy import Column, Integer, String

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    is_admin = Column(Integer, default=0)  # 0 = False, 1 = True
    is_active = Column(Integer, default=1)  # 0 = False, 1 = True

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

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    ip_address = Column(String, unique=True, index=True)
    status = Column(String, default="offline")