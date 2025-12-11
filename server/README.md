# Server - Backend API

API REST construida con FastAPI para gestión de infraestructura, usuarios y ejecución de playbooks Ansible.

## Características

- 🔐 Autenticación JWT
- 👥 Gestión de usuarios con roles (admin/user)
- 🖥️ Registro y monitoreo de servidores
- 📋 CRUD de playbooks Ansible
- ⚙️ Ejecución asíncrona con Celery
- 📊 Historial de ejecuciones y métricas
- 🔌 WebSocket para métricas en tiempo real
- 📦 Carga masiva de usuarios (CSV/TXT)
- 🔄 Sincronización push automática a clientes
- 🗂️ Almacenamiento de métricas históricas

## Endpoints Principales

### Autenticación (`/auth`)
- `POST /signup` - Registro de usuarios
- `POST /login` - Login (retorna JWT)
- `GET /verify` - Verificar token válido

### Usuarios (`/users`)
- `GET /` - Listar usuarios
- `POST /` - Crear usuario
- `POST /bulk-upload` - Carga masiva CSV/TXT
- `PUT /{id}/toggle-active` - Activar/desactivar
- `PUT /{id}/toggle-admin` - Promover/degradar admin
- `DELETE /{id}` - Eliminar usuario

### Servidores (`/servers`)
- `GET /` - Listar servidores
- `POST /` - Registrar servidor
- `GET /{id}` - Detalle de servidor
- `GET /{id}/metrics` - Historial de métricas
- `PUT /{id}` - Actualizar servidor
- `DELETE /{id}` - Eliminar servidor
- `GET /count` - Total de servidores
- `PUT /{id}/online` - Marcar como online
- `POST /metrics` - Recibir métricas de cliente

### Ansible (`/ansible`)
- `GET /playbooks` - Listar playbooks
- `POST /playbooks` - Crear playbook
- `POST /playbooks/{id}/run` - Ejecutar playbook
- `DELETE /playbooks/{id}` - Eliminar playbook

### Ejecuciones (`/executions`)
- `GET /` - Historial con paginación
- `GET /{id}` - Detalle de ejecución
- `GET /count` - Total de ejecuciones
- `GET /by-state/{state}` - Filtrar por estado

### WebSocket (`/ws`)
- `/ws/metrics/{server_id}` - Métricas en tiempo real del servidor
  - Conecta al WebSocket del cliente correspondiente
  - Retransmite métricas al frontend
  - Reconexión automática en caso de fallo

### Sincronización (`/sync`)
- `POST /sync/users` - Recibir usuarios desde servidor central
- `POST /sync/users/manual` - Forzar sincronización manual

## Estructura

```
server/
├── main.py                 # Entry point
├── requirements.txt
├── router/                 # Endpoints
│   ├── auth.py
│   ├── users.py
│   ├── servers.py
│   ├── ansible.py
│   ├── executions.py
│   └── ws.py
├── CRUD/                   # Database operations
│   ├── users.py
│   ├── servers.py
│   ├── ansible.py
│   └── executed_playbooks.py
├── models/
│   └── models.py          # SQLAlchemy models
└── utils/
    ├── auth.py            # JWT & password hashing
    ├── db.py              # Database connection
    ├── ansible_tasks.py   # Celery tasks
    └── celery_config.py   # Celery configuration
```

## Modelos de Datos

### User
- `id`, `username`, `email`, `password_hash`
- `is_admin`, `is_active`, `system_uid`, `system_gid`
- `created_at`

### Server
- `id`, `hostname`, `ip_address`, `ssh_port`
- `ssh_user`, `is_online`, `last_seen`
- `created_at`

### AnsiblePlaybook
- `id`, `name`, `description`, `content` (YAML)
- `user_id`, `created_at`

### ExecutedPlaybook
- `id`, `playbook_id`, `user_id`, `server_ids[]`
- `state`, `result`, `output`, `is_dry_run`
- `created_at`, `started_at`, `finished_at`

## Configuración

Variables de entorno en `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Admin por defecto
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@admin.com
DEFAULT_ADMIN_PASSWORD=admin123

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

## Desarrollo

### Instalar dependencias

```bash
pip install -r requirements.txt
```

### Ejecutar localmente

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Ejecutar worker Celery

```bash
celery -A utils.celery_config worker --loglevel=info
```

## Testing

Ver documentación interactiva en http://localhost:8000/docs

## Autenticación

Todos los endpoints (excepto `/auth/signup` y `/auth/login`) requieren JWT token:

```bash
# 1. Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# 2. Usar token
curl http://localhost:8000/servers/ \
  -H "Authorization: Bearer <token>"
```

## Carga Masiva de Usuarios

Sube un archivo CSV o TXT con usernames:

```bash
curl -X POST http://localhost:8000/users/bulk-upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@usuarios.csv"
```

Formato CSV:
```csv
username
juan
maria
pedro
```

Genera automáticamente:
- Email: `{username}@estud.usfq.edu.ec`
- Password: `{username}2025`
- UID: Auto-incrementado desde 2000
