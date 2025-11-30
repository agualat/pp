#!/usr/bin/env bash
# Container entrypoint for API server
# - Optionally installs dependencies
# - Creates DB tables
# - Starts API with gunicorn+uvicorn workers or uvicorn in dev mode

set -euo pipefail

APP_DIR=${APP_DIR:-/app}
WORKERS=${WORKERS:-2}
PORT=${PORT:-8000}
INSTALL_DEPS=${INSTALL_DEPS:-false}
DEV_MODE=${DEV_MODE:-false}

cd "$APP_DIR"

if [[ "$INSTALL_DEPS" == "true" ]]; then
  echo "Installing dependencies from server/requirements.txt..."
  pip install --no-cache-dir -r server/requirements.txt
fi

# Ensure DATABASE_URL is present or fallback used in code
: "${DATABASE_URL:=postgresql://postgres:1234@localhost:5432/mydb}"
export DATABASE_URL

# Create tables
python -m server.utils.start_db

# Start API
if [[ "$DEV_MODE" == "true" ]]; then
  echo "Starting server in DEV mode with hot reload..."
  # Aumentar timeouts y workers para WebSockets
  exec uvicorn server.main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --reload \
    --ws-ping-interval 10 \
    --ws-ping-timeout 30 \
    --timeout-keep-alive 75
else
  echo "Starting server in PRODUCTION mode..."
  # Configuración optimizada para WebSockets en producción
  exec gunicorn \
    -k uvicorn.workers.UvicornWorker \
    -w "$WORKERS" \
    -b 0.0.0.0:"$PORT" \
    --timeout 300 \
    --keep-alive 75 \
    --graceful-timeout 30 \
    server.main:app
fi
