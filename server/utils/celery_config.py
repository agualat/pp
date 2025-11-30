from celery import Celery
import os

# Configuración de Celery con PostgreSQL como broker y backend
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:1234@localhost:5432/mydb")

# Convertir formato para SQLAlchemy broker (requiere formato db+)
BROKER_URL = DATABASE_URL.replace("postgresql://", "db+postgresql://")

celery_app = Celery(
    "ansible_tasks",
    broker=BROKER_URL,
    backend=BROKER_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)
