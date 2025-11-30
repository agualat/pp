from .db import Base, engine
# Import all models so SQLAlchemy registers them before create_all
from ..models.models import User, Server, Metric, AnsibleTask, ExecutedPlaybook

def init_db() -> None:
	Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
	init_db()
	print("Database tables created (if not existing)")
