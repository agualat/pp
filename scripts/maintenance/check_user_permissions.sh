#!/usr/bin/env bash
# Script para verificar permisos de usuarios del sistema
# Uso: sudo bash check_user_permissions.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔍 Verificación de Permisos de Usuarios"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar si se ejecuta como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Este script debe ejecutarse como root (sudo)${NC}"
  exit 1
fi

# Cargar configuración de base de datos
source /etc/default/sssd-pgsql 2>/dev/null || {
  DB_HOST="localhost"
  DB_PORT="5433"
  DB_NAME="postgres"
  NSS_DB_USER="postgres"
  NSS_DB_PASSWORD="postgres"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. VERIFICAR GRUPOS PRIVILEGIADOS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Grupo SUDO (acceso root)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SUDO_USERS=$(getent group sudo 2>/dev/null | cut -d: -f4)
if [ -z "$SUDO_USERS" ]; then
  echo -e "${YELLOW}⚠️  Grupo sudo vacío${NC}"
else
  echo -e "${YELLOW}⚠️  Usuarios con sudo:${NC}"
  echo "$SUDO_USERS" | tr ',' '\n' | while read -r user; do
    [ -z "$user" ] && continue
    echo "   - $user"
  done
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Grupo ADMIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ADMIN_USERS=$(getent group admin 2>/dev/null | cut -d: -f4)
if [ -z "$ADMIN_USERS" ]; then
  echo -e "${GREEN}✅ Grupo admin vacío (correcto)${NC}"
else
  echo -e "${YELLOW}⚠️  Usuarios con admin:${NC}"
  echo "$ADMIN_USERS" | tr ',' '\n' | while read -r user; do
    [ -z "$user" ] && continue
    echo "   - $user"
  done
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Grupo DOCKER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DOCKER_USERS=$(getent group docker 2>/dev/null | cut -d: -f4)
if [ -z "$DOCKER_USERS" ]; then
  echo -e "${YELLOW}⚠️  Grupo docker vacío${NC}"
else
  echo -e "${GREEN}✅ Usuarios con docker:${NC}"
  echo "$DOCKER_USERS" | tr ',' '\n' | while read -r user; do
    [ -z "$user" ] && continue
    echo "   - $user"
  done
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. VERIFICAR USUARIOS DE LA BASE DE DATOS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👥 Usuarios de Base de Datos"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Intentar conectar a la base de datos
DB_USERS=$(PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "SELECT username FROM users WHERE is_active = 1 ORDER BY username" 2>&1)

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error conectando a base de datos${NC}"
  echo "   Verifica que client_db esté corriendo: docker compose ps"
  echo ""
  DB_USERS=""
else
  if [ -z "$DB_USERS" ]; then
    echo -e "${YELLOW}ℹ️  No hay usuarios activos en la base de datos${NC}"
  else
    echo -e "${GREEN}✅ Usuarios activos en DB: $(echo "$DB_USERS" | wc -l)${NC}"
    echo ""

    # Verificar cada usuario
    echo "Verificando permisos individuales..."
    echo ""

    USERS_OK=0
    USERS_WITH_SUDO=0
    USERS_WITHOUT_DOCKER=0
    USERS_NOT_EXIST=0

    while IFS= read -r username; do
      [ -z "$username" ] && continue

      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "👤 Usuario: $username"

      # Verificar si existe en el sistema
      if ! id "$username" > /dev/null 2>&1; then
        echo -e "   ${YELLOW}⏭️  No existe en el sistema${NC}"
        USERS_NOT_EXIST=$((USERS_NOT_EXIST + 1))
        continue
      fi

      # Obtener grupos
      USER_GROUPS=$(groups "$username" 2>/dev/null | cut -d: -f2 | xargs)
      echo "   📋 Grupos: $USER_GROUPS"

      HAS_ISSUES=0

      # Verificar sudo
      if echo "$USER_GROUPS" | grep -qw "sudo"; then
        echo -e "   ${RED}❌ TIENE SUDO (INSEGURO)${NC}"
        USERS_WITH_SUDO=$((USERS_WITH_SUDO + 1))
        HAS_ISSUES=1
      else
        echo -e "   ${GREEN}✅ Sin sudo (correcto)${NC}"
      fi

      # Verificar admin
      if echo "$USER_GROUPS" | grep -qw "admin"; then
        echo -e "   ${RED}❌ TIENE ADMIN (INSEGURO)${NC}"
        HAS_ISSUES=1
      else
        echo -e "   ${GREEN}✅ Sin admin (correcto)${NC}"
      fi

      # Verificar docker
      if echo "$USER_GROUPS" | grep -qw "docker"; then
        echo -e "   ${GREEN}✅ Tiene docker (correcto)${NC}"
      else
        echo -e "   ${YELLOW}⚠️  Sin docker (puede causar problemas)${NC}"
        USERS_WITHOUT_DOCKER=$((USERS_WITHOUT_DOCKER + 1))
        HAS_ISSUES=1
      fi

      # Verificar permisos sudo con comando
      SUDO_CHECK=$(sudo -l -U "$username" 2>&1)
      if echo "$SUDO_CHECK" | grep -q "not allowed"; then
        echo -e "   ${GREEN}✅ Sudo verificado: NO permitido${NC}"
      else
        echo -e "   ${RED}⚠️  Sudo podría estar permitido${NC}"
        HAS_ISSUES=1
      fi

      if [ $HAS_ISSUES -eq 0 ]; then
        USERS_OK=$((USERS_OK + 1))
        echo -e "   ${GREEN}✅ ESTADO: Configuración correcta${NC}"
      else
        echo -e "   ${RED}❌ ESTADO: Requiere corrección${NC}"
      fi

      echo ""

    done <<< "$DB_USERS"
  fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. RESUMEN Y RECOMENDACIONES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$DB_USERS" ]; then
  TOTAL_USERS=$(echo "$DB_USERS" | grep -c .)
  echo "  Total usuarios en DB: $TOTAL_USERS"
  echo "  ✅ Configuración correcta: $USERS_OK"
  echo "  ❌ Con sudo (inseguro): $USERS_WITH_SUDO"
  echo "  ⚠️  Sin docker: $USERS_WITHOUT_DOCKER"
  echo "  ⏭️  No existen en sistema: $USERS_NOT_EXIST"
else
  echo "  No se pudieron verificar usuarios de DB"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 RECOMENDACIONES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$USERS_WITH_SUDO" -gt 0 ]; then
  echo -e "${RED}⚠️  ACCIÓN REQUERIDA: Usuarios con sudo encontrados${NC}"
  echo ""
  echo "   Ejecutar para limpiar:"
  echo "   sudo bash remove_sudo_from_db_users.sh"
  echo ""
fi

if [ "$USERS_WITHOUT_DOCKER" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Usuarios sin acceso docker${NC}"
  echo ""
  echo "   Ejecutar para sincronizar:"
  echo "   sudo bash client/utils/sync_docker_group.sh"
  echo ""
fi

if [ "$USERS_NOT_EXIST" -gt 0 ]; then
  echo -e "${YELLOW}ℹ️  Usuarios en DB pero no en sistema${NC}"
  echo ""
  echo "   Estos usuarios se crearán en la próxima sincronización"
  echo "   o ejecuta: sudo bash client/utils/sync_docker_group.sh"
  echo ""
fi

if [ "$USERS_OK" -gt 0 ] && [ "$USERS_WITH_SUDO" -eq 0 ] && [ "$USERS_WITHOUT_DOCKER" -eq 0 ]; then
  echo -e "${GREEN}✅ SISTEMA CONFIGURADO CORRECTAMENTE${NC}"
  echo ""
  echo "   Todos los usuarios tienen:"
  echo "   • Acceso a Docker ✅"
  echo "   • Sin acceso sudo ✅"
  echo ""
fi

# Verificar archivos sudoers adicionales
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 Archivos sudoers adicionales"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d /etc/sudoers.d ]; then
  SUDOERS_FILES=$(ls -1 /etc/sudoers.d/ 2>/dev/null | grep -v README)
  if [ -z "$SUDOERS_FILES" ]; then
    echo -e "${GREEN}✅ No hay archivos sudoers adicionales${NC}"
  else
    echo -e "${YELLOW}⚠️  Archivos encontrados:${NC}"
    ls -lh /etc/sudoers.d/ | grep -v total | grep -v README | while read -r line; do
      echo "   $line"
    done
    echo ""
    echo "   Revisar manualmente cada archivo:"
    echo "   sudo cat /etc/sudoers.d/<filename>"
  fi
else
  echo "   Directorio /etc/sudoers.d no existe"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Verificación completada"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
