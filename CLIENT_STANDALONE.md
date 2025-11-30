# Cliente Standalone - Guía de Instalación

Este documento explica cómo instalar y configurar **solo el cliente** en un servidor remoto, conectándolo a un servidor central existente.

## 📋 Requisitos Previos

- Docker y Docker Compose instalados
- Acceso de red al servidor central (puertos 8000 y 5432)
- Permisos de sudo (para configurar NSS/PAM)

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
# IP o dominio del servidor central
SERVER_HOST=192.168.1.100  # Cambiar por la IP real del servidor central
SERVER_PORT=8000

# Conexión a la base de datos central (para sincronización inicial)
CENTRAL_DB_HOST=192.168.1.100  # IP del servidor central
CENTRAL_DB_PORT=5432
CENTRAL_DB_NAME=mydb
CENTRAL_DB_USER=postgres
CENTRAL_DB_PASSWORD=postgres  # Usar la contraseña real

# Base de datos local (dejar por defecto)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=mydb
DB_HOST=client_db
DB_PORT=5432
```

### 3. Iniciar el cliente

```bash
# Si estás en el directorio raíz del repositorio
docker compose -f docker-compose.client.yml up -d

# O si renombraste el archivo
docker compose up -d
```

### 4. Verificar que está funcionando

```bash
# Ver logs
docker compose logs -f client

# Verificar que se conectó al servidor central
docker compose logs client | grep "registered"

# Verificar usuarios replicados
docker compose exec client_db psql -U postgres -d mydb \
  -c "SELECT username, system_uid FROM users;"
```

### 5. Configurar NSS/PAM (opcional, para SSH)

Si quieres que los usuarios puedan hacer SSH a este servidor:

```bash
# Desde el host (no desde Docker)
sudo bash setup_auth_complete.sh
```

Esto configurará:
- NSS (Name Service Switch) para usuarios de PostgreSQL
- PAM (Pluggable Authentication Modules) para autenticación SSH
- Creación automática de home directories

## 📊 Verificación

### Comprobar conexión al servidor central

```bash
curl http://localhost:8100/
# Debe devolver: {"hello": "client"}

# Ver métricas que se están enviando
docker compose logs client | grep "Metric"
```

### Verificar usuarios sincronizados

```bash
# Ver usuarios en la BD local
docker compose exec client_db psql -U postgres -d mydb \
  -c "SELECT id, username, email, system_uid FROM users ORDER BY username;"
```

### Verificar sincronización en tiempo real

En el servidor central, crear un usuario:
```bash
# En el servidor central
curl -X POST http://localhost:8000/users/ \
  -H "Authorization: Bearer {token}" \
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
docker compose exec client_db psql -U postgres -d mydb

# Forzar sincronización manual (desde el servidor central)
curl -X POST http://{servidor-central}:8000/sync/users/manual \
  -H "Authorization: Bearer {token}"
```

## 🔒 Seguridad en Producción

### 1. Cambiar contraseñas por defecto

```bash
# En .env
POSTGRES_PASSWORD=contraseña_segura_aquí
CENTRAL_DB_PASSWORD=contraseña_del_servidor_central
```

### 2. Firewall

Asegurarse de que solo el servidor central pueda acceder al puerto 8100:

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

# Ver logs de error
docker compose logs client | grep -i error
```

### Los usuarios no se sincronizan

```bash
# Verificar que el cliente esté registrado en el servidor central
# En el servidor central:
docker compose exec db psql -U postgres -d mydb \
  -c "SELECT id, name, ip_address, status FROM servers;"

# Verificar endpoint de sincronización del cliente
curl -X POST http://localhost:8100/api/sync/users \
  -H "Content-Type: application/json" \
  -d '[]'
```

### Base de datos no arranca

```bash
# Ver logs de PostgreSQL
docker compose logs client_db

# Verificar permisos de volúmenes
docker volume inspect pp-client_client_db_data

# Recrear base de datos (⚠️ borra todos los datos)
docker compose down -v
docker compose up -d
```

## 📝 Arquitectura del Cliente

```
┌─────────────────────┐
│  Servidor Central   │
│    (FastAPI)        │
└─────────┬───────────┘
          │ HTTP
          │ WebSocket (Metrics)
          │ HTTP POST (Sync)
          ▼
    ┌─────────────┐
    │   Cliente   │
    │  (FastAPI)  │
    └──────┬──────┘
           │
           ▼
    ┌──────────────┐
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
