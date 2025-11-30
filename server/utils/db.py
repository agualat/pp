from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql://postgres:1234@localhost:5432/mydb"

# --- ENGINE ---
engine = create_engine(
    DATABASE_URL,
    future=True,  # versión moderna de SQLAlchemy
)

# --- SESSION FACTORY ---
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

# --- BASE PARA MODELOS ---
Base = declarative_base()

# --- DEPENDENCIA PARA OBTENER LA SESIÓN ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
