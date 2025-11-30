#!/usr/bin/env bash
set -euo pipefail

# Wait for local database to be ready
echo "Waiting for local database to be ready..."
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${NSS_DB_USER}" > /dev/null 2>&1; do
  echo "Local database is unavailable - sleeping"
  sleep 2
done
echo "✓ Local database is ready"

# If DB envs are provided, run NSS/PAM setup (idempotent)
if [[ -n "${DB_HOST:-}" && -n "${DB_PORT:-}" && -n "${DB_NAME:-}" && -n "${NSS_DB_USER:-}" && -n "${NSS_DB_PASSWORD:-}" ]]; then
  if [[ -f "/etc/nss-pgsql.conf" && -f "/etc/pam-pgsql.conf" ]]; then
    echo "NSS/PAM configs already present; skipping setup."
  else
    echo "Running NSS/PAM setup against local PostgreSQL..."
    export DB_HOST DB_PORT DB_NAME NSS_DB_USER NSS_DB_PASSWORD
    cd /app/client/utils
    bash ./setup_nss_pam.sh || echo "NSS/PAM setup script finished (or skipped)."
    cd /app
  fi
  
  # Replicación inicial de usuarios desde BD central a BD local
  echo "Replicating users from central DB to local DB..."
  python3 /app/client/utils/replicate_db.py || echo "Initial replication finished (or failed)."
  
  # Configurar cron job para replicación periódica (cada 2 minutos)
  echo "*/2 * * * * python3 /app/client/utils/replicate_db.py >> /var/log/db_replication.log 2>&1" | crontab -
  
  # Iniciar cron en background
  cron
  echo "✓ Database replication cron job configured (every 2 minutes)"
else
  echo "NSS/PAM setup skipped (DB envs not provided)."
fi

# Start client API
exec uvicorn client.main:app --host 0.0.0.0 --port 8100
