# Infrastructure Management Platform

Sistema completo de gestión de infraestructura con monitoreo en tiempo real, ejecución de playbooks Ansible y gestión centralizada de usuarios con autenticación SSH respaldada por PostgreSQL.

## 🚀 Características Principales

- 🖥️ **Gestión de Servidores**: Registro y monitoreo de servidores remotos
- 📊 **Métricas en Tiempo Real**: CPU, memoria, disco y GPU vía WebSocket
- ⚙️ **Ansible Integration**: Ejecución de playbooks con inventario dinámico
- 👥 **Gestión de Usuarios**: CRUD completo con carga masiva CSV/TXT
- 🔐 **Autenticación SSH Unificada**: Login con PostgreSQL para todos los servidores
- 🌐 **Dashboard Web**: Interfaz moderna con Next.js y Tailwind CSS
- 🔄 **Sincronización Automática**: Usuarios replicados cada 2 minutos

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

Los usuarios creados tendrán:
- Email: `{username}@estud.usfq.edu.ec`
- Password: `{username}2025`
- UID: Auto-incrementado desde 2000

### Autenticación SSH

Una vez configurado (ver SETUP_SSH_AUTH.md), los usuarios pueden hacer SSH:

```bash
ssh juan@servidor.com  # Password: juan2025
```

## 📊 Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend   │────▶│  API Server  │────▶│  PostgreSQL │
│  (Next.js)  │     │   (FastAPI)  │     │   (Users)   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                     │
                           ▼                     │
                    ┌──────────────┐            │
                    │Celery Worker │            │
                    │  (Ansible)   │            │
                    └──────────────┘            │
                                                 │
┌─────────────┐     ┌──────────────┐            │
│   Metrics   │────▶│  Client DB   │◀───────────┘
│   Client    │     │  (Replica)   │   Sync 2min
└─────────────┘     └──────────────┘
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
docker compose logs -f server
docker compose logs -f frontend

# Reiniciar servicios
docker compose restart server

# Acceder a la base de datos
docker compose exec db psql -U postgres -d mydb

# Ver usuarios
docker compose exec db psql -U postgres -d mydb -c "SELECT username, system_uid, is_active FROM users;"

# Forzar sincronización de usuarios
docker compose exec client python3 /app/client/utils/replicate_db.py
```

## 📚 Documentación Adicional

- [Server README](server/README.md) - Backend API
- [Client README](client/README.md) - Cliente de monitoreo
- [Frontend README](frontend/README.md) - Dashboard web
- [SETUP_SSH_AUTH.md](SETUP_SSH_AUTH.md) - Configuración SSH

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con bcrypt
- ✅ Autenticación JWT para API
- ✅ SSH con verificación contra PostgreSQL
- ✅ Puerto 5433 solo accesible desde localhost
- ⚠️ Cambiar credenciales por defecto en producción

## 📄 Licencia

MIT
