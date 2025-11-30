#!/usr/bin/env bash
set -euo pipefail

# If DB envs are provided, run NSS/PAM setup (idempotent)
if [[ -n "${DB_HOST:-}" && -n "${DB_PORT:-}" && -n "${DB_NAME:-}" && -n "${NSS_DB_USER:-}" && -n "${NSS_DB_PASSWORD:-}" ]]; then
  if [[ -f "/etc/nss-pgsql.conf" && -f "/etc/pam-pgsql.conf" ]]; then
    echo "NSS/PAM configs already present; skipping setup."
  else
    echo "Running NSS/PAM setup against PostgreSQL..."
    export DB_HOST DB_PORT DB_NAME NSS_DB_USER NSS_DB_PASSWORD
    cd /app/client/utils
    bash ./setup_nss_pam.sh || echo "NSS/PAM setup script finished (or skipped)."
    cd /app
  fi
else
  echo "NSS/PAM setup skipped (DB envs not provided)."
fi

# Start client API
exec uvicorn client.main:app --host 0.0.0.0 --port 8100
