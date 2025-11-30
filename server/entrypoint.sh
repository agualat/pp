#!/usr/bin/env bash
# Container entrypoint for API server
# - Optionally installs dependencies
# - Creates DB tables
# - Starts API with gunicorn+uvicorn workers

set -euo pipefail

APP_DIR=${APP_DIR:-/app}
WORKERS=${WORKERS:-2}
PORT=${PORT:-8000}
INSTALL_DEPS=${INSTALL_DEPS:-false}

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
exec gunicorn \
  -k uvicorn.workers.UvicornWorker \
  -w "$WORKERS" \
  -b 0.0.0.0:"$PORT" \
  server.main:app
