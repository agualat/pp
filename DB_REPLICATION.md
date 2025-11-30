# Replicación de Base de Datos PostgreSQL (Central → Local)

## Descripción

Cada cliente tiene su **propia base de datos PostgreSQL local** que se replica automáticamente desde la base de datos central. Esto proporciona **alta disponibilidad** permitiendo que los usuarios puedan hacer SSH incluso si la base de datos central o el servidor API se caen.

## Arquitectura

```
┌─────────────────┐
│  Central DB     │  ← Base de datos principal (server)
│  (PostgreSQL)   │     Gestiona usuarios, servidores, playbooks
└────────┬────────┘
         │
         │ Replicación cada 2 min
         ↓
┌─────────────────┐
│   Client DB     │  ← Base de datos local (cliente)
│  (PostgreSQL)   │     Solo tabla 'users' para NSS/PAM
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   NSS/PAM       │  ← Autenticación SSH
│   libnss-pgsql  │     Lee desde Client DB local
└─────────────────┘
```

## Flujo de Replicación

### 1. Inicialización del Cliente

Cuando el cliente inicia (`entrypoint.sh`):

```bash
1. Espera a que client_db esté listo (pg_isready)
2. Configura NSS/PAM apuntando a client_db local
3. Ejecuta replicación inicial: python3 replicate_db.py
4. Configura cron job para replicación cada 2 minutos
5. Inicia cron en background
6. Inicia el servidor FastAPI del cliente
```

### 2. Replicación Periódica (Cron)

Cada 2 minutos se ejecuta:

```bash
*/2 * * * * python3 /app/client/utils/replicate_db.py >> /var/log/db_replication.log 2>&1
```

**Proceso de replicación:**
1. Conecta a la **BD central** (CENTRAL_DB_HOST=db)
2. Obtiene todos los usuarios: `SELECT * FROM users`
3. Conecta a la **BD local** (DB_HOST=client_db)
4. Para cada usuario:
   - `INSERT ... ON CONFLICT DO UPDATE` (upsert)
5. Elimina usuarios locales que ya no existen en central
6. Commit de todos los cambios

### 3. Ventajas de PostgreSQL a PostgreSQL

| Aspecto | Beneficio |
|---------|-----------|
| **Queries SQL nativas** | NSS/PAM usa queries SQL optimizadas |
| **Transacciones ACID** | Consistencia garantizada |
| **Indices automáticos** | Búsquedas rápidas por username, uid |
| **No requiere root** | No modifica `/etc/passwd` ni `/etc/shadow` |
| **Escalable** | Soporta miles de usuarios |
| **Auditable** | Logs de todas las replicaciones |

## Configuración de Servicios

### docker-compose.yml

```yaml
services:
  # Base de datos central (servidor)
  db:
    image: postgres:15
    container_name: pp_db
    volumes:
      - db_data:/var/lib/postgresql/data

  # Base de datos local del cliente
  client_db:
    image: postgres:15
    container_name: pp_client_db
    volumes:
      - client_db_data:/var/lib/postgresql/data

  # Cliente
  client:
    environment:
      # BD Local (para NSS/PAM)
      DB_HOST: client_db
      DB_PORT: 5432
      DB_NAME: mydb
      NSS_DB_USER: postgres
      NSS_DB_PASSWORD: postgres
      
      # BD Central (para replicación)
      CENTRAL_DB_HOST: db
      CENTRAL_DB_PORT: 5432
      CENTRAL_DB_NAME: mydb
      CENTRAL_DB_USER: postgres
      CENTRAL_DB_PASSWORD: postgres
    depends_on:
      - client_db
```

## Scripts de Replicación

### `client/utils/replicate_db.py`

Funciones principales:

1. **`get_central_db_connection()`**
   - Conecta a la BD central (db:5432)
   - Timeout de 5 segundos
   - Retorna None si falla

2. **`get_local_db_connection()`**
   - Conecta a la BD local (client_db:5432)
   - Usada por NSS/PAM

3. **`ensure_users_table_exists()`**
   - Crea tabla `users` si no existe
   - Crea índices en username, system_uid, is_active

4. **`fetch_central_users()`**
   - Obtiene todos los usuarios de BD central
   - Retorna lista de diccionarios

5. **`sync_user_to_local()`**
   - Inserta o actualiza un usuario en BD local
   - Usa `ON CONFLICT DO UPDATE` (upsert)

6. **`delete_removed_users()`**
   - Elimina usuarios que ya no existen en central
   - Mantiene BD local sincronizada

7. **`replicate_users()`**
   - Orquesta todo el proceso de replicación
   - Incluye reintentos (3 intentos con 5s de delay)

## Escenarios de Alta Disponibilidad

### Escenario 1: BD Central caída, BD Local OK

```
Estado: Central DB ❌ | Local DB ✅
SSH:    ✅ FUNCIONA (lee desde BD local)
API:    ❌ No disponible
```

**Comportamiento:**
- Los usuarios pueden hacer SSH normalmente
- NSS/PAM lee desde `client_db` (local)
- La replicación falla pero se reintenta cada 2 minutos
- Cuando la BD central se recupera, se reanuda la sincronización

### Escenario 2: BD Local caída, BD Central OK

```
Estado: Central DB ✅ | Local DB ❌
SSH:    ❌ NO FUNCIONA
API:    ✅ Disponible
```

**Comportamiento:**
- NSS/PAM no puede autenticar (necesita BD local)
- La replicación falla
- Hay que reiniciar `client_db`

### Escenario 3: Ambas BDs OK (Normal)

```
Estado: Central DB ✅ | Local DB ✅
SSH:    ✅ FUNCIONA
API:    ✅ Disponible
```

**Comportamiento:**
- Todo funciona correctamente
- Replicación cada 2 minutos
- Cambios en usuarios se propagan rápidamente

### Escenario 4: Usuario nuevo creado

```
1. Admin crea usuario en API
2. Se inserta en BD central (db)
3. Replicación automática en <= 2 minutos
4. Usuario aparece en BD local (client_db)
5. NSS/PAM puede autenticar al usuario
6. SSH funciona
```

### Escenario 5: Usuario cambia contraseña

```
1. Usuario cambia contraseña en API
2. Se actualiza password_hash en BD central
3. Replicación automática en <= 2 minutos
4. password_hash se actualiza en BD local
5. Nueva contraseña funciona para SSH
```

### Escenario 6: Usuario eliminado

```
1. Admin elimina usuario de BD central
2. Replicación detecta que el ID no existe
3. Elimina usuario de BD local
4. Usuario no puede hacer SSH
```

## Logs de Replicación

### Ver logs en tiempo real:

```bash
# Logs de replicación
docker exec pp_client tail -f /var/log/db_replication.log

# Logs del proceso de cron
docker exec pp_client tail -f /var/log/cron.log
```

### Ejemplo de logs exitosos:

```
🔄 Starting user replication from central DB to local DB...
✅ Replication complete: 15/15 users synced, 0 users removed
```

### Ejemplo de logs con BD central caída:

```
🔄 Starting user replication from central DB to local DB...
✗ Failed to connect to central database: connection refused
⚠️  Failed to fetch users from central DB (will retry later)
⏳ Retry 1/3 in 5 seconds...
```

## Verificación del Sistema

### 1. Verificar replicación:

```bash
# Ver usuarios en BD central
docker exec pp_db psql -U postgres -d mydb -c "SELECT id, username, system_uid FROM users;"

# Ver usuarios en BD local
docker exec pp_client_db psql -U postgres -d mydb -c "SELECT id, username, system_uid FROM users;"

# Deberían ser idénticos
```

### 2. Verificar conectividad NSS/PAM:

```bash
# Verificar que NSS puede resolver usuarios
docker exec pp_client getent passwd developer

# Debería mostrar:
# developer:x:2001:2000::/home/developer:/bin/bash
```

### 3. Verificar cron job:

```bash
# Ver crontab configurado
docker exec pp_client crontab -l

# Debería mostrar:
# */2 * * * * python3 /app/client/utils/replicate_db.py >> /var/log/db_replication.log 2>&1
```

### 4. Forzar replicación manual:

```bash
# Ejecutar replicación inmediatamente
docker exec pp_client python3 /app/client/utils/replicate_db.py
```

## Monitoreo y Alertas

### Verificar última replicación exitosa:

```bash
# Ver timestamp de última replicación
docker exec pp_client stat -c %y /var/log/db_replication.log

# Ver últimas 10 líneas de logs
docker exec pp_client tail -10 /var/log/db_replication.log
```

### Alertas recomendadas:

1. **BD local sin respuesta** → Reiniciar `client_db`
2. **Replicación fallando > 10 min** → Verificar conectividad a BD central
3. **Diferencia de usuarios entre central y local** → Revisar logs de replicación

## Mantenimiento

### Cambiar intervalo de replicación:

```bash
# Editar entrypoint.sh y cambiar:
# De: */2 * * * * (cada 2 minutos)
# A:  */1 * * * * (cada 1 minuto)

# Rebuild del cliente
docker-compose build client
docker-compose up -d client
```

### Limpiar BD local y resincronizar:

```bash
# Detener cliente
docker-compose stop client

# Eliminar volumen de BD local
docker volume rm pp_client_db_data

# Reiniciar todo
docker-compose up -d client_db
docker-compose up -d client

# La replicación inicial se ejecutará automáticamente
```

### Backup de BD local:

```bash
# Dump de BD local
docker exec pp_client_db pg_dump -U postgres mydb > client_backup.sql

# Restaurar
docker exec -i pp_client_db psql -U postgres mydb < client_backup.sql
```

## Seguridad

### Protecciones Implementadas:

1. **Aislamiento de red:**
   - BD local solo accesible desde el contenedor cliente
   - No expuesta al host

2. **Credenciales separadas:**
   - Posibilidad de usar usuario diferente para replicación
   - NSS_DB_USER puede tener permisos de solo lectura

3. **Replicación unidireccional:**
   - Solo Central → Local (no viceversa)
   - Evita conflictos de escritura

4. **Transacciones atómicas:**
   - Commit solo si toda la replicación es exitosa
   - Rollback en caso de error

## Limitaciones

| Limitación | Impacto | Mitigación |
|------------|---------|------------|
| **Delay de replicación** | Cambios tardan hasta 2 min | Reducir intervalo a 1 min si es crítico |
| **Solo tabla users** | Servidores/playbooks no replicados | Suficiente para autenticación SSH |
| **Requiere 2 instancias PostgreSQL** | Mayor uso de recursos | Aceptable para HA |
| **No hay conflict resolution** | Central siempre gana | Correcto para este caso de uso |

## Comparación: DB Replication vs File Replication

| Aspecto | PostgreSQL → PostgreSQL | PostgreSQL → /etc/passwd |
|---------|------------------------|-------------------------|
| **Performance** | ✅ Queries optimizadas | ⚠️ Lectura de archivos |
| **Escalabilidad** | ✅ Miles de usuarios | ⚠️ Lento con muchos usuarios |
| **Consistencia** | ✅ ACID transactions | ❌ Riesgo de corrupción |
| **Privilegios** | ✅ No requiere root | ❌ Requiere root para modificar /etc |
| **Índices** | ✅ Búsquedas rápidas | ❌ Búsqueda lineal |
| **Logs** | ✅ PostgreSQL logs | ⚠️ Solo syslog |

## Conclusión

La replicación PostgreSQL → PostgreSQL es **superior** para este caso de uso porque:

- ✅ NSS/PAM está diseñado para trabajar con PostgreSQL
- ✅ No requiere modificar archivos del sistema
- ✅ Mejor performance y escalabilidad
- ✅ Transacciones atómicas garantizan consistencia
- ✅ Alta disponibilidad sin complejidad adicional

## Arquitectura de Respaldo

### Modo Normal (PostgreSQL Online)
```
Usuario SSH → PAM/NSS → PostgreSQL → Autenticación
```

### Modo de Respaldo (PostgreSQL Offline)
```
Usuario SSH → PAM → /etc/shadow → Autenticación
```

## Flujo de Sincronización

### 1. Sincronización Inicial

Cuando el cliente inicia:

```bash
# entrypoint.sh ejecuta:
python3 /app/client/utils/sync_users_local.py
```

**Qué hace:**
1. Conecta a PostgreSQL
2. Obtiene todos los usuarios activos (`is_active = 1`)
3. Para cada usuario:
   - Crea el usuario en `/etc/passwd` con el mismo UID/GID
   - Copia el hash de contraseña a `/etc/shadow`
   - Crea el directorio home (`/home/username`)
   - Configura SSH authorized_keys si existe

### 2. Sincronización Periódica

Se configura un cron job que ejecuta cada 5 minutos:

```bash
*/5 * * * * python3 /app/client/utils/sync_users_local.py >> /var/log/user_sync.log 2>&1
```

**Beneficios:**
- ✅ Nuevos usuarios se propagan automáticamente
- ✅ Cambios de contraseñas se sincronizan
- ✅ Desactivación de usuarios se refleja localmente
- ✅ SSH keys se mantienen actualizadas

## Estructura de Usuarios

### PostgreSQL (Tabla `users`)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,          -- Hash bcrypt
    system_uid INTEGER UNIQUE NOT NULL,       -- UID para el sistema (>= 2000)
    system_gid INTEGER DEFAULT 2000,          -- GID del grupo ppusers
    ssh_public_key VARCHAR,                   -- Llave pública SSH
    is_active INTEGER DEFAULT 1               -- 1 = activo, 0 = desactivado
);
```

### Sistema Local (`/etc/passwd`)

```
username:x:2000:2000::/home/username:/bin/bash
```

### Sistema Local (`/etc/shadow`)

```
username:$2b$12$hash_bcrypt_aqui:18000:0:99999:7:::
```

## Ejemplo de Usuario Sincronizado

### Usuario en PostgreSQL:

```sql
INSERT INTO users (username, password_hash, system_uid, system_gid, is_active)
VALUES ('developer', '$2b$12$abcd...xyz', 2001, 2000, 1);
```

### Después de Sincronización:

**`/etc/passwd`:**
```
developer:x:2001:2000::/home/developer:/bin/bash
```

**`/etc/shadow`:**
```
developer:$2b$12$abcd...xyz:18000:0:99999:7:::
```

**`/home/developer/`:**
```
drwxr-xr-x 2001:2000 /home/developer
drwx------ 2001:2000 /home/developer/.ssh
-rw------- 2001:2000 /home/developer/.ssh/authorized_keys
```

## Orden de Prioridad de Autenticación

### Configuración NSS (`/etc/nsswitch.conf`)

```
passwd:     files pgsql
shadow:     files pgsql
group:      files pgsql
```

**Orden de búsqueda:**
1. **`files`** - Busca primero en `/etc/passwd` y `/etc/shadow`
2. **`pgsql`** - Si no encuentra, consulta PostgreSQL

Esto significa:
- ✅ Si PostgreSQL está **online**, los usuarios sincronizados localmente funcionan
- ✅ Si PostgreSQL está **offline**, los usuarios locales siguen funcionando
- ✅ Si se crea un usuario nuevo y PostgreSQL está offline, aparecerá en la próxima sincronización

## Logs de Sincronización

### Ver logs en tiempo real:

```bash
# Desde el host
docker exec pp_client tail -f /var/log/user_sync.log

# Desde dentro del contenedor
tail -f /var/log/user_sync.log
```

### Logs de ejemplo exitoso:

```
🔄 Starting user synchronization from PostgreSQL to local system...
✓ Created user developer
✓ Created user admin
✓ Updated user operations
✅ Synchronized 3/3 users successfully
```

### Logs de ejemplo con PostgreSQL caído:

```
🔄 Starting user synchronization from PostgreSQL to local system...
✗ Failed to fetch users from database: connection refused
⚠️  No users found or database connection failed
```

## Verificación del Sistema

### 1. Verificar usuarios sincronizados:

```bash
# Ver usuarios locales
docker exec pp_client cat /etc/passwd | grep -E '^[a-z]'

# Ver usuarios en PostgreSQL
docker exec pp_client psql -h db -U postgres -d mydb -c "SELECT username, system_uid FROM users WHERE is_active = 1;"
```

### 2. Verificar cron job:

```bash
# Ver crontab configurado
docker exec pp_client crontab -l

# Ver proceso de cron
docker exec pp_client ps aux | grep cron
```

### 3. Probar autenticación:

```bash
# Con PostgreSQL online (debería funcionar)
ssh usuario@servidor

# Simular PostgreSQL offline
docker-compose stop db

# Intentar SSH nuevamente (debería seguir funcionando con usuarios locales)
ssh usuario@servidor
```

## Seguridad

### Protecciones Implementadas:

1. **Permisos de archivos:**
   - `/etc/shadow` → `600` (solo root puede leer)
   - `~/.ssh/` → `700` (solo el usuario)
   - `~/.ssh/authorized_keys` → `600`

2. **Hashes de contraseñas:**
   - Usa bcrypt con 12 rounds
   - Compatible con PAM y `/etc/shadow`

3. **Separación de usuarios:**
   - UIDs empiezan en 2000 (no conflictan con usuarios del sistema)
   - Grupo dedicado `ppusers` (GID 2000)

4. **Auditoría:**
   - Logs de sincronización en `/var/log/user_sync.log`
   - Timestamps de última sincronización

## Mantenimiento

### Sincronización manual:

```bash
# Ejecutar sincronización inmediata
docker exec pp_client python3 /app/client/utils/sync_users_local.py
```

### Cambiar intervalo de sincronización:

Editar `client/entrypoint.sh`:

```bash
# Cambiar de 5 minutos a 1 minuto
echo "*/1 * * * * python3 /app/client/utils/sync_users_local.py >> /var/log/user_sync.log 2>&1" | crontab -
```

### Eliminar usuario local:

```bash
# Desactivar en PostgreSQL primero
docker exec pp_db psql -U postgres -d mydb -c "UPDATE users SET is_active = 0 WHERE username = 'usuario';"

# Esperar sincronización automática o ejecutar manual
docker exec pp_client python3 /app/client/utils/sync_users_local.py

# Verificar
docker exec pp_client id usuario
# Debería mostrar: id: 'usuario': no such user
```

## Escenarios de Recuperación

### Escenario 1: PostgreSQL se cae temporalmente

```
1. PostgreSQL deja de responder
2. SSH sigue funcionando con usuarios locales sincronizados
3. No se pueden crear nuevos usuarios
4. Los usuarios existentes pueden hacer login normalmente
5. PostgreSQL se recupera
6. Próxima sincronización actualiza cualquier cambio
```

### Escenario 2: Cliente se reinicia

```
1. Cliente inicia
2. Ejecuta NSS/PAM setup
3. Ejecuta sincronización inicial de usuarios
4. Configura cron job
5. Listo para autenticar
```

### Escenario 3: Usuario cambia contraseña

```
1. Usuario cambia contraseña en la API
2. Se actualiza hash en PostgreSQL
3. NSS/PAM usa nuevo hash inmediatamente
4. Cron sincroniza nuevo hash a /etc/shadow en <= 5 min
5. Ambos métodos de autenticación funcionan
```

## Ventajas de este Diseño

| Aspecto | Beneficio |
|---------|-----------|
| **Alta Disponibilidad** | SSH funciona incluso si PostgreSQL está caído |
| **Sincronización Automática** | No requiere intervención manual |
| **Transparente** | Los usuarios no notan diferencia |
| **Auditable** | Logs de todas las sincronizaciones |
| **Escalable** | Soporta cientos de usuarios |
| **Seguro** | Hashes bcrypt, permisos correctos |

## Limitaciones

1. **Delay de sincronización**: Cambios toman hasta 5 minutos en propagarse
2. **Requiere privilegios**: El contenedor necesita permisos para crear usuarios
3. **No sincroniza eliminaciones**: Usuarios desactivados permanecen localmente hasta próxima sincronización
4. **Solo un sentido**: PostgreSQL → Sistema Local (no viceversa)
