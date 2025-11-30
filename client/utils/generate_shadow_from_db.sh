#!/usr/bin/env bash
# Generate /etc/shadow-pgsql entries from PostgreSQL
# This script is called to keep /var/lib/extrausers/shadow synchronized

source /etc/default/sssd-pgsql 2>/dev/null || {
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5433}"
  DB_NAME="${DB_NAME:-mydb}"
  NSS_DB_USER="${NSS_DB_USER:-postgres}"
  NSS_DB_PASSWORD="${NSS_DB_PASSWORD:-postgres}"
}

TEMP_FILE="/var/lib/extrausers/shadow.tmp"
TARGET_FILE="/var/lib/extrausers/shadow"

# Generate shadow entries from PostgreSQL
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
  chown root:shadow "$TARGET_FILE"
else
  rm -f "$TEMP_FILE"
  exit 1
fi
