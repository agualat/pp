# Cliente Standalone - Guía de Instalación

Este documento explica cómo instalar y configurar **solo el cliente** en un servidor remoto, conectándolo a un servidor central existente.

## 📋 Requisitos Previos

- Docker y Docker Compose instalados
- Acceso de red al servidor central (puerto 8000)
- Permisos de sudo (para configurar NSS/PAM en el host)

## 🚀 Instalación Rápida

### 1. Copiar archivos necesarios al servidor

En el servidor remoto, crear directorio y copiar los siguientes archivos:

```bash
mkdir -p /opt/pp-client
cd /opt/pp-client
```

Copiar estos archivos desde el repositorio principal:
- `client/` (todo el directorio)
- `docker-compose.client.yml`
- `.env.client` → renombrar a `.env`
- `setup_nss_auto.sh` (para configuración de SSH)

O clonar el repositorio:

```bash
git clone https://github.com/agualat/pp.git
cd pp
```

### 2. Configurar variables de entorno

Editar el archivo `.env.client` (o crear `.env` basado en él):

```bash
# Copiar y editar
cp .env.client .env
nano .env
```

**Variables críticas a configurar:**

```bash
# ⚠️ CAMBIAR: IP o dominio del servidor central
SERVER_HOST=192.168.1.100  # IP/dominio del servidor central
SERVER_PORT=8000

# Base de datos local (dejar por defecto)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
DB_HOST=client_db
DB_PORT=5432
```

**Notas importantes:**
- ❌ **Ya no se usa conexión directa a la BD central** (variables `CENTRAL_DB_*` eliminadas)
- ✅ **Sincronización automática vía API HTTP** cuando el servidor te registra
- ✅ **Actualizaciones en tiempo real** cuando se modifican usuarios

### 3. Iniciar el cliente

```bash
# Si estás en el directorio raíz del repositorio
docker compose -f docker-compose.client.yml up -d

# O si renombraste el archivo
docker compose up -d
```

### 4. Registrar el cliente en el servidor central

**Importante:** Los clientes ya **no se auto-registran**. Debes registrar el servidor manualmente desde el dashboard o API:

#### Opción A: Desde el Dashboard (recomendado)
1. Acceder a `http://{servidor-central}:3000/dashboard/servers`
2. Click en "Agregar Servidor"
3. Completar:
   - **Nombre**: nombre descriptivo (ej: `cliente-prod-01`)
   - **IP**: IP del servidor donde está el cliente (ej: `192.168.1.100`)
   - **Usuario SSH**: usuario con acceso (ej: `root`)
   - **Contraseña SSH**: contraseña temporal para desplegar clave SSH

#### Opción B: Desde la API
```bash
curl -X POST http://{servidor-central}:8000/servers/ \
Si quieres que los usuarios de PostgreSQL puedan hacer SSH a este servidor:

```bash
# Desde el HOST (no desde Docker)
sudo bash setup_nss_auto.sh
```

Este script **automáticamente**:
- ✅ Detecta la configuración del docker-compose
- ✅ Instala paquetes necesarios (`libnss-extrausers`, `postgresql-client`)
- ✅ Configura NSS/PAM para autenticación con PostgreSQL
- ✅ Crea un timer systemd para sincronizar usuarios cada 2 minutos
- ✅ Configura SSH para usar la autenticación

**Resultado:** Los usuarios pueden hacer SSH usando sus credenciales de la base de datos.

```bash
# Probar login SSH
ssh usuario@localhost
# Password: el configurado en la base de datos
```
1. ✅ El servidor sincroniza **automáticamente** todos los usuarios al cliente
2. ✅ Futuras modificaciones de usuarios se sincronizan en **tiempo real**
3. ✅ Los usuarios pueden hacer SSH al servidor cliente inmediatamente

### 5. Verificar que está funcionando

```bash
# Ver logs del cliente
docker compose logs -f client

# Verificar usuarios sincronizados
docker compose exec client_db psql -U postgres -d postgres \
  -c "SELECT username, system_uid FROM users ORDER BY username;"
```

### 6. Configurar NSS/PAM (para autenticación SSH)

Si quieres que los usuarios puedan hacer SSH a este servidor:

## 📊 Verificación

### Comprobar conexión al servidor central

```bash
curl http://localhost:8100/
# Debe devolver: {"hello": "client"}
```

### Verificar usuarios sincronizados

```bash
# Ver usuarios en la BD local
docker compose exec client_db psql -U postgres -d postgres \
  -c "SELECT id, username, email, system_uid FROM users ORDER BY username;"
```

### Verificar sincronización en tiempo real

**En el servidor central**, crear un usuario desde el dashboard o API:

Desde el dashboard: `/dashboard/users` → "Crear Usuario"

O desde la API:
```bash
curl -X POST http://{servidor-central}:8000/users/ \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@test.com", "password": "test123"}'
```

**En el servidor cliente**, verificar que se replicó instantáneamente:
```bash
docker compose exec client_db psql -U postgres -d postgres \
  -c "SELECT username FROM users WHERE username = 'testuser';"
```

✅ Debería aparecer inmediatamente (sincronización en tiempo real vía API HTTP)H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@test.com", "password": "test123"}'
```

En el cliente, verificar que se replicó (esperar 2-3 segundos):
```bash
# En el servidor cliente
docker compose exec client_db psql -U postgres -d mydb \
  -c "SELECT username FROM users WHERE username = 'testuser';"
```

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
docker compose logs -f client

# Reiniciar cliente
docker compose restart client

# Detener todo
docker compose down

# Ver estado de los contenedores
docker compose ps

# Acceder a la base de datos local
```bash
# En .env
POSTGRES_PASSWORD=contraseña_segura_aquí
```

### 2. Firewall

Solo necesitas abrir el puerto 8100 para el servidor central:

```bash
# Permitir solo desde el servidor central
sudo ufw allow from {IP_SERVIDOR_CENTRAL} to any port 8100

# Puerto 5433 solo si usas NSS/PAM desde el host
sudo ufw allow 5433/tcp
```

### 3. HTTPS (recomendado para producción)

Si el servidor central usa HTTPS:

```bash
# En .env
SERVER_HOST=https://api.ejemplo.com
SERVER_PORT=443
```bash
sudo ufw allow from {IP_SERVIDOR_CENTRAL} to any port 8100
sudo ufw allow 5433/tcp  # Solo si necesitas NSS/PAM desde el host
```

### 3. SSL/TLS (recomendado)

Para producción, configurar HTTPS en el servidor central y actualizar:

```bash
SERVER_HOST=https://api.ejemplo.com
```

## 🐛 Troubleshooting

### El cliente no se conecta al servidor

```bash
# Verificar conectividad
ping {IP_SERVIDOR_CENTRAL}
curl http://{IP_SERVIDOR_CENTRAL}:8000/
### Los usuarios no se sincronizan

```bash
# 1. Verificar que el servidor esté registrado en el central
#    Desde el dashboard: http://{servidor-central}:3000/dashboard/servers
#    Debe aparecer el servidor con status "online"

# 2. Verificar endpoint de sincronización del cliente
curl -X POST http://localhost:8100/api/sync/users \
  -H "Content-Type: application/json" \
  -d '[{"id":1,"username":"admin","email":"admin@test.com","password_hash":"$2b$12$...","is_admin":1,"is_active":1,"system_uid":2000,"system_gid":2000,"ssh_public_key":null,"created_at":"2024-01-01T00:00:00"}]'

# 3. Forzar sincronización manual desde el servidor central
#    Desde el dashboard: /dashboard/servers → botón "Sincronizar"
#    O desde la API:
curl -X POST http://{servidor-central}:8000/sync/users/manual \
  -H "Authorization: Bearer {token}"
```
# Verificar endpoint de sincronización del cliente
curl -X POST http://localhost:8100/api/sync/users \
  -H "Content-Type: application/json" \
  -d '[]'
```

### Base de datos no arranca

```bash
# Ver logs de PostgreSQL
## 📝 Arquitectura del Cliente

```
┌─────────────────────┐
│  Servidor Central   │
│    (FastAPI)        │
│  - Dashboard Web    │
│  - Gestión Usuarios │
└─────────┬───────────┘
          │
          │ HTTP POST /api/sync/users
          │ (Sincronización automática)
          │
          ▼
    ┌─────────────┐
    │   Cliente   │
    │  (FastAPI)  │
    │  Port: 8100 │
    └──────┬──────┘
           │
           ▼
    ┌──────────────┐
    │  Client DB   │
    │ (PostgreSQL) │
    │  Port: 5433  │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  NSS/PAM     │
## 📚 Más Información

- [README principal](README.md) - Documentación completa del sistema
- [SETUP_SSH_AUTH.md](SETUP_SSH_AUTH.md) - Configuración detallada de SSH (legacy)
- `setup_nss_auto.sh` - Script automatizado de configuración SSH
- [Client README](client/README.md) - Detalles técnicos del cliente

## 🔄 Cambios Recientes

### ✨ Mejoras implementadas:
- ✅ **Sincronización automática vía API**: Ya no se requiere acceso directo a la BD central
- ✅ **Actualizaciones en tiempo real**: Los cambios se propagan instantáneamente
- ✅ **Setup automático**: `setup_nss_auto.sh` detecta todo automáticamente
- ✅ **Sin auto-registro**: Mayor control - debes registrar servidores manualmente
- ❌ **WebSocket eliminado**: Las métricas ahora se integran con Grafana

### 🗑️ Funcionalidades removidas:
- Variables `CENTRAL_DB_*` (ya no se usa conexión directa a BD central)
- Auto-registro de clientes (ahora manual desde dashboard)
- WebSocket para métricas en tiempo real (usar Grafana)
**Flujo de sincronización:**
1. Modificas un usuario en el servidor central (dashboard/API)
2. El servidor **automáticamente** envía la actualización a todos los clientes registrados
3. El cliente recibe y actualiza su BD local
4. NSS/PAM en el host lee la BD local cada 2 minutos
5. Los usuarios pueden hacer SSH inmediatamente

**Notas:**
- ❌ Ya no hay WebSocket para métricas en tiempo real (usar Grafana)
- ✅ Sincronización de usuarios es automática e instantánea vía HTTP
- ✅ No se requiere acceso directo a la BD central ┌──────────────┐
    │  Client DB   │
    │ (PostgreSQL) │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  NSS/PAM     │
    │  (SSH Auth)  │
    └──────────────┘
```

## 📚 Más Información

- [README principal](README.md) - Documentación completa del sistema
- [SETUP_SSH_AUTH.md](SETUP_SSH_AUTH.md) - Configuración detallada de SSH
- [Client README](client/README.md) - Detalles técnicos del cliente
