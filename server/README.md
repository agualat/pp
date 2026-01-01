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
- 🐳 Gestión de contenedores Docker por servidor

## Endpoints Principales

### Autenticación (`/auth`)
- `POST /signup` - Registro de usuarios
- `POST /login` - Login (retorna JWT)
- `GET /verify` - Verificar token válido
- `POST /change-password` - Cambiar contraseña

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
- `GET /playbooks` - Listar playbooks activos
- `GET /playbooks/deleted` - Listar playbooks eliminados (soft delete)
- `POST /playbooks` - Crear playbook
- `POST /playbooks/{id}/run` - Ejecutar playbook
- `POST /playbooks/{id}/restore` - Restaurar playbook eliminado
- `DELETE /playbooks/{id}` - Eliminar playbook (soft delete)

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

### Contenedores (`/containers`)
- `GET /my` - Listar contenedores del usuario actual
- `GET /public` - Listar contenedores públicos
- `GET /all` - **[ADMIN]** Listar todos los contenedores con filtros
  - Query params: `server_id`, `user_id`, `status`, `is_public`
- `GET /{id}` - Obtener contenedor por ID
- `POST /` - Crear nuevo contenedor
  - Límite: 1 contenedor por servidor por usuario
- `POST /colab` - **[NUEVO]** Crear contenedor Colab con GPU y configuración especial
  - Imagen: `us-docker.pkg.dev/colab-images/public/runtime:latest`
  - Configuración: `--gpus=all --privileged --shm-size=45g`
  - Puertos aleatorios con `-P`
  - Volúmenes automáticos: `/media`, `/mnt`, `/home/{username}`
- `POST /{id}/start` - Iniciar contenedor
- `POST /{id}/stop` - Detener contenedor
- `POST /{id}/toggle-public` - Cambiar visibilidad público/privado
- `DELETE /{id}` - Eliminar contenedor
- `GET /server/{id}/docker-status` - Verificar estado de Docker en servidor

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
│   ├── containers.py
│   └── ws.py
├── CRUD/                   # Database operations
│   ├── users.py
│   ├── servers.py
│   ├── ansible.py
│   ├── containers.py
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

### Container
- `id`, `name`, `user_id`, `server_id`
- `image`, `ports`, `status`
- `is_public`, `container_id`
- `created_at`

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

---

## 🐳 API de Contenedores

### Gestión de Contenedores Docker

Los usuarios pueden crear y gestionar contenedores Docker en los servidores registrados, con un límite de 1 contenedor por servidor por usuario.

**✨ INTEGRACIÓN COMPLETA CON DOCKER:**
- ✅ Creación real de contenedores vía SSH
- ✅ Contenedores Colab con GPU (especial para ML/AI)
- ✅ Inicio/Detención de contenedores
- ✅ Eliminación de contenedores
- ✅ Sincronización de estados
- ✅ Validaciones de configuración
- ✅ Manejo de errores robusto

#### Endpoints Disponibles

##### 1. Obtener mis contenedores
**GET** `/containers/my`

Obtiene todos los contenedores del usuario autenticado.

**Respuesta:**
```json
[
  {
    "id": 1,
    "name": "mi-contenedor",
    "user_id": 1,
    "server_id": 1,
    "server_name": "Servidor Principal",
    "image": "nginx:latest",
    "ports": "80:8080",
    "status": "running",
    "is_public": false,
    "container_id": "abc123",
    "created_at": "2024-01-01T00:00:00"
  }
]
```

##### 2. Obtener contenedores públicos
**GET** `/containers/public`

Obtiene todos los contenedores marcados como públicos.

##### 3. **[NUEVO]** Crear contenedor Colab con GPU
**POST** `/containers/colab`

Crea un contenedor Colab con configuración especial para GPU, ideal para Machine Learning y AI.

**Características:**
- GPU completo: `--gpus=all`
- Privilegios completos: `--privileged`
- Memoria compartida: `--shm-size=45g`
- Puertos aleatorios: `-P`
- Volúmenes automáticos:
  - `/media:/media:ro` (solo lectura)
  - `/mnt:/mnt:ro` (solo lectura)
  - `/home/{username}:/home/{username}` (lectura/escritura)
- Imagen: `us-docker.pkg.dev/colab-images/public/runtime:latest`

**Ejemplo:**
```bash
curl -X POST "http://localhost:8000/containers/colab" \
  -H "Authorization: Bearer {token}"
```

**Respuesta:**
```json
{
  "id": 1,
  "name": "colab_janaranjos",
  "user_id": 1,
  "server_id": 1,
  "server_name": "GPU Server",
  "image": "us-docker.pkg.dev/colab-images/public/runtime:latest",
  "ports": "8888/tcp:32768, 6006/tcp:32769",
  "status": "running",
  "is_public": false,
  "container_id": "abc123def456",
  "created_at": "2024-01-15T10:30:00"
}
```

##### 4. **[ADMIN]** Obtener todos los contenedores
**GET** `/containers/all`

Obtiene todos los contenedores de todos los servidores con filtros opcionales.

**Permisos:** Solo administradores

**Parámetros de consulta (query params):**
- `server_id` (opcional): Filtrar por ID de servidor
- `user_id` (opcional): Filtrar por ID de usuario
- `status` (opcional): Filtrar por estado (`running`, `stopped`, etc.)
- `is_public` (opcional): Filtrar por visibilidad (`true` o `false`)

**Ejemplos de uso:**

```bash
# Todos los contenedores sin filtros
curl -X GET "http://localhost:8000/containers/all" \
  -H "Authorization: Bearer {token}"

# Filtrar por servidor específico
curl -X GET "http://localhost:8000/containers/all?server_id=1" \
  -H "Authorization: Bearer {token}"

# Filtrar por usuario específico
curl -X GET "http://localhost:8000/containers/all?user_id=5" \
  -H "Authorization: Bearer {token}"

# Filtrar por estado
curl -X GET "http://localhost:8000/containers/all?status=running" \
  -H "Authorization: Bearer {token}"

# Combinar múltiples filtros
curl -X GET "http://localhost:8000/containers/all?server_id=1&status=running&is_public=true" \
  -H "Authorization: Bearer {token}"
```

**Desde JavaScript:**
```javascript
// Sin filtros
const response = await fetch('/api/containers/all', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Con filtros
const params = new URLSearchParams({
  server_id: '1',
  status: 'running',
  is_public: 'true'
});
const response = await fetch(`/api/containers/all?${params}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const containers = await response.json();
```

##### 5. Crear contenedor
**POST** `/containers`

Crea un nuevo contenedor.

**Límite:** 1 contenedor por servidor por usuario

**Body:**
```json
{
  "name": "mi-contenedor",
  "server_id": 1,
  "image": "nginx:latest",
  "ports": "80:8080"
}
```

##### 6. Iniciar contenedor
**POST** `/containers/{container_id}/start`

Inicia un contenedor.

**Permisos:** Propietario o admin

##### 7. Detener contenedor
**POST** `/containers/{container_id}/stop`

Detiene un contenedor.

**Permisos:** Propietario o admin

##### 8. Eliminar contenedor
**DELETE** `/containers/{container_id}`

Elimina un contenedor.

**Permisos:** Propietario o admin

##### 9. Cambiar visibilidad
**POST** `/containers/{container_id}/toggle-public`

Cambia la visibilidad del contenedor entre público y privado.

**Permisos:** Propietario o admin

### Casos de Uso Comunes

#### Admin: Ver todos los contenedores de un servidor
```bash
GET /containers/all?server_id=1
```

#### Admin: Ver todos los contenedores de un usuario
```bash
GET /containers/all?user_id=5
```

#### Admin: Ver solo contenedores en ejecución
```bash
GET /containers/all?status=running
```

#### Admin: Contenedores públicos en ejecución de un servidor
```bash
GET /containers/all?server_id=1&status=running&is_public=true
```

#### Usuario: Obtener mis contenedores
```bash
GET /containers/my
```

#### Usuario: Crear un contenedor estándar
```bash
POST /containers
Content-Type: application/json

{
  "name": "web-app",
  "server_id": 1,
  "image": "node:18-alpine",
  "ports": "4000:3000"
}
```

#### Usuario: Crear un contenedor Colab con GPU
```bash
POST /containers/colab
Authorization: Bearer {token}

# El sistema crea automáticamente:
# - Nombre: colab_{username}
# - GPU completa habilitada
# - Volúmenes del usuario mapeados
# - Puertos aleatorios asignados
```

### Estructura de la Base de Datos

La tabla `containers` tiene los siguientes campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | Integer | Primary Key |
| `name` | String(100) | Nombre del contenedor |
| `user_id` | Integer | Foreign Key → users.id |
| `server_id` | Integer | Foreign Key → servers.id |
| `image` | String(200) | Imagen Docker (ej: nginx:latest) |
| `ports` | String(100) | Mapeo de puertos (ej: 80:8080) |
| `status` | String(20) | Estado: running, stopped, error, creating |
| `is_public` | Boolean | Visibilidad pública |
| `container_id` | String(100) | ID del contenedor Docker (nullable) |
| `created_at` | DateTime | Fecha de creación |

### Notas Importantes

1. **Límite de contenedores**: Cada usuario puede crear máximo 1 contenedor por servidor
2. **Permisos**:
   - `/containers/all` requiere privilegios de administrador
   - Los demás endpoints son accesibles por usuarios normales según sus permisos
3. **Filtros combinables**: En `/containers/all` puedes combinar cualquier número de filtros
4. **Contenedores Colab**: Diseñados para GPU, con configuración especial para Machine Learning
5. **Estados posibles**: 
   - `stopped`: Contenedor detenido
   - `running`: Contenedor en ejecución
   - `error`: Error al iniciar/ejecutar
   - `creating`: En proceso de creación
6. **Puertos mínimos**: Los puertos del host deben ser >= 4000 (no se permiten puertos privilegiados)
7. **✅ IMPLEMENTADO**: Integración completa con Docker API vía SSH. Todas las operaciones (create, start, stop, delete) ejecutan comandos Docker reales en los servidores remotos.

### Ejemplo Completo de Flujo

```bash
# 1. Login
TOKEN=$(curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  | jq -r '.access_token')

# 2. Crear un contenedor Colab con GPU
curl -X POST http://localhost:8000/containers/colab \
  -H "Authorization: Bearer $TOKEN"

# O crear un contenedor estándar
curl -X POST http://localhost:8000/containers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-server",
    "server_id": 1,
    "image": "nginx:latest",
    "ports": "8080:80"
  }'

# 3. Listar mis contenedores
curl -X GET http://localhost:8000/containers/my \
  -H "Authorization: Bearer $TOKEN"

# 4. Iniciar el contenedor (ID 1)
curl -X POST http://localhost:8000/containers/1/start \
  -H "Authorization: Bearer $TOKEN"

# 5. [ADMIN] Ver todos los contenedores en ejecución
curl -X GET "http://localhost:8000/containers/all?status=running" \
  -H "Authorization: Bearer $TOKEN"

# 6. Hacer público el contenedor
curl -X POST http://localhost:8000/containers/1/toggle-public \
  -H "Authorization: Bearer $TOKEN"

# 7. Detener el contenedor
curl -X POST http://localhost:8000/containers/1/stop \
  -H "Authorization: Bearer $TOKEN"

# 8. Eliminar el contenedor
curl -X DELETE http://localhost:8000/containers/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Frontend

La página de gestión de contenedores para administradores está disponible en:
- **URL**: `/dashboard/containers`
- **Acceso**: Solo administradores
- **Características**:
  - Panel de filtros con 4 opciones (servidor, estado, visibilidad, usuario)
  - Tabla interactiva con acciones (iniciar, detener, eliminar)
  - Estadísticas en tiempo real (total, en ejecución, detenidos, públicos)
  - Actualización automática al aplicar filtros

---

## 🔧 Arquitectura de Docker Remoto

### Comunicación SSH + Docker

```
┌─────────────────────┐
│   Backend FastAPI   │
│  (Centralizado)     │
└──────────┬──────────┘
           │
           │ SSH (con claves)
           │
     ┌─────┴─────┬──────────┬────────────┐
     │           │          │            │
┌────▼────┐ ┌───▼───┐ ┌────▼────┐ ┌────▼────┐
│Server 1 │ │Server2│ │Server 3 │ │Server N │
│ Docker  │ │Docker │ │ Docker  │ │ Docker  │
└─────────┘ └───────┘ └─────────┘ └─────────┘
```

### Componentes Implementados

1. **`docker_remote.py`** - Manager principal
   - Clase `DockerRemoteManager` para ejecutar comandos Docker vía SSH
   - Manejo de conexiones SSH con claves privadas
   - Métodos: create, start, stop, remove, status, logs
   - Manejo de errores específicos por tipo

2. **`docker_validators.py`** - Validadores
   - Validación de nombres de contenedores
   - Validación de imágenes Docker
   - Validación de puertos (formato y rangos)
   - Validación de volúmenes
   - Whitelist de imágenes (seguridad opcional)

3. **CRUD con Docker** - `containers.py`
   - `create_container_with_docker()` - Crea en Docker + BD
   - `start_container_with_docker()` - Inicia contenedor real
   - `stop_container_with_docker()` - Detiene contenedor real
   - `delete_container_with_docker()` - Elimina de Docker + BD
   - `sync_container_status()` - Sincroniza estado desde Docker

### Flujo de Creación de Contenedor

```python
1. Usuario hace POST /containers
2. Backend valida permisos y límites
3. Se validan datos (nombre, imagen, puertos)
4. Se crea registro en BD con status="creating"
5. Se conecta vía SSH al servidor remoto
6. Se ejecuta: docker run -d --name {name} -p {ports} {image}
7. Se captura container_id de Docker
8. Se actualiza BD: container_id + status="running"
9. Se retorna respuesta al usuario
```

### Errores Manejados

| Error | HTTP Status | Descripción |
|-------|-------------|-------------|
| `DockerValidationError` | 400 | Datos inválidos (nombre, puertos, etc.) |
| `DockerConnectionError` | 503 | No se puede conectar al servidor |
| `DockerImageNotFoundError` | 404 | Imagen no existe en Docker Hub |
| `DockerPortConflictError` | 409 | Puerto ya está en uso |
| `DockerContainerNotFoundError` | 404 | Contenedor no existe en Docker |
| `DockerRemoteError` | 500 | Error general de Docker |

### Endpoint de Diagnóstico

**GET** `/containers/server/{server_id}/docker-status`

Verifica si Docker está instalado y corriendo en un servidor.

**Respuesta:**
```json
{
  "success": true,
  "server_id": 1,
  "server_name": "Servidor Principal",
  "ssh_configured": true,
  "docker_installed": true,
  "docker_running": true,
  "docker_version": "Docker version 24.0.6, build ed223bc",
  "daemon_info": "Docker daemon is running",
  "error": null
}
```

### Validaciones de Seguridad

1. **Nombres de contenedores**: Solo alfanuméricos, guiones y guiones bajos
2. **Puertos**: No se permiten puertos < 4000 en host (política de seguridad)
3. **Imágenes**: Validación de formato, whitelist opcional
4. **Límite de contenedores**: 1 por usuario por servidor
5. **SSH**: Validación de claves SSH antes de ejecutar comandos
6. **Restart policy**: Siempre `unless-stopped` (no se pueden crear contenedores que se reinicien en cada boot sin control)
7. **Contenedores Colab**: Requieren privilegios especiales y GPU - solo para usuarios autorizados

### Pre-requisitos en Servidores

Para que funcione la integración, cada servidor debe tener:

1. ✅ **SSH configurado** (automático al registrar servidor)
2. ✅ **Docker instalado**:
   ```bash
   # Instalar Docker en Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Agregar usuario al grupo docker
   sudo usermod -aG docker $USER
   ```
3. ✅ **Docker daemon corriendo**:
   ```bash
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

### Verificar Estado de Docker

Antes de crear contenedores, puedes verificar el estado:

```bash
# Verificar Docker en servidor ID 1
curl -X GET "http://localhost:8000/containers/server/1/docker-status" \
  -H "Authorization: Bearer {token}"
```

---

## 🎮 Contenedores Colab con GPU

### Características Especiales

Los contenedores Colab están optimizados para Machine Learning y cómputo GPU:

**Comando Docker ejecutado:**
```bash
docker run -d --shm-size=45g --gpus=all --pid=host --privileged -P \
  -v "/media:/media":ro \
  -v "/mnt:/mnt":ro \
  -v "/home/{username}:/home/{username}" \
  --name=colab_{username} \
  us-docker.pkg.dev/colab-images/public/runtime:latest
```

**Recursos:**
- 🎮 GPU completa (`--gpus=all`)
- 💾 45GB de memoria compartida (`--shm-size=45g`)
- 🔓 Privilegios completos (`--privileged`)
- 🌐 Puertos aleatorios (`-P`)
- 📁 Acceso a volúmenes del usuario

**Puertos asignados automáticamente:**
- Jupyter Notebook (típicamente 8888)
- TensorBoard (típicamente 6006)
- Otros servicios según necesidad

**Uso:**
```bash
# Crear contenedor Colab
curl -X POST "http://localhost:8000/containers/colab" \
  -H "Authorization: Bearer $TOKEN"

# El sistema retorna los puertos asignados
# Ejemplo: "8888/tcp:32768, 6006/tcp:32769"
# Acceder vía: http://server-ip:32768
```

**Casos de uso:**
- Entrenamiento de modelos de ML/DL
- Jupyter Notebooks con GPU
- TensorFlow, PyTorch, JAX
- Procesamiento de imágenes/video
- Computación científica


## 🗑️ Soft Delete de Playbooks

El sistema implementa **soft delete** para playbooks de Ansible, preservando el historial de ejecuciones.

### Migración de Base de Datos

Aplicar los cambios necesarios en la BD:

```bash
# Desde el directorio raíz del proyecto
./apply_soft_delete_migration.sh

# O manualmente
docker exec -i postgres_container psql -U user -d db < server/migrations/add_soft_delete_to_ansible_tasks.sql
```

**Cambios aplicados:**
- Columna `is_active` (Boolean, default TRUE)
- Columna `deleted_at` (Timestamp, nullable)
- Índice en `is_active` para performance

### Comportamiento

**Antes (Hard Delete):**
```
DELETE /playbooks/1 → Playbook borrado físicamente
                    → Ejecuciones huérfanas ❌
```

**Ahora (Soft Delete):**
```
DELETE /playbooks/1 → is_active = False, deleted_at = now()
                    → Historial preservado ✅
                    → Puede restaurarse ✅
```

### Ejemplos de Uso

```python
# Eliminar playbook (soft delete)
DELETE /api/ansible/playbooks/1
→ {"deleted": true, "message": "Playbook marked as deleted (soft delete)"}

# Listar playbooks activos (default)
GET /api/ansible/playbooks
→ [{"id": 2, "name": "deploy", "is_active": true, ...}]

# Listar playbooks eliminados
GET /api/ansible/playbooks/deleted
→ [{"id": 1, "name": "old_task", "is_active": false, "deleted_at": "2025-01-15T10:30:00Z"}]

# Restaurar playbook
POST /api/ansible/playbooks/1/restore
→ {"id": 1, "name": "old_task", "is_active": true, "deleted_at": null}
```

### Funciones CRUD

Todas las funciones de lectura filtran por `is_active` por defecto:

```python
from server.CRUD.ansible import (
    get_all_tasks,           # Solo activos
    get_task_by_id,          # Solo activos
    delete_task,             # Soft delete
    restore_task,            # Restaurar eliminados
    get_deleted_tasks,       # Listar eliminados
    hard_delete_task,        # Borrado físico (no recomendado)
)

# Incluir eliminados manualmente
task = get_task_by_id(db, task_id, include_deleted=True)
```

### Ventajas

- ✅ **Historial completo**: Todas las ejecuciones se mantienen
- ✅ **Auditoría**: Saber qué se eliminó y cuándo
- ✅ **Recuperación**: Errores son reversibles
- ✅ **Integridad**: No rompe Foreign Keys

### Archivos Relacionados

- Migración SQL: `server/migrations/add_soft_delete_to_ansible_tasks.sql`
- Modelo: `server/models/models.py` (AnsibleTask)
- CRUD: `server/CRUD/ansible.py`
- Router: `server/router/ansible.py`
