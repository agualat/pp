#!/usr/bin/env bash
# Generate /etc/passwd entries from PostgreSQL
# This script is called by systemd timer to keep /etc/passwd-pgsql synchronized

set -e  # Exit on error

source /etc/default/sssd-pgsql 2>/dev/null || {
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5433}"
  DB_NAME="${DB_NAME:-postgres}"
  NSS_DB_USER="${NSS_DB_USER:-postgres}"
  NSS_DB_PASSWORD="${NSS_DB_PASSWORD:-postgres}"
}

# Crear directorio si no existe
mkdir -p /etc

TEMP_FILE="/etc/passwd-pgsql.tmp"
TARGET_FILE="/etc/passwd-pgsql"

# Generate passwd entries from PostgreSQL
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

if [ $? -eq 0 ]; then
  # Si el archivo está vacío, crear archivo vacío válido
  if [ ! -s "$TEMP_FILE" ]; then
    echo "⚠️  Warning: No active users found, creating empty passwd file" >&2
    touch "$TEMP_FILE"
  fi
  
  mv "$TEMP_FILE" "$TARGET_FILE" || {
    echo "❌ Error: Failed to move $TEMP_FILE to $TARGET_FILE" >&2
    exit 1
  }
  
  chmod 644 "$TARGET_FILE" || echo "⚠️  Warning: Could not set permissions on $TARGET_FILE" >&2
  
  echo "✅ Successfully generated $TARGET_FILE" >&2
else
  echo "❌ Error: PostgreSQL query failed" >&2
  rm -f "$TEMP_FILE"
  exit 1
fi
