#!/usr/bin/env bash
set -euo pipefail

# Wait for local database to be ready
echo "Waiting for local database to be ready..."
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${NSS_DB_USER}" > /dev/null 2>&1; do
  echo "Local database is unavailable - sleeping"
  sleep 2
done
echo "✓ Local database is ready"

# Verify users table exists, create if missing
echo "Verifying users table..."
if PGPASSWORD="${NSS_DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${NSS_DB_USER}" -d "${DB_NAME}" -c "\d users" > /dev/null 2>&1; then
  echo "✓ Users table exists"
else
  echo "⚠ Users table not found, creating it..."
  
  # Create users table
  PGPASSWORD="${NSS_DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${NSS_DB_USER}" -d "${DB_NAME}" << 'EOF'
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    system_uid INTEGER UNIQUE NOT NULL,
    system_gid INTEGER DEFAULT 2000,
    ssh_public_key VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT username_valid_pattern CHECK (username ~ '^[a-z_][a-z0-9_-]*$')
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_system_uid ON users(system_uid);
EOF

  # Verify creation was successful
  if PGPASSWORD="${NSS_DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${NSS_DB_USER}" -d "${DB_NAME}" -c "\d users" > /dev/null 2>&1; then
    echo "✓ Users table created successfully"
  else
    echo "✗ ERROR: Failed to create users table!"
    echo "  Please check database permissions and logs."
    exit 1
  fi
fi

# Real-time synchronization via API only
echo "ℹ️  Using real-time user synchronization via API"
echo "    Server endpoint: /sync/users/manual (manual sync)"
echo "    Client endpoint: /api/sync/users (receives updates)"

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
