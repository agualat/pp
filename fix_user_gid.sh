#!/usr/bin/env bash
# Script para actualizar GID de usuarios en la BD y regenerar archivos NSS
# Este sistema usa NSS con archivos generados desde PostgreSQL
# Ejecutar como: sudo bash fix_user_gid.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Actualizar GID de Usuarios (NSS/PostgreSQL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Este script debe ejecutarse como root (sudo)"
  exit 1
fi

# Cargar configuración
source /etc/default/sssd-pgsql 2>/dev/null || {
  DB_HOST="localhost"
  DB_PORT="5433"
  DB_NAME="postgres"
  NSS_DB_USER="postgres"
  NSS_DB_PASSWORD="postgres"
}

echo "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Detectar GID de docker
if ! getent group docker > /dev/null 2>&1; then
  echo "❌ Grupo docker no existe. Instala Docker primero."
  exit 1
fi

DOCKER_GID=$(getent group docker | cut -d: -f3)
echo "📦 Docker GID detectado: $DOCKER_GID"
echo ""

# Contar usuarios que necesitan actualización
echo "🔍 Verificando usuarios en base de datos..."
USERS_TO_UPDATE=$(PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "SELECT COUNT(*) FROM users WHERE is_active = 1 AND (system_gid IS NULL OR system_gid != $DOCKER_GID);" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Error consultando base de datos"
  exit 1
fi

TOTAL_ACTIVE=$(PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "SELECT COUNT(*) FROM users WHERE is_active = 1;" 2>&1)

echo "  👥 Usuarios activos en BD: $TOTAL_ACTIVE"
echo "  🔧 Usuarios que necesitan actualización: $USERS_TO_UPDATE"
echo ""

if [ "$USERS_TO_UPDATE" -eq 0 ]; then
  echo "✅ Todos los usuarios ya tienen GID correcto ($DOCKER_GID)"
  echo ""
  echo "Para verificar:"
  echo "  sudo ./check_user_permissions.sh"
  exit 0
fi

# Mostrar usuarios que se actualizarán
echo "📋 Usuarios que se actualizarán:"
PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -c "SELECT username, system_uid, COALESCE(system_gid::text, 'NULL') as current_gid, '$DOCKER_GID' as new_gid
      FROM users
      WHERE is_active = 1 AND (system_gid IS NULL OR system_gid != $DOCKER_GID)
      ORDER BY username;" 2>&1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  ADVERTENCIA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Este script actualizará el GID en la base de datos"
echo "  y regenerará los archivos NSS."
echo ""
echo "  Los usuarios deberán RECONECTAR por SSH para aplicar cambios."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "¿Continuar? (s/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "❌ Operación cancelada"
  exit 0
fi

echo ""
echo "🔄 Actualizando base de datos..."

# Actualizar system_gid en la base de datos
UPDATE_RESULT=$(PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "UPDATE users SET system_gid = $DOCKER_GID WHERE is_active = 1 AND (system_gid IS NULL OR system_gid != $DOCKER_GID);
   SELECT COUNT(*) FROM users WHERE is_active = 1 AND system_gid = $DOCKER_GID;" 2>&1)

if [ $? -eq 0 ]; then
  UPDATED_COUNT=$(echo "$UPDATE_RESULT" | tail -1)
  echo "  ✅ Base de datos actualizada ($UPDATED_COUNT usuarios con GID $DOCKER_GID)"
else
  echo "  ❌ Error actualizando base de datos"
  echo "  Detalles: $UPDATE_RESULT"
  exit 1
fi

echo ""
echo "📝 Regenerando archivos NSS..."

# Regenerar archivo passwd
if [ -x /usr/local/bin/generate_passwd_from_db.sh ]; then
  echo "  🔄 Regenerando passwd..."
  /usr/local/bin/generate_passwd_from_db.sh
  if [ $? -eq 0 ]; then
    echo "  ✅ Archivo passwd regenerado"
  else
    echo "  ⚠️  Error regenerando passwd"
  fi
else
  echo "  ⚠️  Script generate_passwd_from_db.sh no encontrado"
fi

# Regenerar archivo shadow
if [ -x /usr/local/bin/generate_shadow_from_db.sh ]; then
  echo "  🔄 Regenerando shadow..."
  /usr/local/bin/generate_shadow_from_db.sh
  if [ $? -eq 0 ]; then
    echo "  ✅ Archivo shadow regenerado"
  else
    echo "  ⚠️  Error regenerando shadow"
  fi
else
  echo "  ⚠️  Script generate_shadow_from_db.sh no encontrado"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Actualización Completada"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Resumen:"
echo "  🔧 Usuarios actualizados en BD: $USERS_TO_UPDATE"
echo "  📦 Nuevo GID (docker): $DOCKER_GID"
echo "  ✅ Archivos NSS regenerados"
echo ""
echo "⚠️  IMPORTANTE: Los usuarios deben RECONECTAR por SSH"
echo ""
echo "📝 Próximos pasos:"
echo "  1. Verificar que los archivos fueron regenerados:"
echo "     cat /etc/passwd-pgsql | head -5"
echo ""
echo "  2. Verificar un usuario:"
echo "     getent passwd <username>"
echo "     id <username>"
echo ""
echo "  3. Ejecutar sync para asegurar todo:"
echo "     sudo bash client/utils/sync_docker_group.sh"
echo ""
echo "  4. Verificar permisos finales:"
echo "     sudo ./check_user_permissions.sh"
echo ""
echo "  5. Usuarios deben reconectar SSH (los cambios se aplican al reconectar)"
echo ""

exit 0
