# Infrastructure Management Platform

Sistema completo de gestión de infraestructura con monitoreo en tiempo real, ejecución de playbooks Ansible y gestión centralizada de usuarios con autenticación SSH respaldada por PostgreSQL.

## 🚀 Características Principales

- 🖥️ **Gestión de Servidores**: Registro y monitoreo de servidores remotos
- 📊 **Métricas en Tiempo Real**: CPU, memoria, disco y GPU vía WebSocket
  - Dashboard actualizado en vivo cada 5 segundos
  - Indicador visual de conexión WebSocket
  - Historial de métricas almacenado
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
# En cada servidor host (funciona incluso con tabla users vacía)
sudo bash setup_nss_auto.sh
```

**Características del script:**
- ✅ **Funciona con tabla vacía**: No requiere usuarios existentes
- ✅ **Sincronización automática**: Timer systemd cada 2 minutos
- ✅ **Auto-configuración**: Detecta puertos y configuración automáticamente
- ✅ **NSS/PAM Setup**: Configura autenticación completa
- ✅ **Cambio de contraseña SSH**: Los usuarios pueden cambiar su contraseña via `passwd` y se sincroniza automáticamente a todos los servidores
- ✅ **Permisos Docker**: Usuarios tienen acceso a Docker automáticamente (sin sudo)

## 📁 Estructura del Proyecto

```
├── server/                  # Backend API (FastAPI)
├── client/                  # Cliente de monitoreo
├── frontend/                # Dashboard web (Next.js)
├── playbooks/               # Playbooks Ansible
├── ssh_keys/                # Claves SSH de servidores
├── docker-compose.yml       # Servicios principales
├── docker-compose.client.yml # Cliente standalone
├── setup_nss_auto.sh        # Setup SSH automático mejorado
├── test_sync.sh             # Test de sincronización
└── system_status.json       # Estado del sistema
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
- **Cambio de contraseña obligatorio**: Usuarios creados masivamente deben cambiar su contraseña en el primer login SSH
- Email: `{username}@estud.usfq.edu.ec`
- Password inicial: `{username}2025`
- UID: Auto-incrementado desde 2000

### Cambio de Contraseña

Los usuarios creados masivamente deben cambiar su contraseña en el primer login:

```bash
ssh juan@servidor.com
Password: juan2025

$ passwd
Current password: juan2025
New password: MiNuevaContraseña123!
passwd: password updated successfully
✅ Password changed successfully and synced to all servers
```

**El cambio se propaga automáticamente** a todos los servidores del sistema.

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

Una vez configurado con `setup_nss_auto.sh`, los usuarios pueden hacer SSH a cualquier servidor:

```bash
ssh juan@servidor.com  # Password inicial: juan2025
```

**Configuración del Servidor Central:**

En el archivo `.env` del servidor, define la URL pública:

```bash
SERVER_URL=http://192.168.1.100:8000  # IP o dominio del servidor central
```

Esta URL se auto-configura en todos los clientes durante la primera sincronización, permitiendo que los cambios de contraseña se propaguen automáticamente.

## 🖥️ Cliente Standalone

Para ejecutar solo el cliente en un servidor remoto:

```bash
# 1. Copiar archivos necesarios
scp -r client/ docker-compose.client.yml .env.client usuario@servidor:~/

# 2. En el servidor remoto
cd ~/
mv .env.client .env
docker compose -f docker-compose.client.yml up -d

# 3. Configurar SSH (en el host)
sudo bash setup_nss_auto.sh
```

El cliente se auto-registrará y comenzará a enviar métricas al servidor central.

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

# Ver métricas en tiempo real del cliente
curl http://localhost:8100/metrics/local

# Verificar setup NSS/PAM en el host
sudo systemctl status pgsql-users-sync.timer
getent passwd  # Ver usuarios disponibles

# Verificar permisos Docker
sudo ./check_user_permissions.sh
```

## 🗑️ Soft Delete de Playbooks

El sistema implementa **soft delete** para playbooks de Ansible, permitiendo eliminar playbooks sin perder el historial de ejecuciones.

### Características

- ✅ **Historial preservado**: Las ejecuciones se mantienen intactas
- ✅ **Recuperación**: Playbooks eliminados pueden restaurarse
- ✅ **Auditoría**: Registro de cuándo y qué se eliminó
- ✅ **Integridad**: No rompe relaciones con ejecuciones

### Aplicar Migración

```bash
# Aplicar cambios en la base de datos
./apply_soft_delete_migration.sh
```

### Nuevos Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| DELETE | `/ansible/playbooks/{id}` | Soft delete de playbook |
| GET | `/ansible/playbooks/deleted` | Listar playbooks eliminados |
| POST | `/ansible/playbooks/{id}/restore` | Restaurar playbook |

### Uso en Frontend

```typescript
// Eliminar playbook (soft delete)
await fetch(`/api/ansible/playbooks/${id}`, { method: 'DELETE' });

// Listar eliminados
const deleted = await fetch('/api/ansible/playbooks/deleted').then(r => r.json());

// Restaurar playbook
await fetch(`/api/ansible/playbooks/${id}/restore`, { method: 'POST' });
```

Para más detalles, ver: `server/migrations/add_soft_delete_to_ansible_tasks.sql`

## 📚 Documentación Adicional

- [Server README](server/README.md) - Backend API
- [Client README](client/README.md) - Cliente de monitoreo  
- [Frontend README](frontend/README.md) - Dashboard web
- [Become Password Setup](BECOME_PASSWORD_SETUP.md) - Configuración de contraseñas sudo

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con bcrypt
- ✅ Autenticación JWT para API
- ✅ SSH con verificación contra PostgreSQL
- ✅ Puerto 5433 solo accesible desde localhost
- ⚠️ Cambiar credenciales por defecto en producción

## 📄 Licencia

MIT
