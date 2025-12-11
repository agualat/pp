# Client - Monitor y Replicación

Cliente que recolecta métricas del sistema y replica usuarios desde la base de datos central para autenticación SSH.

## Características

- 📊 Recolección de métricas (CPU, RAM, Disco, GPU)
- 🔄 Replicación de usuarios en tiempo real (HTTP POST)
- 🔌 WebSocket para transmisión de métricas en vivo
- 🐳 PostgreSQL local (client_db) para autenticación
- 📡 API REST para consultar métricas
- 🔄 Sincronización automática cada 5 segundos al servidor

## Componentes

### Metrics Sender
Envía métricas al servidor central cada 5 segundos:
- CPU usage (%) con detalles de cores
- RAM usage (%) con GB usados/totales
- Disk usage (%) por partición
- GPU usage, memoria y temperatura (NVIDIA si disponible)

### Database Replication
Recibe usuarios desde servidor central en tiempo real:
- **Push instantáneo** desde servidor vía HTTP POST a `/sync/users`
- **Auto-configuración**: Recibe y guarda la URL del servidor automáticamente
- TRUNCATE + INSERT para garantizar consistencia
- Solo usuarios activos (`is_active = 1`)
- Regenera archivos NSS/PAM automáticamente
- Captura cambios de contraseña vía PAM hook y los propaga al servidor central

### WebSocket Server
Transmite métricas en tiempo real al frontend:
- Endpoint: `ws://localhost:8100/ws/metrics/{server_id}`
- Actualización cada 5 segundos
- Formato JSON con todas las métricas del sistema

### API Local
Endpoints para consultar métricas locales:
- `GET /metrics/local` - Métricas detalladas
- `GET /metrics/server-format` - Formato compacto

## Estructura

```
client/
├── main.py                          # Entry point
├── dockerfile                       # Container build
├── entrypoint.sh                    # Container startup
├── init_db.sql                      # Database schema
├── requirements.txt                 # Python dependencies
├── router/
│   ├── __init__.py
│   ├── metrics.py                   # Metrics API endpoints
│   └── sync.py                      # User sync endpoint
├── models/
│   └── metrics.py                   # SQLAlchemy models
└── utils/
    ├── __init__.py
    ├── metrics.py                   # System metrics collection
    ├── generate_passwd_from_db.sh   # NSS passwd generator
    ├── generate_shadow_from_db.sh   # NSS shadow generator
    ├── nss-pgsql.conf.template      # NSS config template
    └── pam-pgsql.conf.template      # PAM config template
```

## Configuración

Variables de entorno requeridas:

```env
# Database Local
DB_HOST=client_db
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres

# Servidor Central (para enviar métricas)
SERVER_URL=http://api:8000
SERVER_ID=1

# Puerto API
PORT=8100
```

## Replicación de Usuarios (Push desde Servidor)

El sistema utiliza **sincronización push** en tiempo real:

### Flujo:
1. Usuario creado/modificado en servidor central
2. Servidor envía HTTP POST a `/sync/users` de todos los clientes
3. Cliente recibe lista completa de usuarios
4. TRUNCATE + INSERT para garantizar consistencia
5. Regenera automáticamente `/etc/passwd-pgsql` y `/var/lib/extrausers/shadow`

### Endpoint de Sincronización:
```bash
POST /sync/users
Content-Type: application/json

{
  "server_url": "http://192.168.1.100:8000",  # Auto-configuración
  "users": [
    {
      "username": "juan",
      "email": "juan@example.com",
      "password_hash": "$2b$12$...",
      "system_uid": 2000,
      "system_gid": 2000,
      "is_active": true,
      "is_admin": false,
      "must_change_password": 1
    }
  ]
}
```

Campos replicados:
- `username`, `email`, `password_hash`
- `is_admin`, `is_active`, `must_change_password`
- `system_uid`, `system_gid`
- `created_at`

### Auto-configuración de SERVER_URL:
El cliente guarda automáticamente la URL del servidor central en `/etc/default/sssd-pgsql`. Esto permite que los cambios de contraseña realizados vía SSH se envíen automáticamente al servidor central.

### Scripts NSS/PAM:
Después de sincronizar usuarios, se regeneran automáticamente:
- **generate_passwd_from_db.sh**: Crea `/etc/passwd-pgsql`
- **generate_shadow_from_db.sh**: Crea `/var/lib/extrausers/shadow`
- **sync_password_change.sh**: Hook PAM que captura cambios de contraseña

Estos archivos son leídos por NSS en el host para autenticación SSH.

## Métricas

### CPU
```json
{
  "cpu_percent": 15.2,
  "cpu_count": 8,
  "cpu_freq": 2400.0
}
```

### RAM
```json
{
  "total": 16777216000,
  "available": 8388608000,
  "percent": 50.0,
  "used": 8388608000
}
```

### Disco
```json
{
  "total": 512110190592,
  "used": 256055095296,
  "free": 256055095296,
  "percent": 50.0
}
```

### GPU (si disponible)
```json
{
  "gpu_percent": 25.5,
  "gpu_memory_used": 2048,
  "gpu_memory_total": 8192
}
```

## Base de Datos Local

El `client_db` está expuesto en el puerto **5433** del host para:
- Permitir que NSS/PAM del host lean usuarios
- Facilitar debugging y configuración

```bash
# Conectar desde el host
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d postgres

# Ver usuarios replicados
SELECT username, system_uid, is_active FROM users ORDER BY username;

# Ver total de usuarios
SELECT COUNT(*) FROM users WHERE is_active = true;
```

## API Endpoints

### Métricas Locales
```bash
# Métricas actuales del sistema
GET /metrics/local

# Métricas en formato servidor
GET /metrics/server-format
```

### Sincronización
```bash
# Recibir usuarios desde servidor (push)
POST /sync/users
```

### WebSocket
```bash
# Stream de métricas en tiempo real
WS /ws/metrics/{server_id}
```

## Desarrollo

### Ejecutar localmente

```bash
# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
export DB_HOST=localhost
export DB_PORT=5433
export DB_NAME=postgres
export DB_USER=postgres
export DB_PASSWORD=postgres
export SERVER_URL=http://localhost:8000
export SERVER_ID=1
export PORT=8100

# Ejecutar
python main.py
```

### Testing

```bash
# Test métricas locales
curl http://localhost:8100/metrics/local

# Test WebSocket (requiere wscat)
npm install -g wscat
wscat -c ws://localhost:8100/ws/metrics/1

# Test sincronización de usuarios
curl -X POST http://localhost:8100/sync/users \
  -H "Content-Type: application/json" \
  -d '{"users": [{"username": "test", "email": "test@example.com", ...}]}'
```

### Verificar sincronización

```bash
# Ver usuarios en la BD del cliente
docker compose exec client_db psql -U postgres -d postgres \
  -c "SELECT username, system_uid FROM users ORDER BY username;"

# Ver archivos NSS generados
docker compose exec client cat /etc/passwd-pgsql
docker compose exec client cat /var/lib/extrausers/shadow
```

## Troubleshooting

### Usuarios no se replican

```bash
# Verificar logs del cliente
docker compose logs client --tail 50 | grep sync

# Probar endpoint manualmente
curl -X POST http://localhost:8100/sync/users \
  -H "Content-Type: application/json" \
  -d '{"users": []}'

# Verificar BD del cliente
docker compose exec client_db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM users;"
```

### Métricas no se envían

```bash
# Verificar logs
docker compose logs client --tail 50 | grep metrics

# Verificar conexión al servidor
docker compose exec client curl http://api:8000/health

# Test manual de métricas
curl http://localhost:8100/metrics/local
```

### WebSocket no conecta

```bash
# Verificar puerto
docker compose ps client

# Test conexión WebSocket
wscat -c ws://localhost:8100/ws/metrics/1

# Ver logs
docker compose logs client | grep WebSocket
```

### Archivos NSS no se generan

```bash
# Verificar scripts
docker compose exec client ls -la /app/client/utils/*.sh

# Ejecutar manualmente
docker compose exec client bash /app/client/utils/generate_passwd_from_db.sh
docker compose exec client bash /app/client/utils/generate_shadow_from_db.sh

# Verificar permisos
docker compose exec client ls -la /etc/passwd-pgsql
docker compose exec client ls -la /var/lib/extrausers/shadow
```

```bash
# Verificar SERVER_URL y SERVER_TOKEN
docker compose exec client env | grep SERVER

# Ver logs de metrics_sender
docker compose logs client | grep metrics
```
