# Permisos de Docker para Usuarios

Este documento explica cómo dar permisos a los usuarios creados desde la API para que puedan usar Docker.

## 🎯 Objetivo

Cuando se crean usuarios a través de la API, estos usuarios se sincronizan con el sistema operativo del servidor, pero por defecto **no tienen permisos para usar Docker**. Este script automatiza el proceso de agregar usuarios al grupo `docker`.

## 📋 Requisitos Previos

- El servidor debe tener Docker instalado
- PostgreSQL client (`psql`) debe estar instalado en el host
- La base de datos `client_db` debe estar corriendo y accesible
- Permisos de root/sudo en el servidor

## 🚀 Método 1: Ejecución Manual (Recomendado)

Este es el método más confiable y funciona en cualquier configuración.

### Paso 1: Conectarse al servidor

```bash
ssh root@<server-ip>
```

### Paso 2: Instalar PostgreSQL client (si no está instalado)

```bash
apt-get update
apt-get install -y postgresql-client
```

### Paso 3: Descargar el script

```bash
# Opción A: Si tienes acceso al repositorio
cd /opt
git clone <repo-url>
cd pp/client/utils

# Opción B: Copiar el script manualmente
nano /opt/sync_docker_group.sh
# (pegar el contenido del script)
chmod +x /opt/sync_docker_group.sh
```

### Paso 4: Configurar las credenciales de la base de datos

```bash
# Editar o crear el archivo de configuración
sudo nano /etc/default/sssd-pgsql
```

Agregar estas líneas (ajustar según tu configuración):

```bash
DB_HOST=localhost
DB_PORT=5433
DB_NAME=postgres
NSS_DB_USER=postgres
NSS_DB_PASSWORD=tu_password_aqui
```

### Paso 5: Ejecutar el script

```bash
sudo bash /opt/sync_docker_group.sh
```

### Salida esperada:

```
🔧 Docker Group Synchronization Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Database: localhost:5433/postgres

📦 Docker group GID: 999

🔍 Querying database for active users...
✅ Found users in database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: juan (UID: 2000, GID: 2000)
  📝 Creating system user juan...
  ✅ System user juan created
  🔧 Adding to docker group...
  ✅ Added to docker group
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: maria (UID: 2001, GID: 2001)
  ℹ️  System user already exists
  ✅ Already in docker group

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Docker Group Synchronization Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✨ System users created: 1
  ➕ Users added to docker: 1
  ✅ Users already in docker: 1
  ⏭️  Users skipped: 0
  ❌ Errors: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Docker group synchronization completed successfully!

📝 Note: Users may need to log out and log back in for group changes to take effect
```

## 🤖 Método 2: Ejecución Automática (Durante Sincronización)

El script se ejecuta automáticamente cuando se sincronizan usuarios desde el servidor central, **pero requiere que el contenedor del cliente tenga permisos privilegiados**.

### Configuración:

Editar `docker-compose.client.yml`:

```yaml
client:
  # ... otras configuraciones ...
  privileged: true  # ⚠️ DESCOMENTAR ESTA LÍNEA
  volumes:
    - client_data:/app/client_data
    - /var/run/docker.sock:/var/run/docker.sock
    # Agregar estos volúmenes:
    - /etc/passwd:/etc/passwd
    - /etc/shadow:/etc/shadow
    - /etc/group:/etc/group
```

**⚠️ Advertencia de Seguridad:** El modo privilegiado da acceso completo al host. Solo usar en entornos controlados.

## 🔍 Verificación

### Verificar que un usuario está en el grupo docker:

```bash
groups nombre_usuario
```

Debería mostrar algo como:
```
nombre_usuario : nombre_usuario docker
```

### Probar que el usuario puede usar Docker:

```bash
# Cambiar a ese usuario
su - nombre_usuario

# Probar Docker
docker ps
```

Si funciona correctamente, el comando debería ejecutarse sin errores.

## 🐛 Solución de Problemas

### Error: "psql: command not found"

Instalar PostgreSQL client:
```bash
apt-get update && apt-get install -y postgresql-client
```

### Error: "could not connect to server"

1. Verificar que `client_db` está corriendo:
   ```bash
   docker ps | grep client_db
   ```

2. Verificar el puerto expuesto:
   ```bash
   docker port pp_client_db
   ```

3. Probar conexión manualmente:
   ```bash
   psql -h localhost -p 5433 -U postgres -d postgres
   ```

### Error: "Permission denied"

El script debe ejecutarse como root:
```bash
sudo bash /opt/sync_docker_group.sh
```

### Usuario creado pero no puede usar Docker

El usuario debe cerrar sesión y volver a entrar para que los cambios de grupo surtan efecto:

```bash
# Si está conectado por SSH:
exit
ssh nombre_usuario@servidor

# Verificar grupos:
groups
```

## 📝 Notas Importantes

1. **Usuarios deben cerrar sesión**: Los cambios en grupos solo surten efecto después de que el usuario cierra sesión y vuelve a entrar.

2. **UIDs/GIDs**: El script intenta mantener los mismos UIDs/GIDs que tiene el usuario en la base de datos. Si hay conflictos, crea el usuario con un UID/GID automático.

3. **Directorios home**: El script crea `/home/nombre_usuario` automáticamente para cada usuario.

4. **Seguridad**: Agregar usuarios al grupo docker les da acceso privilegiado al sistema. Solo agregar usuarios de confianza.

## 🔄 Automatización con Cron

Para ejecutar el script automáticamente cada hora:

```bash
# Editar crontab
sudo crontab -e

# Agregar esta línea:
0 * * * * /opt/sync_docker_group.sh >> /var/log/sync_docker_group.log 2>&1
```

## 📚 Referencias

- [Docker Post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/)
- [Manage Docker as a non-root user](https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user)