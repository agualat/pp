# Comandos Rápidos - Cliente Standalone

## 🚀 Iniciar Cliente

```bash
# Con archivo .env.client (SIN renombrar)
docker compose --env-file .env.client -f docker-compose.client.yml up -d

# Con archivo .env (SI renombraste .env.client a .env)
docker compose -f docker-compose.client.yml up -d
```

## 🔍 Verificar Estado

```bash
# Ver servicios corriendo
docker compose -f docker-compose.client.yml ps

# Ver logs del cliente
docker compose -f docker-compose.client.yml logs -f client

# Ver logs de la base de datos
docker compose -f docker-compose.client.yml logs -f client_db

# Health check
curl http://localhost:8100/health
```

## 🛑 Detener/Reiniciar

```bash
# Detener servicios
docker compose -f docker-compose.client.yml down

# Reiniciar solo el cliente
docker compose -f docker-compose.client.yml restart client

# Reiniciar todo
docker compose -f docker-compose.client.yml restart
```

## 🗄️ Base de Datos

```bash
# Conectar a PostgreSQL del cliente
docker compose -f docker-compose.client.yml exec client_db psql -U postgres -d postgres

# Ver usuarios sincronizados
docker compose -f docker-compose.client.yml exec client_db psql -U postgres -d postgres -c "SELECT username, system_uid, is_active FROM users ORDER BY username;"

# Contar usuarios
docker compose -f docker-compose.client.yml exec client_db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM users;"

# Ver estructura de la tabla users
docker compose -f docker-compose.client.yml exec client_db psql -U postgres -d postgres -c "\d users"
```

## 🔄 Sincronización

```bash
# Ver archivos generados para NSS/PAM (si setup_nss_auto.sh fue ejecutado)
docker compose -f docker-compose.client.yml exec client cat /etc/passwd-pgsql
docker compose -f docker-compose.client.yml exec client cat /var/lib/extrausers/shadow
```

## 🧹 Limpieza Completa

```bash
# Detener y eliminar contenedores + volúmenes
docker compose -f docker-compose.client.yml down -v

# Limpiar imágenes huérfanas
docker image prune -f
```

## ⚙️ Variables de Entorno

```bash
# Ver variables que está usando el contenedor
docker compose -f docker-compose.client.yml exec client env | grep -E "DB_|POSTGRES_"
```

## 📊 Debugging

```bash
# Entrar al contenedor del cliente
docker compose -f docker-compose.client.yml exec client bash

# Ver procesos corriendo
docker compose -f docker-compose.client.yml exec client ps aux

# Probar conexión a la base de datos desde el cliente
docker compose -f docker-compose.client.yml exec client psql -h client_db -U postgres -d postgres -c "SELECT 1"
```

## 🔐 NSS/PAM (desde el HOST)

```bash
# Configurar autenticación SSH (ejecutar como root en el HOST)
sudo bash setup_nss_auto.sh

# Verificar timer de sincronización
sudo systemctl status pgsql-users-sync.timer

# Forzar sincronización manual
sudo systemctl start pgsql-users-sync.service

# Ver usuarios disponibles para SSH
getent passwd

# Probar login de un usuario
ssh usuario@localhost
```

## ⚠️ Errores Comunes

### Error: "WARN: The WORKERS variable is not set"
**Solución**: Usa `--env-file .env.client` o copia `.env.client` a `.env`
```bash
docker compose --env-file .env.client -f docker-compose.client.yml up -d
```

### Error: "Database connection failed"
**Solución**: Espera a que client_db esté healthy
```bash
docker compose -f docker-compose.client.yml logs client_db
```

### Error: "Table users does not exist"
**Solución**: Verifica que init_db.sql se ejecutó
```bash
docker compose -f docker-compose.client.yml exec client_db psql -U postgres -d postgres -c "\dt"
```

### Error: No puedo hacer SSH con usuarios de PostgreSQL
**Solución**: Ejecuta el setup en el HOST (no en Docker)
```bash
sudo bash setup_nss_auto.sh
```
