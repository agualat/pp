# Configuración Automática del Sistema

## 🎯 Auto-Configuración de SERVER_URL

El sistema ahora configura automáticamente la URL del servidor central en todos los clientes. **No necesitas configurar manualmente cada cliente.**

## 🚀 Pasos de Configuración

### 1. En el Servidor Central

Edita el archivo `.env` y configura la URL pública del servidor:

```bash
# /home/staffteam/pp/.env
SERVER_URL=http://192.168.1.100:8000  # IP o dominio real del servidor
```

**Opciones comunes:**
```bash
# Con IP privada
SERVER_URL=http://192.168.1.100:8000

# Con nombre de host
SERVER_URL=http://server-central:8000

# Con dominio público
SERVER_URL=https://central.example.com

# Con IP pública
SERVER_URL=http://203.0.113.50:8000
```

### 2. Inicia el Servidor

```bash
docker compose up -d
```

### 3. Configura los Clientes

En cada máquina cliente, ejecuta el setup:

```bash
# Clonar el repositorio o copiar archivos necesarios
cd /home/staffteam/pp

# Ejecutar setup (no necesitas definir SERVER_URL)
sudo bash setup_nss_auto.sh
```

### 4. Registra los Clientes

Desde el dashboard web del servidor central:

1. Ve a **Servers**
2. Click en **Add Server**
3. Agrega la IP del cliente
4. El servidor verificará la conectividad

### 5. Sincroniza Usuarios

Cuando crees o modifiques usuarios en el servidor central, estos se sincronizan automáticamente con todos los clientes. **Durante esta sincronización, el servidor envía su URL a cada cliente.**

```bash
# Los clientes reciben automáticamente:
# - Lista de usuarios
# - SERVER_URL del servidor central
```

## 🔍 Verificación

### En el Cliente

Verifica que el SERVER_URL se configuró correctamente:

```bash
# Ver configuración
cat /etc/default/sssd-pgsql | grep SERVER_URL

# Deberías ver algo como:
# SERVER_URL=http://192.168.1.100:8000
```

### Logs de Sincronización

```bash
# En el cliente, después de la primera sincronización:
docker logs client

# Deberías ver:
# ✅ SERVER_URL auto-configurado: http://192.168.1.100:8000
```

## 🔄 Flujo de Auto-Configuración

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Admin configura SERVER_URL en .env del servidor central   │
│    SERVER_URL=http://192.168.1.100:8000                      │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Admin crea usuarios o hace bulk upload                    │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Servidor sincroniza con todos los clientes                │
│    POST http://cliente-a:8100/api/sync/users                 │
│    {                                                          │
│      "server_url": "http://192.168.1.100:8000",             │
│      "users": [...]                                           │
│    }                                                          │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Cliente guarda SERVER_URL automáticamente                 │
│    echo "SERVER_URL=http://192.168.1.100:8000" >>           │
│         /etc/default/sssd-pgsql                              │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. Usuario cambia contraseña vía SSH                         │
│    $ passwd                                                   │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Script PAM lee SERVER_URL y envía cambio                  │
│    source /etc/default/sssd-pgsql                            │
│    curl $SERVER_URL/api/users/{username}/change-password...  │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Servidor actualiza y re-sincroniza a todos los clientes   │
│    ✅ Nueva contraseña propagada a todos los servidores      │
└──────────────────────────────────────────────────────────────┘
```

## ✅ Ventajas

1. **Configuración Centralizada**: Solo defines SERVER_URL en UN lugar (el servidor)
2. **Auto-Propagación**: Los clientes se configuran automáticamente
3. **Sin Intervención Manual**: No necesitas SSH a cada cliente
4. **Actualización Dinámica**: Si cambias el SERVER_URL, se actualiza en la próxima sincronización
5. **Resistente a Cambios**: Si migras el servidor, solo cambias una variable

## 🔧 Configuración Manual (Solo si es necesario)

Si por alguna razón necesitas configurar manualmente:

```bash
# En el cliente
echo "SERVER_URL=http://192.168.1.100:8000" | sudo tee -a /etc/default/sssd-pgsql
```

Pero normalmente **NO ES NECESARIO** - se configura automáticamente.

## 📚 Archivos Relacionados

- **Servidor**: `server/utils/user_sync.py` - Envía SERVER_URL en sincronización
- **Cliente**: `client/router/sync.py` - Recibe y guarda SERVER_URL
- **Config**: `.env` - Define SERVER_URL del servidor
- **Script**: `client/utils/sync_password_change.sh` - Lee SERVER_URL para cambios de contraseña

## 🐛 Troubleshooting

### Problema: SERVER_URL no se configuró automáticamente

```bash
# 1. Verificar que está en el servidor
docker exec server env | grep SERVER_URL

# 2. Verificar logs del cliente durante sincronización
docker logs client | grep SERVER_URL

# 3. Forzar re-sincronización desde el dashboard
# Dashboard → Users → Sync All
```

### Problema: Cambios de contraseña no llegan al servidor

```bash
# 1. Verificar SERVER_URL en el cliente
cat /etc/default/sssd-pgsql | grep SERVER_URL

# 2. Verificar conectividad
curl $SERVER_URL/health

# 3. Ver logs de cambio de contraseña
tail -f /var/log/password_sync.log
```
