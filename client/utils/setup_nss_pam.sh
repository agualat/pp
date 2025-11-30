#!/usr/bin/env bash
# Automated setup for NSS+PAM with PostgreSQL on Ubuntu/Debian clients
# - Installs required packages
# - Reads DB connection from .env
# - Generates /etc/nss-pgsql.conf and /etc/pam-pgsql.conf
# - Updates /etc/nsswitch.conf and /etc/pam.d/sshd
# - Ensures home dirs are created on first login
# - Restarts SSH daemon

set -euo pipefail

require_root() {
  if [[ "$EUID" -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      exec sudo -E bash "$0" "$@"
    else
      echo "This script must run as root (or with sudo)." >&2
      exit 1
    fi
  fi
}

load_env() {
  local env_file="${ENV_FILE:-.env}"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC2046
    export $(grep -v '^#' "$env_file" | xargs -d '\n')
  fi
  : "${DB_HOST:?Set DB_HOST in .env}"
  : "${DB_PORT:?Set DB_PORT in .env}"
  : "${DB_NAME:?Set DB_NAME in .env}"
  : "${NSS_DB_USER:?Set NSS_DB_USER in .env}"
  : "${NSS_DB_PASSWORD:?Set NSS_DB_PASSWORD in .env}"
}

install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y libnss-pgsql libpam-pgsql gettext-base
}

write_templates() {
  cat >/tmp/nss-pgsql.conf.template <<'TEMPLATE'
# /etc/nss-pgsql.conf
connectionstring = host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME} user=${NSS_DB_USER} password=${NSS_DB_PASSWORD}
getpwnam = \
    SELECT username, password_hash, system_uid, system_gid, \
           username AS gecos, '/home/' || username AS homedir, \
           '/bin/bash' AS shell \
    FROM users \
    WHERE username = $1 AND is_active = 1
getpwuid = \
    SELECT username, password_hash, system_uid, system_gid, \
           username AS gecos, '/home/' || username AS homedir, \
           '/bin/bash' AS shell \
    FROM users \
    WHERE system_uid = $1 AND is_active = 1
allusers = \
    SELECT username, password_hash, system_uid, system_gid, \
           username AS gecos, '/home/' || username AS homedir, \
           '/bin/bash' AS shell \
    FROM users \
    WHERE is_active = 1
getgrnam = \
    SELECT 'users' AS groupname, 2000 AS gid, \
           ARRAY_TO_STRING(ARRAY_AGG(username), ',') AS members \
    FROM users \
    WHERE is_active = 1 AND system_gid = 2000
getgrgid = \
    SELECT 'users' AS groupname, 2000 AS gid, \
           ARRAY_TO_STRING(ARRAY_AGG(username), ',') AS members \
    FROM users \
    WHERE is_active = 1 AND system_gid = $1
allgroups = \
    SELECT DISTINCT 'users' AS groupname, system_gid AS gid \
    FROM users \
    WHERE is_active = 1
groups_dyn = \
    SELECT system_gid \
    FROM users \
    WHERE username = $1 AND is_active = 1
getspnam = \
    SELECT username, password_hash, \
           18000 AS lastchange, 0 AS min, 99999 AS max, \
           7 AS warn, -1 AS inactive, -1 AS expire \
    FROM users \
    WHERE username = $1 AND is_active = 1
TEMPLATE

  cat >/tmp/pam-pgsql.conf.template <<'TEMPLATE'
# /etc/pam-pgsql.conf
# Database connection
database = ${DB_NAME}
host = ${DB_HOST}
port = ${DB_PORT}
user = ${NSS_DB_USER}
password = ${NSS_DB_PASSWORD}
# Table/columns
table = users
usercolumn = username
pwdcolumn = password_hash
pwdtype = bcrypt
# Only active users authenticate
query_auth = SELECT password_hash FROM users WHERE username = '%u' AND is_active = 1
TEMPLATE
}

apply_configs() {
  envsubst < /tmp/nss-pgsql.conf.template > /etc/nss-pgsql.conf
  chmod 600 /etc/nss-pgsql.conf && chown root:root /etc/nss-pgsql.conf

  envsubst < /tmp/pam-pgsql.conf.template > /etc/pam-pgsql.conf
  chmod 600 /etc/pam-pgsql.conf && chown root:root /etc/pam-pgsql.conf
}

ensure_nsswitch() {
  local f=/etc/nsswitch.conf
  for name in passwd group shadow; do
    if grep -E "^${name}:" "$f" | grep -q "pgsql"; then
      continue
    fi
    sed -i -E "s/^(${name}:[[:space:]]*.*files)(.*)$/\1 pgsql\2/" "$f"
  done
}

install_username_validator() {
  cat >/usr/local/sbin/validate_username.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
USER="${PAM_USER:-}"
[[ -n "$USER" ]] || exit 1
if [[ "$USER" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
  exit 0
else
  exit 1
fi
SCRIPT
  chmod 0755 /usr/local/sbin/validate_username.sh
}

ensure_pam_sshd() {
  local f=/etc/pam.d/sshd
  grep -q "pam_exec.so.*validate_username.sh" "$f" || sed -i "1i auth    requisite    pam_exec.so quiet /usr/local/sbin/validate_username.sh" "$f"
  grep -q "^auth[[:space:]]\+sufficient[[:space:]]\+pam_pgsql.so" "$f" || sed -i "2i auth    sufficient   pam_pgsql.so" "$f"
}

ensure_mkhomedir() {
  local f=/etc/pam.d/common-session
  if [[ -f "$f" ]]; then
    grep -q "pam_mkhomedir.so" "$f" || echo "session required    pam_mkhomedir.so skel=/etc/skel umask=0022" >> "$f"
  fi
}

restart_sshd() {
  if command -v systemctl >/dev/null 2>&1; then
    systemctl restart sshd || systemctl restart ssh
  else
    service ssh restart || service sshd restart || true
  fi
}

main() {
  require_root "$@"
  load_env
  install_packages
  write_templates
  apply_configs
  ensure_nsswitch
  install_username_validator
  ensure_pam_sshd
  ensure_mkhomedir
  restart_sshd
  echo "NSS+PAM setup completed successfully. Quick checks:"
  echo "- getent passwd | head"
  echo "- getent passwd your_username"
}

main "$@"
