# Client - Monitor y Replicación

Cliente que recolecta métricas del sistema y replica usuarios desde la base de datos central para autenticación SSH.

## Características

- 📊 Recolección de métricas (CPU, RAM, Disco, GPU)
- 🔄 Replicación de usuarios cada 2 minutos
- 🔌 WebSocket para métricas en tiempo real
- 🐳 PostgreSQL local (client_db) para autenticación
- 📡 API REST para consultar métricas

## Componentes

### Metrics Sender
Envía métricas al servidor central cada 5 segundos:
- CPU usage (%)
- RAM usage (%)
- Disk usage (%) 
- GPU usage y memoria (si disponible)

### Database Replication
Script que sincroniza usuarios desde DB central a client_db:
- Ejecuta cada 2 minutos (cron)
- TRUNCATE + INSERT para evitar conflictos
- Solo usuarios activos (`is_active = 1`)

### API Local
Endpoints para consultar métricas locales:
- `GET /metrics/local` - Métricas detalladas
- `GET /metrics/server-format` - Formato compacto

## Estructura

```
client/
├── main.py                          # Entry point
├── entrypoint.sh                    # Container startup
├── requirements.txt
├── router/
│   ├── metrics.py                   # Metrics API
│   └── server_config.py
├── models/
│   ├── client_server_config.py
│   └── metrics.py
└── utils/
    ├── metrics.py                   # System metrics collection
    ├── metrics_sender.py            # Send to central server
    ├── replicate_db.py              # User replication
    └── server_config_manager.py
```

## Configuración

Variables de entorno en `.env`:

```env
# Local DB
DB_HOST=client_db
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres

# Central DB
CENTRAL_DB_HOST=db
CENTRAL_DB_PORT=5432
CENTRAL_DB_NAME=mydb
CENTRAL_DB_USER=postgres
CENTRAL_DB_PASSWORD=postgres

# Server
SERVER_URL=http://api:8000
SERVER_TOKEN=your-token-here
SERVER_ID=1
```

## Replicación de Usuarios

El script `replicate_db.py` ejecuta cada 2 minutos:

```python
# Proceso:
1. Conectar a DB central
2. Obtener usuarios activos
3. TRUNCATE tabla local
4. INSERT usuarios
5. Log de resultados
```

Campos replicados:
- `username`, `email`, `password_hash`
- `is_admin`, `is_active`
- `system_uid`, `system_gid`
- `created_at`

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
- Facilitar debugging

```bash
# Conectar desde el host
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mydb

# Ver usuarios replicados
SELECT username, system_uid, is_active FROM users;
```

## Desarrollo

### Ejecutar localmente

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar
python main.py
```

### Forzar replicación manual

```bash
# Desde host
docker compose exec client python3 /app/client/utils/replicate_db.py

# Verificar
docker compose exec client_db psql -U postgres -d mydb -c "SELECT COUNT(*) FROM users;"
```

### Ver logs de replicación

```bash
docker compose logs client | grep "Replication"
```

## Cron Job

El `entrypoint.sh` configura un cron job:

```cron
*/2 * * * * cd /app && python3 /app/client/utils/replicate_db.py >> /var/log/cron.log 2>&1
```

Ejecuta la replicación cada 2 minutos automáticamente.

## Troubleshooting

### Usuarios no se replican

```bash
# Verificar conexión a DB central
docker compose exec client psql -h db -U postgres -d mydb -c "SELECT COUNT(*) FROM users;"

# Ver logs
docker compose logs client --tail 50

# Forzar replicación
docker compose exec client python3 /app/client/utils/replicate_db.py
```

### Métricas no se envían

```bash
# Verificar SERVER_URL y SERVER_TOKEN
docker compose exec client env | grep SERVER

# Ver logs de metrics_sender
docker compose logs client | grep metrics
```
