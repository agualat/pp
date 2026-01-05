#!/usr/bin/env bash
# Script para remover acceso sudo de todos los usuarios de PostgreSQL
# Ejecutar como: sudo bash remove_sudo_from_db_users.sh

set -e

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

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Removiendo acceso sudo de usuarios"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Base de datos: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Obtener lista de usuarios activos
echo "🔍 Consultando usuarios activos..."
USERS=$(PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "SELECT username FROM users WHERE is_active = 1" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Error consultando base de datos"
  echo "Detalles: $USERS"
  exit 1
fi

if [ -z "$USERS" ]; then
  echo "ℹ️  No se encontraron usuarios activos"
  exit 0
fi

echo "✅ Usuarios encontrados"
echo ""

REMOVED_SUDO=0
REMOVED_ADMIN=0
ALREADY_CLEAN=0
NOT_EXIST=0
ERRORS=0

while IFS= read -r username; do
  # Saltar líneas vacías
  [ -z "$username" ] && continue

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "👤 Usuario: $username"

  # Verificar si el usuario existe en el sistema
  if ! id "$username" > /dev/null 2>&1; then
    echo "  ⏭️  No existe en el sistema, omitiendo"
    NOT_EXIST=$((NOT_EXIST + 1))
    continue
  fi

  HAS_CHANGES=0

  # Verificar y remover de grupo sudo
  if groups "$username" 2>/dev/null | grep -q "\bsudo\b"; then
    echo "  🔓 Encontrado en grupo sudo"
    if deluser "$username" sudo > /dev/null 2>&1; then
      echo "  ✅ Removido del grupo sudo"
      REMOVED_SUDO=$((REMOVED_SUDO + 1))
      HAS_CHANGES=1
    else
      echo "  ❌ Error removiendo de grupo sudo"
      ERRORS=$((ERRORS + 1))
    fi
  fi

  # Verificar y remover de grupo admin
  if groups "$username" 2>/dev/null | grep -q "\badmin\b"; then
    echo "  🔓 Encontrado en grupo admin"
    if deluser "$username" admin > /dev/null 2>&1; then
      echo "  ✅ Removido del grupo admin"
      REMOVED_ADMIN=$((REMOVED_ADMIN + 1))
      HAS_CHANGES=1
    else
      echo "  ❌ Error removiendo de grupo admin"
      ERRORS=$((ERRORS + 1))
    fi
  fi

  # Verificar acceso sudo final
  SUDO_CHECK=$(sudo -l -U "$username" 2>&1)
  if echo "$SUDO_CHECK" | grep -q "not allowed"; then
    if [ $HAS_CHANGES -eq 0 ]; then
      echo "  ✅ Ya estaba sin acceso sudo"
      ALREADY_CLEAN=$((ALREADY_CLEAN + 1))
    else
      echo "  ✅ Acceso sudo removido exitosamente"
    fi
  else
    echo "  ⚠️  Usuario podría tener acceso sudo por otras reglas"
    echo "     Verificar: /etc/sudoers y /etc/sudoers.d/"
  fi

  # Mostrar grupos actuales
  CURRENT_GROUPS=$(groups "$username" 2>/dev/null | cut -d: -f2 | xargs)
  echo "  📋 Grupos actuales: $CURRENT_GROUPS"
  echo ""

done <<< "$USERS"

# Resumen
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Resumen de Operaciones"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  👥 Usuarios procesados: $(echo "$USERS" | grep -c .)"
echo "  🔓 Removidos de sudo: $REMOVED_SUDO"
echo "  🔓 Removidos de admin: $REMOVED_ADMIN"
echo "  ✅ Ya sin acceso: $ALREADY_CLEAN"
echo "  ⏭️  No existen: $NOT_EXIST"
echo "  ❌ Errores: $ERRORS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "⚠️  Proceso completado con $ERRORS error(es)"
  echo ""
  echo "💡 Sugerencias:"
  echo "  - Verifica permisos de ejecución"
  echo "  - Revisa logs del sistema: journalctl -xe"
  exit 1
fi

if [ $REMOVED_SUDO -gt 0 ] || [ $REMOVED_ADMIN -gt 0 ]; then
  echo "✅ Proceso completado exitosamente"
  echo ""
  echo "📝 Notas importantes:"
  echo "  • Los usuarios deben cerrar sesión para que los cambios tengan efecto"
  echo "  • Las sesiones SSH activas mantendrán los grupos antiguos hasta reconectar"
  echo "  • Verifica manualmente: sudo -l -U <username>"
  echo ""
  echo "🔄 Para aplicar cambios inmediatamente a usuarios conectados:"
  echo "  sudo pkill -u <username>  # Forzar cierre de sesión"
else
  echo "✅ Todos los usuarios ya estaban limpios"
fi

echo ""
echo "🔍 Verificación adicional recomendada:"
echo "  getent group sudo    # Ver quién está en grupo sudo"
echo "  getent group admin   # Ver quién está en grupo admin"
echo ""

exit 0
