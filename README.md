# Proyecto PP - Sistema de Gestión de Servidores con Ansible

Sistema completo de gestión de servidores con monitoreo de métricas y ejecución de playbooks Ansible.

## 🚀 Inicio Rápido

### 1. Configuración del entorno

Copia el archivo de ejemplo y ajusta las variables:

```bash
cp .env.example .env
```

**⚠️ IMPORTANTE**: Cambia las credenciales del usuario administrador por defecto en producción.

### 2. Iniciar los servicios

```bash
docker-compose up -d
```

### 3. Acceder al sistema

#### Usuario Administrador por Defecto

Al inicializar la base de datos, se crea automáticamente un usuario administrador con estas credenciales:

- **Usuario**: `admin` (configurable con `DEFAULT_ADMIN_USERNAME`)
- **Email**: `admin@admin.com` (configurable con `DEFAULT_ADMIN_EMAIL`)
- **Contraseña**: `admin123` (configurable con `DEFAULT_ADMIN_PASSWORD`)

**🔒 Seguridad**: Cambia estas credenciales inmediatamente en producción usando las variables de entorno en el archivo `.env`.

#### URLs de acceso

- **API Server**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs
- **Client API**: http://localhost:8100
- **Client Docs**: http://localhost:8100/docs

## 📦 Servicios

### API Server (Puerto 8000)

Backend principal con:
- Autenticación JWT
- Gestión de usuarios
- Gestión de servidores
- Playbooks Ansible
- Historial de ejecuciones
- WebSocket para actualizaciones en tiempo real

### Client (Puerto 8100)

Cliente de monitoreo que:
- Recopila métricas del sistema (CPU, RAM, Disco, GPU)
- Envía métricas al servidor cada 5 segundos
- Proporciona API para consultar métricas locales
- WebSocket para métricas en tiempo real

### Worker (Celery)

Procesa tareas asíncronas:
- Ejecución de playbooks Ansible
- Tareas programadas

### Database (PostgreSQL)

Base de datos con:
- Usuarios y autenticación
- Servidores registrados
- Métricas históricas
- Playbooks y ejecuciones

## 🔐 Autenticación

### Login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

Respuesta:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### Uso del token

Incluye el token en el header `Authorization`:

```bash
curl http://localhost:8000/servers/ \
  -H "Authorization: Bearer <tu-token>"
```

## 🧪 Testing

Se incluyen scripts de testing para ambas APIs:

### Test Server API

```bash
bash test_server_api.sh
```

### Test Client API

```bash
bash test_client_api.sh
```

## 📝 Endpoints Principales

### Autenticación
- `POST /auth/signup` - Registrar nuevo usuario
- `POST /auth/login` - Iniciar sesión (solo admins)
- `GET /auth/verify` - Verificar token

### Servidores
- `POST /servers/` - Crear servidor
- `GET /servers/` - Listar servidores
- `GET /servers/{id}` - Obtener servidor
- `PUT /servers/{id}/online` - Marcar como online
- `DELETE /servers/{id}` - Eliminar servidor

### Playbooks Ansible
- `POST /ansible/playbooks` - Crear playbook
- `GET /ansible/playbooks` - Listar playbooks
- `POST /ansible/playbooks/{id}/run` - Ejecutar playbook

### Ejecuciones
- `GET /executions/` - Historial de ejecuciones
- `GET /executions/{id}` - Detalle de ejecución
- `GET /executions/by-state/{state}` - Filtrar por estado

### Métricas (Client)
- `GET /metrics/local` - Métricas detalladas del sistema
- `GET /metrics/server-format` - Métricas en formato compacto

## 🔧 Configuración Avanzada

### Variables de Entorno

Ver `.env.example` para todas las opciones disponibles.

### Cambiar credenciales del admin por defecto

Edita el archivo `.env`:

```env
DEFAULT_ADMIN_USERNAME=mi_admin
DEFAULT_ADMIN_EMAIL=admin@miempresa.com
DEFAULT_ADMIN_PASSWORD=contraseña_segura_123!
```

Luego reinicia los contenedores:

```bash
docker-compose down
docker-compose up -d
```

### Crear usuarios administradores adicionales

Una vez autenticado como admin, puedes crear más usuarios desde la API y luego promocionarlos a admin usando el endpoint correspondiente o directamente en la base de datos.

## 📊 Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  API Server  │────▶│  PostgreSQL │
│  (Metrics)  │     │   (FastAPI)  │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │Celery Worker │
                    │  (Ansible)   │
                    └──────────────┘
```

## 🛠️ Desarrollo

### Logs

Ver logs de un servicio específico:

```bash
docker-compose logs -f api
docker-compose logs -f client
docker-compose logs -f worker
```

### Reiniciar servicios

```bash
docker-compose restart api
docker-compose restart client
```

### Ejecutar comandos en el contenedor

```bash
docker-compose exec api bash
docker-compose exec db psql -U postgres -d mydb
```

## 📄 Licencia

[Tu licencia aquí]
