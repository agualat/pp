# Infrastructure Management Platform

Sistema completo de gestión de infraestructura con monitoreo en tiempo real, ejecución de playbooks Ansible y gestión centralizada de usuarios con autenticación SSH respaldada por PostgreSQL.

## 🚀 Características Principales

- 🖥️ **Gestión de Servidores**: Registro y monitoreo de servidores remotos
- 📊 **Métricas en Tiempo Real**: CPU, memoria, disco y GPU vía WebSocket
- ⚙️ **Ansible Integration**: Ejecución de playbooks con inventario dinámico
- 👥 **Gestión de Usuarios**: CRUD completo con carga masiva CSV/TXT
- 🔐 **Autenticación SSH Unificada**: Login con PostgreSQL para todos los servidores
- 🌐 **Dashboard Web**: Interfaz moderna con Next.js y Tailwind CSS
- 🔄 **Replicación en Tiempo Real**: Cambios de usuarios sincronizados instantáneamente a todos los clientes

## 🛠️ Stack Tecnológico

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, Celery
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Automation**: Ansible con inventario dinámico
- **Monitoring**: WebSocket para métricas en tiempo real
- **Authentication**: JWT + SSH con NSS/PAM PostgreSQL

## 📦 Inicio Rápido

### 1. Configurar entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 2. Iniciar servicios

```bash
docker compose up -d
```

### 3. Acceder al sistema

- **Frontend**: http://localhost:3000
- **API Server**: http://localhost:8000/docs
- **Client API**: http://localhost:8100/docs

**Usuario por defecto**: `admin` / `admin123` (cambiar en producción)

### 4. Configurar SSH Authentication (opcional)

Para permitir que los usuarios de PostgreSQL puedan hacer SSH a los servidores:

```bash
# En cada servidor host
sudo bash setup_auth_complete.sh
```

Ver [SETUP_SSH_AUTH.md](SETUP_SSH_AUTH.md) para más detalles.

## 📁 Estructura del Proyecto

```
├── server/          # Backend API (FastAPI)
├── client/          # Cliente de monitoreo
├── frontend/        # Dashboard web (Next.js)
├── docker-compose.yml
└── setup_auth_complete.sh  # Setup SSH automático
```

## 🔑 Gestión de Usuarios

### Crear usuario individual
Dashboard → Users → Create User

### Carga masiva (CSV/TXT)
Dashboard → Users → Bulk Upload

**Formato CSV**:
```csv
username
juan
maria
pedro
```

**Formato TXT**:
```
juan
maria
pedro
```

**Características:**
- **Normalización automática**: Los usernames se convierten a minúsculas y se validan automáticamente
- **Sincronización en tiempo real**: Los cambios se replican inmediatamente a todos los clientes
- Email: `{username}@estud.usfq.edu.ec`
- Password: `{username}2025`
- UID: Auto-incrementado desde 2000

### 🔄 Sistema de Replicación en Tiempo Real

El sistema replica automáticamente **cualquier cambio** en la tabla de usuarios a todos los clientes registrados:

#### Eventos que disparan sincronización:
- ✅ Creación de usuarios (individual o masiva)
- ✅ Actualización de usuarios
- ✅ Cambio de contraseña
- ✅ Activación/desactivación de usuarios
- ✅ Cambio de permisos de administrador
- ✅ Eliminación de usuarios

#### Sincronización Manual (si es necesario):

```bash
# Endpoint del servidor (requiere autenticación)
curl -X POST http://localhost:8000/sync/users/manual \
  -H "Authorization: Bearer {token}"
```

#### Verificar sincronización:

```bash
# Ver usuarios en servidor central
docker compose exec db psql -U postgres -d mydb \
  -c "SELECT username, system_uid FROM users ORDER BY username;"

# Ver usuarios en cliente
docker compose exec client_db psql -U postgres -d mydb \
  -c "SELECT username, system_uid FROM users ORDER BY username;"
```

#### Arquitectura de Sincronización:

```
Usuario crea/modifica usuario
        ↓
  BD Central actualizada
        ↓
_trigger_user_sync() automático
        ↓
Lista completa de usuarios
        ↓
HTTP POST en paralelo a todos los clientes
        ↓
Cliente recibe y actualiza BD local
        ↓
Regenera /etc/passwd y /etc/shadow
```

**Ventajas:**
- ⚡ **Inmediato**: Cambios visibles en 2-3 segundos
- 🔄 **Consistente**: Envía lista completa para garantizar sincronización
- 🚀 **Escalable**: Sincroniza con múltiples clientes en paralelo
- 💪 **Resiliente**: Fallos no afectan la operación principal

### Autenticación SSH

Una vez configurado (ver SETUP_SSH_AUTH.md), los usuarios pueden hacer SSH:

```bash
ssh juan@servidor.com  # Password: juan2025
```

## 📊 Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend   │────▶│  API Server  │────▶│  PostgreSQL │
│  (Next.js)  │     │   (FastAPI)  │     │   (Central) │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                     │
                           ▼                     │
                    ┌──────────────┐            │
                    │Celery Worker │            │
                    │  (Ansible)   │            │
                    └──────────────┘            │
                                                 │
                                     Sync Real-time (HTTP POST)
                                                 │
┌─────────────┐     ┌──────────────┐            │
│   Metrics   │────▶│  Client API  │            │
│   Client    │     │   (FastAPI)  │            │
└─────────────┘     └──────────────┘            │
                           │                     │
                           ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  Client DB   │◀────│  Sync POST  │
                    │  (Replica)   │     │/api/sync/   │
                    └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  SSH Auth    │
                    │(NSS/PAM Host)│
                    └──────────────┘
```

## 🔧 Comandos Útiles

```bash
# Ver logs
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f client

# Reiniciar servicios
docker compose restart api

# Acceder a la base de datos central
docker compose exec db psql -U postgres -d mydb

# Acceder a la base de datos del cliente
docker compose exec client_db psql -U postgres -d mydb

# Ver usuarios en el servidor central
docker compose exec db psql -U postgres -d mydb -c "SELECT username, system_uid, is_active FROM users;"

# Ver usuarios en el cliente
docker compose exec client_db psql -U postgres -d mydb -c "SELECT username, system_uid, is_active FROM users;"

# Forzar sincronización manual de usuarios
curl -X POST http://localhost:8000/sync/users/manual \
  -H "Authorization: Bearer {token}"

# Probar sistema de sincronización completo
./test_sync.sh
```

## 📚 Documentación Adicional

- [Server README](server/README.md) - Backend API
- [Client README](client/README.md) - Cliente de monitoreo
- [Frontend README](frontend/README.md) - Dashboard web
- [SETUP_SSH_AUTH.md](SETUP_SSH_AUTH.md) - Configuración SSH completa
- [SYNC_SYSTEM.md](SYNC_SYSTEM.md) - Sistema de replicación en tiempo real (detalles técnicos)

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con bcrypt
- ✅ Autenticación JWT para API
- ✅ SSH con verificación contra PostgreSQL
- ✅ Puerto 5433 solo accesible desde localhost
- ⚠️ Cambiar credenciales por defecto en producción

## 📄 Licencia

MIT
