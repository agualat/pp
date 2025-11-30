from .db import Base, engine, SessionLocal
# Import all models so SQLAlchemy registers them before create_all
from ..models.models import User, Server, Metric, AnsibleTask, ExecutedPlaybook, UserCreate
from ..CRUD.users import create_user, get_user_by_username
import os

def init_db() -> None:
	"""Crea las tablas de la base de datos"""
	Base.metadata.create_all(bind=engine)

def create_default_admin() -> None:
	"""Crea un usuario administrador por defecto si no existe"""
	db = SessionLocal()
	try:
		# Obtener credenciales desde variables de entorno o usar valores por defecto
		admin_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
		admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@admin.com")
		admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
		
		# Verificar si ya existe el usuario admin
		existing_admin = get_user_by_username(db, admin_username)
		
		if not existing_admin:
			# Crear usuario administrador
			admin_data = UserCreate(
				username=admin_username,
				email=admin_email,
				password=admin_password,
				is_admin=1,  # Es administrador
				is_active=1
			)
			admin_user = create_user(db, admin_data)
			print(f"✓ Usuario administrador creado: {admin_username}")
			print(f"  Email: {admin_email}")
			print(f"  Contraseña: {admin_password}")
			print(f"  ⚠️  CAMBIA LA CONTRASEÑA POR DEFECTO EN PRODUCCIÓN!")
		else:
			print(f"✓ Usuario administrador '{admin_username}' ya existe")
			# Asegurarse de que sea admin
			if getattr(existing_admin, 'is_admin', 0) != 1:
				from ..CRUD.users import toggle_admin
				toggle_admin(db, existing_admin.id)
				print(f"  → Permisos de administrador activados")
	except Exception as e:
		print(f"✗ Error al crear usuario administrador: {e}")
		db.rollback()
	finally:
		db.close()

if __name__ == "__main__":
	print("Inicializando base de datos...")
	init_db()
	print("✓ Tablas de base de datos creadas (si no existían)")
	print("\nCreando usuario administrador por defecto...")
	create_default_admin()
	print("\n✓ Inicialización completada")
