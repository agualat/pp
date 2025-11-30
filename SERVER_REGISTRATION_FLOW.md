# Flujo de Registro de Servidores en el Cliente

## Descripción General

Cuando agregas un servidor al sistema a través de la API, este se registra automáticamente en el **cliente** para que pueda ser usado en la autenticación NSS/PAM. Esto permite que los usuarios puedan hacer SSH a los servidores gestionados.

## Flujo Completo

### 1. Creación de Servidor en la API

**Endpoint**: `POST /servers/`

```bash
curl -X POST "http://localhost:8000/servers/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "prod-server-01",
    "ip_address": "192.168.1.100",
    "ssh_user": "root",
    "ssh_password": "temporal123"
  }'
```

**Qué sucede**:
1. El servidor valida que no exista otro servidor con el mismo nombre o IP
2. Crea el servidor en la base de datos PostgreSQL
3. Genera un par de llaves SSH (pública/privada) para este servidor
4. Despliega la llave pública SSH en el servidor remoto
5. **Registra automáticamente el servidor en el cliente** (background task)

### 2. Registro en el Cliente

**Endpoint Cliente**: `POST /api/server-config/register`

El servidor API hace una llamada automática al cliente:

```json
{
  "server_id": 1,
  "name": "prod-server-01",
  "ip_address": "192.168.1.100",
  "ssh_port": 22,
  "ssh_user": "root",
  "description": "Server managed by root"
}
```

**Qué sucede**:
1. El cliente recibe la configuración del servidor
2. La guarda en un archivo JSON local: `/app/client_data/servers_config.json`
3. Este archivo persiste en un volumen Docker (`client_data`)

### 3. Uso en NSS/PAM

Cuando un usuario intenta hacer SSH a un servidor:

```bash
ssh usuario@192.168.1.100
```

**Flujo de autenticación**:

1. **NSS (Name Service Switch)** consulta PostgreSQL:
   - ¿Existe el usuario `usuario`?
   - ¿Cuál es su UID, GID, home, shell?

2. **PAM (Pluggable Authentication Modules)** verifica la contraseña:
   - Consulta PostgreSQL: `SELECT password_hash FROM users WHERE username = 'usuario'`
   - Compara usando bcrypt

3. El cliente tiene acceso a:
   - Base de datos (usuarios, contraseñas hash)
   - Configuración de servidores (en `/app/client_data/servers_config.json`)

## Estructura de Datos

### Archivo de Configuración del Cliente

`/app/client_data/servers_config.json`:

```json
{
  "1": {
    "server_id": 1,
    "name": "prod-server-01",
    "ip_address": "192.168.1.100",
    "ssh_port": 22,
    "ssh_user": "root",
    "description": "Server managed by root"
  },
  "2": {
    "server_id": 2,
    "name": "dev-server-01",
    "ip_address": "192.168.1.101",
    "ssh_port": 22,
    "ssh_user": "root",
    "description": "Server managed by root"
  }
}
```

### Base de Datos - Tabla `servers`

```sql
CREATE TABLE servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    ip_address VARCHAR UNIQUE NOT NULL,
    status VARCHAR DEFAULT 'offline',
    ssh_user VARCHAR DEFAULT 'root',
    ssh_private_key_path VARCHAR
);
```

### Base de Datos - Tabla `users`

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    system_uid INTEGER UNIQUE NOT NULL,
    system_gid INTEGER DEFAULT 2000,
    ssh_public_key VARCHAR
);
```

## Endpoints del Cliente

### Listar Servidores Configurados

```bash
curl http://localhost:8100/api/server-config/servers
```

### Obtener Configuración de un Servidor

```bash
curl http://localhost:8100/api/server-config/servers/1
```

### Verificar si Existe un Servidor

```bash
curl http://localhost:8100/api/server-config/servers/1/exists
```

### Eliminar Servidor del Cliente

```bash
curl -X DELETE http://localhost:8100/api/server-config/servers/1
```

## Eliminación de Servidores

Cuando eliminas un servidor de la API:

```bash
curl -X DELETE "http://localhost:8000/servers/1" \
  -H "Authorization: Bearer $TOKEN"
```

**Qué sucede**:
1. Se elimina el servidor de la base de datos
2. **Se elimina automáticamente del cliente** (background task)
3. El archivo `/app/client_data/servers_config.json` se actualiza

## Persistencia de Datos

El volumen `client_data` en Docker asegura que:
- La configuración de servidores persiste entre reinicios del contenedor
- No se pierde información si el cliente se detiene o se actualiza

```yaml
volumes:
  - client_data:/app/client_data
```

## Ventajas de este Diseño

1. **Sincronización automática**: El cliente siempre tiene la configuración actualizada
2. **Desacoplamiento**: El cliente no necesita consultar constantemente la API
3. **Rendimiento**: Lectura local del archivo JSON es instantánea
4. **Resiliencia**: Si la API está caída, el cliente puede seguir autenticando con su configuración local
5. **Auditoría**: Puedes consultar qué servidores están configurados en el cliente

## Seguridad

- La configuración del cliente **NO contiene contraseñas**
- Solo almacena información necesaria para identificar servidores
- Las contraseñas de usuarios están hasheadas en PostgreSQL
- Las llaves SSH privadas están protegidas en el filesystem del servidor API

## Ejemplo de Uso Completo

```bash
# 1. Login y obtener token
TOKEN=$(curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)

# 2. Crear servidor (se registra automáticamente en el cliente)
curl -X POST "http://localhost:8000/servers/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-server",
    "ip_address": "10.0.0.50",
    "ssh_user": "ubuntu",
    "ssh_password": "changeme"
  }'

# 3. Verificar que se registró en el cliente
curl http://localhost:8100/api/server-config/servers

# 4. Crear usuario
curl -X POST "http://localhost:8000/auth/signup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "developer",
    "email": "dev@example.com",
    "password": "dev123"
  }'

# 5. Ahora el usuario puede hacer SSH al servidor
ssh developer@10.0.0.50
# La autenticación se hace contra PostgreSQL vía NSS/PAM
```
