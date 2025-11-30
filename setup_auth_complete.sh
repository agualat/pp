#!/usr/bin/env bash
# Script completo para configurar autenticación SSH con PostgreSQL
# Ejecutar en el HOST (no en container) como: sudo bash setup_auth_complete.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Configuración de Autenticación SSH con PostgreSQL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar que se ejecuta como root
if [[ "$EUID" -ne 0 ]]; then
  echo "❌ Este script debe ejecutarse como root (sudo)"
  exit 1
fi

# Configuración
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-mydb}"
NSS_DB_USER="${NSS_DB_USER:-postgres}"
NSS_DB_PASSWORD="${NSS_DB_PASSWORD:-postgres}"

echo "📋 Configuración:"
echo "   DB_HOST: $DB_HOST"
echo "   DB_PORT: $DB_PORT"
echo "   DB_NAME: $DB_NAME"
echo "   DB_USER: $NSS_DB_USER"
echo ""

# 1. Instalar paquetes necesarios
echo "📦 [1/8] Instalando paquetes necesarios..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y libnss-extrausers postgresql-client > /dev/null 2>&1
echo "   ✅ Paquetes instalados"

# 2. Crear archivo de configuración
echo "⚙️  [2/8] Creando archivo de configuración..."
cat > /etc/default/sssd-pgsql <<EOF
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
NSS_DB_USER=$NSS_DB_USER
NSS_DB_PASSWORD=$NSS_DB_PASSWORD
EOF
chmod 600 /etc/default/sssd-pgsql
echo "   ✅ /etc/default/sssd-pgsql creado"

# 3. Crear script para generar passwd desde PostgreSQL
echo "📝 [3/8] Creando scripts de sincronización..."
cat > /usr/local/bin/generate_passwd_from_db.sh <<'SCRIPT_EOF'
#!/usr/bin/env bash
source /etc/default/sssd-pgsql 2>/dev/null || exit 1

TEMP_FILE="/etc/passwd-pgsql.tmp"
TARGET_FILE="/etc/passwd-pgsql"

PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -F: -c \
  "SELECT 
    username,
    'x',
    system_uid,
    system_gid,
    username,
    '/home/' || username,
    '/bin/bash'
   FROM users
   WHERE is_active = 1
   ORDER BY system_uid" > "$TEMP_FILE" 2>/dev/null

if [ $? -eq 0 ] && [ -s "$TEMP_FILE" ]; then
  mv "$TEMP_FILE" "$TARGET_FILE"
  chmod 644 "$TARGET_FILE"
else
  rm -f "$TEMP_FILE"
  exit 1
fi
SCRIPT_EOF

chmod +x /usr/local/bin/generate_passwd_from_db.sh

# 4. Crear script para generar shadow desde PostgreSQL
cat > /usr/local/bin/generate_shadow_from_db.sh <<'SCRIPT_EOF'
#!/usr/bin/env bash
source /etc/default/sssd-pgsql 2>/dev/null || exit 1

TEMP_FILE="/var/lib/extrausers/shadow.tmp"
TARGET_FILE="/var/lib/extrausers/shadow"

PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -F: -c \
  "SELECT 
    username,
    password_hash,
    '18000',
    '0',
    '99999',
    '7',
    '',
    '',
    ''
   FROM users
   WHERE is_active = 1
   ORDER BY system_uid" > "$TEMP_FILE" 2>/dev/null

if [ $? -eq 0 ] && [ -s "$TEMP_FILE" ]; then
  mv "$TEMP_FILE" "$TARGET_FILE"
  chmod 640 "$TARGET_FILE"
  chown root:shadow "$TARGET_FILE" 2>/dev/null || chown root:root "$TARGET_FILE"
else
  rm -f "$TEMP_FILE"
  exit 1
fi
SCRIPT_EOF

chmod +x /usr/local/bin/generate_shadow_from_db.sh
echo "   ✅ Scripts de sincronización creados"

# 5. Crear script de autenticación PAM
echo "🔐 [4/8] Configurando PAM..."
cat > /usr/local/bin/pgsql-pam-auth.sh <<'SCRIPT_EOF'
#!/usr/bin/env bash
set -euo pipefail

source /etc/default/sssd-pgsql 2>/dev/null || exit 1

# Leer credenciales de PAM
read -r username
read -rs password

# Validar formato de usuario
if ! [[ "$username" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
  exit 1
fi

# Verificar que el usuario existe y está activo
PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "SELECT 1 FROM users WHERE username = '${username}' AND is_active = 1" \
  2>/dev/null | grep -q "1" || exit 1

# Verificar contraseña usando bcrypt
PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "SELECT CASE WHEN password_hash = crypt('${password}', password_hash) THEN 1 ELSE 0 END FROM users WHERE username = '${username}'" \
  2>/dev/null | grep -q "1" && exit 0 || exit 1
SCRIPT_EOF

chmod +x /usr/local/bin/pgsql-pam-auth.sh

# Crear configuración PAM
cat > /etc/pam.d/sssd-pgsql <<'PAM_EOF'
#%PAM-1.0
auth    required    pam_exec.so quiet /usr/local/bin/pgsql-pam-auth.sh
account required    pam_permit.so
password required   pam_deny.so
session optional    pam_mkhomedir.so skel=/etc/skel umask=0022
PAM_EOF

echo "   ✅ PAM configurado"

# 6. Configurar estructura de extrausers
echo "📂 [5/8] Configurando extrausers..."
mkdir -p /var/lib/extrausers

# Generar archivos iniciales
bash /usr/local/bin/generate_passwd_from_db.sh
bash /usr/local/bin/generate_shadow_from_db.sh

# Crear symlink y archivos necesarios
ln -sf /etc/passwd-pgsql /var/lib/extrausers/passwd
touch /var/lib/extrausers/group

# Crear grupos básicos desde la BD
PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "SELECT DISTINCT username || ':x:' || system_gid || ':' FROM users WHERE is_active = 1 ORDER BY system_gid" \
  > /var/lib/extrausers/group 2>/dev/null || echo "admin:x:2000:" > /var/lib/extrausers/group

echo "   ✅ Estructura de extrausers configurada"

# 7. Modificar nsswitch.conf
echo "🔧 [6/8] Modificando nsswitch.conf..."
cp /etc/nsswitch.conf /etc/nsswitch.conf.backup.$(date +%Y%m%d_%H%M%S)

sed -i 's/^passwd:.*/passwd:         files extrausers/' /etc/nsswitch.conf
sed -i 's/^group:.*/group:          files extrausers/' /etc/nsswitch.conf
sed -i 's/^shadow:.*/shadow:         files extrausers/' /etc/nsswitch.conf

echo "   ✅ nsswitch.conf modificado"

# 8. Crear systemd timer para sincronización automática
echo "⏰ [7/8] Configurando sincronización automática..."
cat > /etc/systemd/system/pgsql-users-sync.service <<'SERVICE_EOF'
[Unit]
Description=Sync PostgreSQL users to local files
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash /usr/local/bin/generate_passwd_from_db.sh
ExecStart=/bin/bash /usr/local/bin/generate_shadow_from_db.sh
StandardOutput=journal
StandardError=journal
SERVICE_EOF

cat > /etc/systemd/system/pgsql-users-sync.timer <<'TIMER_EOF'
[Unit]
Description=Sync PostgreSQL users every 2 minutes
Requires=pgsql-users-sync.service

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min
Unit=pgsql-users-sync.service

[Install]
WantedBy=timers.target
TIMER_EOF

systemctl daemon-reload
systemctl enable pgsql-users-sync.timer > /dev/null 2>&1
systemctl start pgsql-users-sync.timer

echo "   ✅ Timer systemd configurado y activo"

# 9. Verificar configuración
echo ""
echo "✅ [8/8] Verificando instalación..."
echo ""

# Probar conexión a PostgreSQL
if PGPASSWORD="${NSS_DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${NSS_DB_USER}" -d "${DB_NAME}" -c "SELECT 1" > /dev/null 2>&1; then
  echo "   ✅ Conexión a PostgreSQL exitosa"
else
  echo "   ❌ Error conectando a PostgreSQL"
  exit 1
fi

# Verificar usuarios
USERS=$(getent passwd | grep -E "^(admin|karby)" | wc -l)
if [ "$USERS" -gt 0 ]; then
  echo "   ✅ Usuarios de PostgreSQL visibles en NSS"
  getent passwd | grep -E "^(admin|karby)" | sed 's/^/      - /'
else
  echo "   ⚠️  No se encontraron usuarios de PostgreSQL en NSS"
fi

# Verificar timer
if systemctl is-active --quiet pgsql-users-sync.timer; then
  echo "   ✅ Timer de sincronización activo"
else
  echo "   ⚠️  Timer de sincronización no activo"
fi

# Resumen
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Instalación Completada"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Archivos creados:"
echo "   • /etc/default/sssd-pgsql"
echo "   • /usr/local/bin/generate_passwd_from_db.sh"
echo "   • /usr/local/bin/generate_shadow_from_db.sh"
echo "   • /usr/local/bin/pgsql-pam-auth.sh"
echo "   • /etc/pam.d/sssd-pgsql"
echo "   • /var/lib/extrausers/{passwd,shadow,group}"
echo "   • /etc/systemd/system/pgsql-users-sync.{service,timer}"
echo ""
echo "🔍 Comandos de prueba:"
echo "   getent passwd admin        # Ver usuario"
echo "   id admin                   # Info de usuario"
echo "   ssh admin@localhost        # Login SSH (password: admin2025)"
echo ""
echo "⏰ Sincronización:"
echo "   • Automática cada 2 minutos"
echo "   • Manual: sudo systemctl start pgsql-users-sync.service"
echo ""
echo "📊 Monitoreo:"
echo "   systemctl status pgsql-users-sync.timer"
echo "   journalctl -u pgsql-users-sync.service -f"
echo ""
