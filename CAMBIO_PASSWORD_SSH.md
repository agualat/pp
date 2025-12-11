# Cambio de Contraseña Obligatorio vía SSH

## 🎯 Descripción

Sistema implementado para obligar a los usuarios creados masivamente a cambiar su contraseña predeterminada. El cambio se realiza vía SSH usando el comando `passwd`, y se propaga automáticamente a todos los servidores del sistema.

## 🔄 Arquitectura del Sistema

### Auto-Configuración Automática

**El sistema se auto-configura automáticamente:**

1. **Servidor Central** define su URL en `.env`:
   ```bash
   SERVER_URL=http://192.168.1.100:8000
   ```

2. **Primera Sincronización**: Cuando el servidor sincroniza usuarios con un cliente, envía:
   ```json
   {
     "server_url": "http://192.168.1.100:8000",
     "users": [...]
   }
   ```

3. **Cliente Guarda la URL**: El cliente recibe la URL y la guarda automáticamente en `/etc/default/sssd-pgsql`:
   ```bash
   DB_HOST=localhost
   DB_PORT=5433
   DB_NAME=postgres
   NSS_DB_USER=postgres
   NSS_DB_PASSWORD=postgres
   SERVER_URL=http://192.168.1.100:8000  # ← Auto-configurado
   ```

4. **Cambios de Contraseña**: Cuando un usuario cambia su contraseña, el cliente ya sabe a dónde enviarla.

**Resultado:** ¡No necesitas configurar manualmente el SERVER_URL en cada cliente! 🎉

### Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Usuario inicia sesión SSH en Cliente A                       │
│    $ ssh usuario@cliente-a                                       │
│    Password: usuario2024                                         │
│    ✅ Login exitoso (primera vez con password por defecto)       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Usuario cambia su contraseña                                 │
│    $ passwd                                                      │
│    Current password: usuario2024                                 │
│    New password: MiNuevaContraseña123!                          │
│    Retype new password: MiNuevaContraseña123!                   │
│    passwd: password updated successfully                         │
│    ✅ Password changed successfully and synced to all servers    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. PAM Hook ejecuta sync_password_change.sh                     │
│    - Captura username desde $PAM_USER                            │
│    - Lee nueva contraseña desde stdin (proporcionada por PAM)    │
│    - Envía POST al servidor central con la nueva contraseña      │
│    - Log: /var/log/password_sync.log                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Servidor Central recibe y procesa                             │
│    POST /api/users/{username}/change-password-from-client        │
│    - Valida que el usuario existe                                │
│    - Hashea la nueva contraseña con bcrypt                       │
│    - Actualiza password_hash en base de datos central            │
│    - Resetea must_change_password = 0                            │
│    - Dispara sincronización a TODOS los clientes                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Sincronización Global Automática                              │
│    Servidor Central → POST /sync/users → Todos los Clientes      │
│    ┌──────────────────────────────────────────────────┐         │
│    │ Cliente A: Recibe users actualizado ✅           │         │
│    │ - Regenera /var/lib/extrausers/passwd            │         │
│    │ - Regenera /var/lib/extrausers/shadow            │         │
│    ├──────────────────────────────────────────────────┤         │
│    │ Cliente B: Recibe users actualizado ✅           │         │
│    │ - Regenera archivos NSS/PAM                       │         │
│    ├──────────────────────────────────────────────────┤         │
│    │ Cliente C: Recibe users actualizado ✅           │         │
│    │ - Regenera archivos NSS/PAM                       │         │
│    └──────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Usuario puede usar nueva contraseña en CUALQUIER servidor     │
│    $ ssh usuario@cliente-b                                       │
│    Password: MiNuevaContraseña123!                              │
│    ✅ Login exitoso                                              │
│                                                                  │
│    $ ssh usuario@cliente-c                                       │
│    Password: MiNuevaContraseña123!                              │
│    ✅ Login exitoso                                              │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Componentes Implementados

### 1. Hook PAM en Clientes

**Archivo**: `/usr/local/bin/sync_password_change.sh`

```bash
#!/usr/bin/env bash
# Ejecutado automáticamente por PAM cuando usuario cambia contraseña

set -e

# Cargar configuración del cliente
source /etc/default/sssd-pgsql

# Variables
SERVER_URL="${SERVER_URL:-http://localhost:8000}"
CLIENT_HOSTNAME="${HOSTNAME:-$(hostname)}"
USERNAME="${PAM_USER}"  # Proporcionado por PAM
LOGFILE="/var/log/password_sync.log"

# Leer nueva contraseña desde stdin (proporcionada por PAM)
read -rs NEW_PASSWORD

# Enviar al servidor central
curl -X POST "${SERVER_URL}/api/users/${USERNAME}/change-password-from-client" \
  -H "Content-Type: application/json" \
  -H "X-Client-Host: ${CLIENT_HOSTNAME}" \
  -d "{\"new_password\": \"${NEW_PASSWORD}\"}"
```

**Características:**
- ✅ Captura automática del username desde `$PAM_USER`
- ✅ Lee contraseña desde stdin (sin almacenarla en disco)
- ✅ Envía al servidor central vía HTTP POST
- ✅ Log detallado en `/var/log/password_sync.log`
- ✅ No falla si el servidor no está disponible (solo advierte)

### 2. Configuración PAM

**Archivo**: `/etc/pam.d/common-password`

```
# Hook para sincronizar cambios de contraseña
password    optional    pam_exec.so quiet /usr/local/bin/sync_password_change.sh
```

**Características:**
- ✅ `optional`: No bloquea el cambio si la sincronización falla
- ✅ `quiet`: No muestra output del script al usuario
- ✅ Se ejecuta DESPUÉS de que la contraseña se actualiza localmente

### 3. Endpoint en Servidor Central

**Ruta**: `POST /api/users/{username}/change-password-from-client`

**Body**:
```json
{
  "new_password": "MiNuevaContraseña123!"
}
```

**Headers**:
```
Content-Type: application/json
X-Client-Host: cliente-a  (opcional, para logging)
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "message": "Password updated for user 'usuario' and synced to all clients",
  "username": "usuario",
  "source_client": "cliente-a",
  "must_change_password": false
}
```

**Funcionalidad**:
- ✅ Valida que el usuario existe
- ✅ Hashea la contraseña con bcrypt
- ✅ Actualiza `password_hash` en DB central
- ✅ Resetea `must_change_password` a 0
- ✅ Sincroniza automáticamente con TODOS los clientes

### 4. Instalación Automática

El script `setup_nss_auto.sh` instala automáticamente todo:

**Antes de ejecutar el setup, configura el SERVER_URL:**

```bash
# Configurar la URL del servidor central
export SERVER_URL="http://server-central:8000"  # O la IP/dominio real

# Ejecutar setup completo
sudo bash setup_nss_auto.sh
```

**⚠️ NOTA IMPORTANTE:** A partir de la primera sincronización de usuarios desde el servidor central, el `SERVER_URL` se configura **automáticamente**. El servidor central envía su propia URL cuando sincroniza usuarios, y el cliente la guarda en `/etc/default/sssd-pgsql`.

**Configuración Manual (Solo si es necesario):**

Si necesitas cambiar la URL manualmente:

```bash
# Editar la configuración
sudo nano /etc/default/sssd-pgsql

# Agregar o modificar la línea:
SERVER_URL=http://tu-servidor:8000
```

**Lo que hace el script automáticamente:**

```bash
# 1. Guarda SERVER_URL en /etc/default/sssd-pgsql
cat > /etc/default/sssd-pgsql <<EOF
DB_HOST=localhost
DB_PORT=5433
DB_NAME=postgres
NSS_DB_USER=postgres
NSS_DB_PASSWORD=postgres
SERVER_URL=http://server-central:8000  # ← Guardado aquí
EOF

# 2. Copiar script
cp client/utils/sync_password_change.sh /usr/local/bin/
chmod 755 /usr/local/bin/sync_password_change.sh

# 3. Crear log
touch /var/log/password_sync.log
chmod 666 /var/log/password_sync.log

# 4. Agregar hook PAM
if ! grep -q "sync_password_change.sh" /etc/pam.d/common-password; then
  echo "password    optional    pam_exec.so quiet /usr/local/bin/sync_password_change.sh" \
    >> /etc/pam.d/common-password
  echo "   ✅ Hook PAM para sincronización de contraseñas instalado"
fi
```

**Para clientes existentes que ya tienen NSS/PAM:**

Si ya instalaste NSS/PAM antes de esta actualización, solo necesitas:

```bash
# 1. Copiar script de sincronización
sudo cp client/utils/sync_password_change.sh /usr/local/bin/
sudo chmod 755 /usr/local/bin/sync_password_change.sh

# 2. Crear log
sudo touch /var/log/password_sync.log
sudo chmod 666 /var/log/password_sync.log

# 3. Agregar hook PAM
echo "password    optional    pam_exec.so quiet /usr/local/bin/sync_password_change.sh" | \
  sudo tee -a /etc/pam.d/common-password

# 4. El SERVER_URL se configurará automáticamente en la próxima sincronización
#    desde el servidor central (no necesitas hacer nada más)
```

**Configuración del Servidor Central:**

En el servidor central, configura la variable `SERVER_URL` en el archivo `.env`:

```bash
# En /home/staffteam/pp/.env
SERVER_URL=http://192.168.1.100:8000  # IP o dominio del servidor central
```

Esta URL será enviada automáticamente a todos los clientes cuando se sincronicen usuarios.

**Opciones comunes para SERVER_URL:**

```bash
# Si el servidor está en la misma red Docker Compose
export SERVER_URL="http://server:8000"

# Si está en otro host de la red local
export SERVER_URL="http://192.168.1.100:8000"

# Con nombre de dominio
export SERVER_URL="http://central.example.com:8000"

# Con HTTPS (recomendado en producción)
export SERVER_URL="https://central.example.com"
```

## 📋 Campo en Base de Datos

```sql
ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;
```

- **0**: Usuario puede usar contraseña actual
- **1**: Usuario DEBE cambiar contraseña (establecido en bulk upload)

## 🔌 API Endpoints

### 1. Crear Usuarios Masivamente

**POST** `/api/users/bulk-upload`

```bash
curl -X POST http://localhost:8000/api/users/bulk-upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@usuarios.txt"
```

**Efecto**:
- Crea usuarios con contraseñas por defecto: `{username}2024`
- Marca `must_change_password = 1` para cada usuario
- Sincroniza automáticamente con todos los clientes

**Respuesta**:
```json
{
  "success": true,
  "created": 50,
  "failed": 0,
  "default_password_format": "{username}{year}",
  "synced_to_clients": true
}
```

### 2. Cambiar Contraseña desde Cliente (automático)

**POST** `/api/users/{username}/change-password-from-client`

```bash
curl -X POST http://localhost:8000/api/users/juan/change-password-from-client \
  -H "Content-Type: application/json" \
  -H "X-Client-Host: cliente-a" \
  -d '{"new_password": "NuevaContraseña123!"}'
```

**Efecto**:
- Actualiza contraseña en servidor central
- Resetea `must_change_password = 0`
- Sincroniza con TODOS los clientes automáticamente

## 📝 Logs y Monitoreo

### Log del Cliente

```bash
# Ver log de sincronización de contraseñas
tail -f /var/log/password_sync.log
```

**Ejemplo de log exitoso**:
```
[2025-12-11 10:15:23] Password change detected for user: juan from host: cliente-a
[2025-12-11 10:15:24] ✅ Password successfully synced to central server for user: juan
```

**Ejemplo de log con error**:
```
[2025-12-11 10:20:15] Password change detected for user: maria from host: cliente-b
[2025-12-11 10:20:17] ❌ Failed to sync password for user: maria (HTTP 500): Internal Server Error
```

### Log del Servidor

Los cambios de contraseña se registran en los logs del servidor FastAPI:

```bash
docker logs server-central
```

## ✅ Ventajas de esta Implementación

1. **Totalmente Automático**: El usuario solo ejecuta `passwd`, todo lo demás es automático
2. **Transparente**: El usuario no nota la sincronización
3. **Sincronización Global**: Un cambio se propaga a TODOS los servidores
4. **Sin Archivos Temporales**: La contraseña nunca se guarda en disco durante el proceso
5. **Resiliente**: Si el servidor no está disponible, el cambio local se mantiene
6. **Auditado**: Todos los cambios quedan registrados en logs
7. **Seguro**: Usa bcrypt para hashear y HTTPS/HTTP para transmitir

## 🚀 Uso para Usuarios Finales

### Primera Vez

```bash
# 1. Conectarse con contraseña por defecto
ssh juan@cliente-a
Password: juan2024

# 2. Cambiar contraseña cuando se solicite
$ passwd
Current password: juan2024
New password: MiContraseñaSegura2025!
Retype new password: MiContraseñaSegura2025!
passwd: password updated successfully
✅ Password changed successfully and synced to all servers

# 3. Usar nueva contraseña en cualquier servidor
exit
ssh juan@cliente-b
Password: MiContraseñaSegura2025!
# ✅ Funciona en todos los servidores
```

### ¿Qué ve el usuario?

```
Welcome to Ubuntu 22.04 LTS

Last login: Wed Dec 11 10:00:00 2025 from 10.0.0.5

juan@cliente-a:~$ passwd
Current password: 
New password: 
Retype new password: 
passwd: password updated successfully
✅ Password changed successfully and synced to all servers

juan@cliente-a:~$ 
```

## 🔒 Seguridad

1. **Contraseña en tránsito**: Se envía sobre HTTP/HTTPS (configurar HTTPS en producción)
2. **Contraseña en reposo**: Se hashea con bcrypt antes de almacenar
3. **No persistencia**: La contraseña en texto plano nunca se guarda en disco
4. **Validación**: El servidor valida que el usuario existe antes de procesar
5. **Auditoría**: Todos los cambios quedan registrados con timestamp y hostname

## 📚 Archivos Relacionados

- `/home/staffteam/pp/client/utils/sync_password_change.sh` - Script PAM hook
- `/home/staffteam/pp/setup_nss_auto.sh` - Script de instalación (actualizado)
- `/home/staffteam/pp/server/router/users.py` - Endpoint de cambio de contraseña
- `/home/staffteam/pp/server/models/password_models.py` - Modelo Pydantic
- `/home/staffteam/pp/COMANDOS_CLIENTE.md` - Comandos de gestión del cliente

## 🔧 Troubleshooting

### Problema: Cambio de contraseña no se sincroniza

```bash
# 1. Verificar que el hook PAM está instalado
grep sync_password_change /etc/pam.d/common-password

# 2. Revisar el log
tail -20 /var/log/password_sync.log

# 3. Verificar conectividad al servidor
curl http://server-central:8000/health
```

### Problema: Usuario no puede cambiar contraseña

```bash
# 1. Verificar que el script tiene permisos correctos
ls -la /usr/local/bin/sync_password_change.sh
# Debe ser: -rwxr-xr-x ... /usr/local/bin/sync_password_change.sh

# 2. Verificar configuración PAM
cat /etc/pam.d/common-password | grep pam_exec
```

### Problema: Sincronización falla pero contraseña cambia localmente

Esto es **por diseño**. El hook PAM está marcado como `optional`, así que:
- ✅ La contraseña se cambia localmente siempre
- ⚠️ Si el servidor no está disponible, se muestra advertencia pero no falla
- 📝 El cambio queda registrado en el log del cliente
- 🔄 El admin puede sincronizar manualmente después

## 🎯 Próximos Pasos

1. **HTTPS en Producción**: Configurar TLS para el servidor central
2. **Autenticación del Cliente**: Agregar token/secret para validar clientes
3. **Reintentos Automáticos**: Si falla la sincronización, reintentar en background
4. **Notificaciones**: Alertar a admins cuando fallan sincronizaciones
5. **Dashboard**: Agregar vista de cambios de contraseña pendientes
