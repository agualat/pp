#!/usr/bin/env bash
set -euo pipefail

# Wait for local database to be ready
echo "Waiting for local database to be ready..."
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${NSS_DB_USER}" > /dev/null 2>&1; do
  echo "Local database is unavailable - sleeping"
  sleep 2
done
echo "✓ Local database is ready"

# Wait for central database to be ready
echo "Waiting for central database to be ready..."
until pg_isready -h "${CENTRAL_DB_HOST:-db}" -p "${CENTRAL_DB_PORT:-5432}" -U "${CENTRAL_DB_USER:-postgres}" > /dev/null 2>&1; do
  echo "Central database is unavailable - sleeping"
  sleep 2
done
echo "✓ Central database is ready"

# Replicación inicial de usuarios desde BD central a BD local
echo "🔄 Replicating users from central DB to local DB..."
python3 /app/client/utils/replicate_db.py || echo "⚠️  Initial replication finished (or failed)."

# Configurar cron job para replicación periódica (cada 2 minutos)
echo "⏰ Configuring database replication cron job..."
mkdir -p /var/log
echo "*/2 * * * * python3 /app/client/utils/replicate_db.py >> /var/log/db_replication.log 2>&1" | crontab -

# Iniciar cron en background
cron
echo "✅ Database replication cron job configured (every 2 minutos)"

# Start client API
DEV_MODE=${DEV_MODE:-false}

echo ""
echo "========================================="
echo "📋 NSS/PAM Setup for HOST Machine"
echo "========================================="
echo ""
echo "The client_db is exposed on port 5433"
echo "To enable SSH authentication on the HOST, run:"
echo ""
echo "  export DB_HOST=localhost"
echo "  export DB_PORT=5433"
echo "  export DB_NAME=postgres"
echo "  export NSS_DB_USER=postgres"
echo "  export NSS_DB_PASSWORD=postgres"
echo ""
echo "  sudo -E bash client/utils/setup_nss_pam.sh"
echo ""
echo "See INSTALL_NSS_PAM_HOST.md for details"
echo "========================================="
echo ""

if [[ "$DEV_MODE" == "true" ]]; then
  echo "Starting client in DEV mode with hot reload..."
  exec uvicorn client.main:app --host 0.0.0.0 --port 8100 --reload
else
  echo "Starting client in PRODUCTION mode..."
  exec uvicorn client.main:app --host 0.0.0.0 --port 8100
fi
