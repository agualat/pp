#!/usr/bin/env bash
# Script ejecutado por PAM cuando un usuario cambia su contraseña vía passwd/SSH
# Este script envía la nueva contraseña al servidor central para propagarla

set -e

# Cargar configuración
source /etc/default/sssd-pgsql 2>/dev/null || {
  echo "ERROR: Cannot load configuration from /etc/default/sssd-pgsql" >&2
  exit 1
}

# Variables requeridas
SERVER_URL="${SERVER_URL:-http://localhost:8000}"
CLIENT_HOSTNAME="${HOSTNAME:-$(hostname)}"

# Log file
LOGFILE="/var/log/password_sync.log"

# Función para log
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

# PAM proporciona el username en PAM_USER
USERNAME="${PAM_USER}"

if [ -z "$USERNAME" ]; then
  log "ERROR: No username provided by PAM"
  exit 1
fi

# Leer la nueva contraseña desde stdin (PAM la proporciona)
read -rs NEW_PASSWORD

if [ -z "$NEW_PASSWORD" ]; then
  log "ERROR: No password provided for user $USERNAME"
  exit 1
fi

log "Password change detected for user: $USERNAME from host: $CLIENT_HOSTNAME"

# Enviar al servidor central
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SERVER_URL}/api/users/${USERNAME}/change-password-from-client" \
  -H "Content-Type: application/json" \
  -H "X-Client-Host: ${CLIENT_HOSTNAME}" \
  -d "{\"new_password\": \"${NEW_PASSWORD}\"}" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  log "✅ Password successfully synced to central server for user: $USERNAME"
  echo "✅ Password changed successfully and synced to all servers" >&2
  exit 0
else
  log "❌ Failed to sync password for user: $USERNAME (HTTP $HTTP_CODE): $BODY"
  echo "⚠️  Password changed locally but sync to central server failed" >&2
  echo "   Contact your system administrator" >&2
  # No fallamos para no impedir el cambio local
  exit 0
fi
