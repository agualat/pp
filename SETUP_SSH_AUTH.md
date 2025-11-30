# Instalación de Autenticación PostgreSQL en el Host

Este documento explica cómo configurar autenticación SSH en el **host físico** usando la base de datos PostgreSQL de usuarios con **libnss-extrausers**.

## ¿Por qué extrausers?

Después de probar varias soluciones (libnss-pgsql2, SSSD), la solución más simple y funcional es:
- ✅ **libnss-extrausers**: Lee archivos passwd/shadow/group adicionales
- ✅ **Scripts de sincronización**: Generan archivos desde PostgreSQL cada 2 minutos
- ✅ **PAM personalizado**: Verifica contraseñas directamente contra PostgreSQL
- ✅ Simple, confiable y sin dependencias complejas

## Prerequisitos

- Ubuntu/Debian Linux
- Docker y docker-compose ejecutándose
- Acceso root/sudo en el host
- Python 3 con psycopg2 instalado

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                       HOST MACHINE                           │
│                                                              │
│  ┌──────────┐      ┌───────────────┐    ┌──────────────┐   │
│  │   SSH    │──>───│ extrausers    │───>│ /etc/passwd- │   │
│  │  Server  │      │ (NSS module)  │    │   pgsql      │   │
│  └──────────┘      └───────────────┘    └──────────────┘   │
│       │                                          ▲           │
│       │ PAM                                      │           │
│       ▼                                          │           │
│  ┌──────────────┐                    ┌──────────┴───────┐   │
│  │ PAM Script   │───────────────────>│   PostgreSQL     │   │
│  │ (verify pwd) │                    │   (port 5433)    │   │
│  └──────────────┘                    └──────────────────┘   │
│                                               ▲              │
│  ┌──────────────────────────────────────┐    │              │
│  │  Systemd Timer (every 2 min)        │────┘              │
│  │  - generate_passwd_from_db.sh       │                   │
│  │  - generate_shadow_from_db.sh       │                   │
│  └──────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │ User Replication (container)
                            │ (every 2 minutes)
                    ┌───────┴────────┐
                    │  Central DB    │
                    │  (port 5432)   │
                    └────────────────┘
```

## Pasos de Instalación

### 1. Asegurar que el contenedor cliente esté ejecutándose

```bash
cd /home/staffteam/pp
docker compose up -d client client_db
```

Esto iniciará:
- `client_db`: Base de datos PostgreSQL con los usuarios (puerto 5433 en el host)
- `client`: Servicio que sincroniza usuarios desde la BD central cada 2 minutos

### 2. Verificar que la replicación de usuarios funciona

```bash
# Ver logs del cliente
docker compose logs client --tail 20

# Deberías ver mensajes como:
# ✅ Replication complete: X/X users synced

# Verificar usuarios en la base de datos
docker compose exec client_db psql -U postgres -d mydb -c "SELECT username, system_uid, is_active FROM users;"
```

### 3. Verificar conectividad desde el host

```bash
# Instalar cliente PostgreSQL si no está instalado
sudo apt install -y postgresql-client

# Probar conexión
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mydb -c "SELECT username FROM users;"
```

Deberías ver la lista de usuarios. Si falla, verifica:
- El contenedor `client_db` está corriendo
- El puerto 5433 está mapeado en `docker-compose.yml`
- No hay firewall bloqueando el puerto

### 4. Instalar libnss-extrausers y configurar en el Host

**IMPORTANTE**: Los siguientes pasos deben ejecutarse en el **HOST**, no dentro del contenedor.

```bash
# Instalar libnss-extrausers
sudo apt install -y libnss-extrausers postgresql-client

# Configurar variables de entorno
export DB_HOST=localhost
export DB_PORT=5433
export DB_NAME=mydb
export NSS_DB_USER=postgres
export NSS_DB_PASSWORD=postgres  # Usar la contraseña de tu .env

# Crear archivo de configuración
sudo bash -c 'cat > /etc/default/sssd-pgsql <<EOF
DB_HOST=localhost
DB_PORT=5433
DB_NAME=mydb
NSS_DB_USER=postgres
NSS_DB_PASSWORD=postgres
EOF'
sudo chmod 600 /etc/default/sssd-pgsql

# Copiar scripts de generación
sudo cp /home/staffteam/pp/client/utils/generate_passwd_from_db.sh /usr/local/bin/
sudo cp /home/staffteam/pp/client/utils/generate_shadow_from_db.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/generate_*.sh

# Generar archivos iniciales
sudo bash /usr/local/bin/generate_passwd_from_db.sh
sudo bash /usr/local/bin/generate_shadow_from_db.sh

# Configurar estructura de extrausers
sudo mkdir -p /var/lib/extrausers
sudo ln -sf /etc/passwd-pgsql /var/lib/extrausers/passwd
sudo ln -sf /var/lib/extrausers/shadow /var/lib/extrausers/shadow
sudo touch /var/lib/extrausers/group
sudo bash -c 'echo "admin:x:2000:" > /var/lib/extrausers/group'

# Modificar nsswitch.conf
sudo sed -i 's/^passwd:.*/passwd:         files extrausers/' /etc/nsswitch.conf
sudo sed -i 's/^group:.*/group:          files extrausers/' /etc/nsswitch.conf
sudo sed -i 's/^shadow:.*/shadow:         files extrausers/' /etc/nsswitch.conf

# Verificar que funciona
getent passwd admin
id admin
```

### 5. Configurar sincronización automática

Crear systemd timer para actualizar usuarios cada 2 minutos:

```bash
# Crear servicio
sudo tee /etc/systemd/system/pgsql-users-sync.service <<'EOF'
[Unit]
Description=Sync PostgreSQL users to local files
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash /usr/local/bin/generate_passwd_from_db.sh
ExecStart=/bin/bash /usr/local/bin/generate_shadow_from_db.sh
StandardOutput=journal
StandardError=journal
EOF

# Crear timer
sudo tee /etc/systemd/system/pgsql-users-sync.timer <<'EOF'
[Unit]
Description=Sync PostgreSQL users every 2 minutes
Requires=pgsql-users-sync.service

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min
Unit=pgsql-users-sync.service

[Install]
WantedBy=timers.target
EOF

# Habilitar y iniciar
sudo systemctl daemon-reload
sudo systemctl enable pgsql-users-sync.timer
sudo systemctl start pgsql-users-sync.timer
sudo systemctl status pgsql-users-sync.timer
```

### 6. Configurar autenticación PAM

El script PAM ya fue creado por el setup, pero verificamos:

```bash
# Verificar PAM config
cat /etc/pam.d/sssd-pgsql

# Verificar script de autenticación
cat /usr/local/bin/pgsql-pam-auth.sh
```

### 7. Configurar SSH (si no está configurado)

Editar `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Asegurar que estas líneas estén configuradas:

```
# Permitir autenticación con contraseña
PasswordAuthentication yes

# Usar PAM para autenticación
UsePAM yes

# Crear directorio home automáticamente
UsePAM yes
```

Reiniciar SSH:

```bash
sudo systemctl restart sshd
```

### 7. Probar autenticación

```bash
# Cambiar a un usuario de PostgreSQL
su - admin

# O probar SSH
ssh admin@localhost
```

Usar la contraseña del usuario almacenada en PostgreSQL (formato: `username2025` sin el símbolo `+`).

## Arquitectura de Archivos

```
/etc/
├── sssd/
│   └── sssd.conf                    # Configuración principal de SSSD
├── pam.d/
│   └── sssd-pgsql                   # PAM config para autenticación PostgreSQL
├── default/
│   └── sssd-pgsql                   # Variables de entorno para scripts
└── nsswitch.conf                    # Modificado para incluir 'sss'

/usr/local/bin/
├── sssd-pgsql-proxy.py              # Script Python para lookup de usuarios
├── pgsql-pam-auth.sh                # Script Bash para autenticación PAM
└── nss-pgsql-wrapper                # Wrapper para testing

/var/lib/sss/
└── db/                              # Caché de SSSD
```

## Cómo Funciona

### Lookup de Usuarios (NSS)

1. Cuando ejecutas `getent passwd admin`:
   - NSS consulta `/etc/nsswitch.conf`
   - Ve que `passwd: files sss` incluye SSSD
   - SSSD usa el dominio `PGSQL` configurado
   - SSSD ejecuta el script proxy Python
   - El script consulta PostgreSQL vía psycopg2
   - Retorna información del usuario en formato passwd

### Autenticación (PAM)

1. Cuando intentas hacer SSH:
   - PAM consulta `/etc/pam.d/sshd`
   - SSH usa PAM común-auth que incluye `pam_sss.so`
   - SSSD consulta la configuración `sssd-pgsql`
   - Ejecuta `/usr/local/bin/pgsql-pam-auth.sh`
   - El script verifica usuario y contraseña en PostgreSQL
   - Si es válido, PAM crea el home directory automáticamente

### Replicación Automática

- Script en container `client`: `/app/client/utils/replicate_db.py`
- Cron job: Cada 2 minutos
- Proceso: TRUNCATE tabla users + INSERT desde central DB
- Garantiza que cambios en central DB se propaguen rápidamente

## Troubleshooting

### SSSD no inicia

```bash
# Ver logs detallados
sudo journalctl -u sssd -f

# Verificar sintaxis de configuración
sudo sssctl config-check

# Limpiar caché y reiniciar
sudo systemctl stop sssd
sudo rm -rf /var/lib/sss/db/*
sudo systemctl start sssd
```

### getent passwd no muestra usuarios de PostgreSQL

```bash
# Probar el script proxy directamente
sudo /usr/local/bin/nss-pgsql-wrapper getpwent

# Si el proxy funciona pero getent no:
# Verificar que nsswitch.conf tenga 'sss'
grep "^passwd:" /etc/nsswitch.conf

# Debería mostrar: passwd: files sss

# Verificar que SSSD esté corriendo
sudo systemctl status sssd

# Aumentar nivel de debug en SSSD
sudo nano /etc/sssd/sssd.conf
# Agregar bajo [domain/PGSQL]:
# debug_level = 9

sudo systemctl restart sssd
sudo journalctl -u sssd -f
```

### Autenticación falla

```bash
# Probar script PAM directamente
echo -e "admin\npassword123" | sudo /usr/local/bin/pgsql-pam-auth.sh
echo $?  # Debería ser 0 si exitoso

# Verificar que PostgreSQL esté accesible
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mydb -c "SELECT username, is_active FROM users WHERE username='admin';"

# Ver logs de autenticación
sudo tail -f /var/log/auth.log

# Probar PAM directamente
sudo pamtester sssd-pgsql admin authenticate
```

### Usuario no tiene home directory

```bash
# Verificar configuración de pam_mkhomedir
grep mkhomedir /etc/pam.d/sssd-pgsql

# Debería tener:
# session optional pam_mkhomedir.so skel=/etc/skel umask=0022

# Crear manualmente si es necesario
sudo mkhomedir_helper admin
```

### Permisos negados

```bash
# Verificar permisos de archivos de configuración
sudo ls -l /etc/sssd/sssd.conf
# Debería ser: -rw------- root root

sudo ls -l /etc/default/sssd-pgsql
# Debería ser: -rw------- root root

# Corregir si es necesario
sudo chmod 600 /etc/sssd/sssd.conf
sudo chmod 600 /etc/default/sssd-pgsql
```

### La base de datos no tiene usuarios

```bash
# Forzar replicación manual
docker compose exec client python3 /app/client/utils/replicate_db.py

# Verificar usuarios replicados
docker compose exec client_db psql -U postgres -d mydb -c "SELECT * FROM users;"
```

## Seguridad

### Consideraciones

- ✅ Contraseñas hasheadas con bcrypt en la base de datos
- ✅ Credenciales de DB almacenadas en `/etc/default/sssd-pgsql` (modo 600)
- ✅ SSSD config en modo 600 (solo root)
- ✅ Puerto 5433 solo accesible desde localhost (no expuesto externamente)
- ⚠️ Scripts ejecutan queries SQL - validar input cuidadosamente
- ⚠️ PAM script lee contraseñas en texto plano (necesario para autenticación)

### Recomendaciones

1. **Firewall**: Asegurar que puerto 5433 no esté expuesto a internet
   ```bash
   sudo ufw status
   sudo ufw allow from 127.0.0.1 to any port 5433
   ```

2. **Permisos**: Verificar permisos de archivos críticos
   ```bash
   sudo chmod 600 /etc/sssd/sssd.conf
   sudo chmod 600 /etc/default/sssd-pgsql
   sudo chmod 700 /usr/local/bin/pgsql-pam-auth.sh
   ```

3. **Auditoría**: Monitorear logs de autenticación
   ```bash
   sudo tail -f /var/log/auth.log
   ```

4. **Usuarios**: Solo usuarios con `is_active = 1` pueden autenticarse

## Crear Usuarios Nuevos

### Desde el Frontend

1. Ir a Dashboard → Users
2. Click "Create User" para crear uno individual
3. Click "Bulk Upload" para cargar archivo CSV/TXT con múltiples usuarios

### Formato de Archivos para Bulk Upload

**CSV**: Debe tener columna `username`
```csv
username
juan
maria
pedro
```

**TXT**: Un usuario por línea
```
juan
maria
pedro
```

Los usuarios creados tendrán:
- Email: `{username}@estud.usfq.edu.ec`
- Password: `{username}2025` (sin símbolo +)
- UID: Auto-incrementado desde 2000
- Estado: Activo

### Verificar que usuarios nuevos se replicaron

```bash
# Esperar hasta 2 minutos para replicación automática
# O forzar replicación:
docker compose exec client python3 /app/client/utils/replicate_db.py

# Verificar en client_db
docker compose exec client_db psql -U postgres -d mydb -c "SELECT username, system_uid, created_at FROM users ORDER BY created_at DESC LIMIT 5;"

# Verificar que aparezcan en el sistema
getent passwd | tail -10
```

## Desinstalación

Si necesitas revertir la configuración:

```bash
# Detener SSSD
sudo systemctl stop sssd
sudo systemctl disable sssd

# Restaurar nsswitch.conf
sudo cp /etc/nsswitch.conf.backup.* /etc/nsswitch.conf

# Remover paquetes
sudo apt remove --purge sssd sssd-tools libpam-sss libnss-sss

# Remover archivos de configuración
sudo rm -rf /etc/sssd/
sudo rm /etc/pam.d/sssd-pgsql
sudo rm /etc/default/sssd-pgsql
sudo rm /usr/local/bin/sssd-pgsql-proxy.py
sudo rm /usr/local/bin/pgsql-pam-auth.sh
sudo rm /usr/local/bin/nss-pgsql-wrapper

# Limpiar caché
sudo rm -rf /var/lib/sss/
```

## Comandos Útiles

```bash
# Estado de SSSD
sudo systemctl status sssd

# Ver logs en tiempo real
sudo journalctl -u sssd -f

# Listar usuarios
getent passwd

# Buscar usuario específico
getent passwd admin

# Info de usuario
id admin

# Listar grupos
getent group

# Limpiar caché de SSSD
sudo sss_cache -E

# Test de conectividad a PostgreSQL
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mydb -c "\dt"

# Ver usuarios en la BD
docker compose exec client_db psql -U postgres -d mydb -c "SELECT username, system_uid, is_active FROM users;"

# Forzar replicación de usuarios
docker compose exec client python3 /app/client/utils/replicate_db.py

# Probar script proxy
/usr/local/bin/nss-pgsql-wrapper getpwnam admin

# Probar autenticación PAM
echo -e "admin\nadmin2025" | sudo /usr/local/bin/pgsql-pam-auth.sh && echo "Success" || echo "Failed"
```

## Referencias

- [SSSD Documentation](https://sssd.io/)
- [PAM Configuration Guide](https://www.linux-pam.org/)
- [NSSwitch Configuration](https://man7.org/linux/man-pages/man5/nsswitch.conf.5.html)
- [PostgreSQL Authentication](https://www.postgresql.org/docs/current/auth-password.html)
