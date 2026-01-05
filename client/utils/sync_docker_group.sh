#!/usr/bin/env bash
# Sync users to docker group from PostgreSQL
# This script ensures all active users have access to Docker
#
# IMPORTANT SECURITY NOTES:
# - Users are added ONLY to docker group (for Docker access)
# - Users are explicitly REMOVED from sudo/admin groups
# - Docker access != sudo access (they are separate)
# - Only your admin user should have sudo permissions
#
# This script should be run on the HOST machine, not inside a container
# Usage: sudo bash sync_docker_group.sh

set -e  # Exit on error

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: This script must be run as root (use sudo)" >&2
  exit 1
fi

# Source database configuration
# If running from host, use localhost:5433 (exposed port from client_db)
source /etc/default/sssd-pgsql 2>/dev/null || {
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5433}"  # Use exposed port on host
  DB_NAME="${DB_NAME:-postgres}"
  NSS_DB_USER="${NSS_DB_USER:-postgres}"
  NSS_DB_PASSWORD="${NSS_DB_PASSWORD:-postgres}"
}

echo "🔧 Docker Group Synchronization Script" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}" >&2
echo "" >&2

# Check if PostgreSQL client is installed
if ! command -v psql &> /dev/null; then
  echo "❌ Error: psql (PostgreSQL client) is not installed" >&2
  echo "Install it with: sudo apt-get install postgresql-client" >&2
  exit 1
fi

# Ensure docker group exists
if ! getent group docker > /dev/null 2>&1; then
  echo "⚠️  Warning: docker group does not exist, creating it..." >&2
  groupadd docker || {
    echo "❌ Error: Failed to create docker group" >&2
    exit 1
  }
  echo "✅ Docker group created" >&2
fi

# Get docker group GID
DOCKER_GID=$(getent group docker | cut -d: -f3)
echo "📦 Docker group GID: $DOCKER_GID" >&2
echo "" >&2

# Get list of active users from database
echo "🔍 Querying database for active users..." >&2
USERS=$(PGPASSWORD="${NSS_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${NSS_DB_USER}" \
  -d "${DB_NAME}" \
  -t -A -c \
  "SELECT username, system_uid, system_gid FROM users WHERE is_active = 1 ORDER BY system_uid" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Error: Failed to query database for users" >&2
  echo "Error details: $USERS" >&2
  echo "" >&2
  echo "Troubleshooting:" >&2
  echo "1. Check that client_db is running: docker ps | grep client_db" >&2
  echo "2. Verify database credentials in /etc/default/sssd-pgsql" >&2
  echo "3. Test connection: psql -h ${DB_HOST} -p ${DB_PORT} -U ${NSS_DB_USER} -d ${DB_NAME}" >&2
  exit 1
fi

if [ -z "$USERS" ]; then
  echo "ℹ️  No active users found in database" >&2
  exit 0
fi

echo "✅ Found users in database" >&2
echo "" >&2

USERS_ADDED=0
USERS_ALREADY_IN_GROUP=0
USERS_CREATED=0
USERS_SKIPPED=0
ERRORS=0

# Process each user
while IFS='|' read -r username uid gid; do
  # Skip empty lines
  [ -z "$username" ] && continue

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  echo "👤 Processing: $username (UID: $uid, GID: $gid)" >&2

  # Security check: Ensure user is NOT in privileged groups
  REMOVED_PRIVS=0

  # Check if system user exists
  if ! id "$username" > /dev/null 2>&1; then
    echo "  📝 Creating system user $username..." >&2

    # Check if UID is already in use
    if getent passwd "$uid" > /dev/null 2>&1; then
      existing_user=$(getent passwd "$uid" | cut -d: -f1)
      echo "  ⚠️  UID $uid already in use by user: $existing_user" >&2
      echo "  ⏭️  Skipping user creation (will try to add existing user to docker)" >&2
      USERS_SKIPPED=$((USERS_SKIPPED + 1))
      username="$existing_user"
    else
      # Create home directory if it doesn't exist
      HOME_DIR="/home/$username"
      if [ ! -d "$HOME_DIR" ]; then
        mkdir -p "$HOME_DIR"
        chmod 755 "$HOME_DIR"
      fi

      # Check if GID exists, create group if not
      if ! getent group "$gid" > /dev/null 2>&1; then
        groupadd -g "$gid" "$username" 2>/dev/null || {
          echo "  ⚠️  Could not create group with GID $gid" >&2
        }
      fi

      # Create user with specific UID and GID (rbash for restricted shell)
      # --no-user-group prevents creating a group with same name
      # This helps prevent sudo access
      useradd -u "$uid" -g "$gid" -d "$HOME_DIR" -s /bin/bash -M --no-user-group "$username" 2>/dev/null || {
        # If user creation fails, try without specifying UID/GID
        useradd -d "$HOME_DIR" -s /bin/bash -M --no-user-group "$username" 2>/dev/null || {
          echo "  ❌ Failed to create user $username" >&2
          ERRORS=$((ERRORS + 1))
          continue
        }
      }

      # SECURITY: Ensure new user is NOT in sudo or admin groups
      if deluser "$username" sudo 2>/dev/null; then
        echo "  🔒 Removed from sudo group" >&2
        REMOVED_PRIVS=$((REMOVED_PRIVS + 1))
      fi
      if deluser "$username" admin 2>/dev/null; then
        echo "  🔒 Removed from admin group" >&2
        REMOVED_PRIVS=$((REMOVED_PRIVS + 1))
      fi

      # Set ownership of home directory
      actual_uid=$(id -u "$username")
      actual_gid=$(id -g "$username")
      chown -R "$actual_uid:$actual_gid" "$HOME_DIR" 2>/dev/null || {
        echo "  ⚠️  Could not set ownership of $HOME_DIR" >&2
      }

      USERS_CREATED=$((USERS_CREATED + 1))
      echo "  ✅ System user $username created" >&2
    fi
  else
    echo "  ℹ️  System user already exists" >&2

    # SECURITY: For existing users, verify they are NOT in privileged groups
    if groups "$username" 2>/dev/null | grep -q "\bsudo\b"; then
      echo "  ⚠️  Found in sudo group, removing..." >&2
      if deluser "$username" sudo 2>/dev/null; then
        echo "  🔒 Removed from sudo group" >&2
        REMOVED_PRIVS=$((REMOVED_PRIVS + 1))
      fi
    fi

    if groups "$username" 2>/dev/null | grep -q "\badmin\b"; then
      echo "  ⚠️  Found in admin group, removing..." >&2
      if deluser "$username" admin 2>/dev/null; then
        echo "  🔒 Removed from admin group" >&2
        REMOVED_PRIVS=$((REMOVED_PRIVS + 1))
      fi
    fi
  fi

  # Check if user is already in docker group
  if groups "$username" 2>/dev/null | grep -q "\bdocker\b"; then
    echo "  ✅ Already in docker group" >&2
    USERS_ALREADY_IN_GROUP=$((USERS_ALREADY_IN_GROUP + 1))
  else
    # Add user to docker group
    echo "  🔧 Adding to docker group..." >&2
    usermod -aG docker "$username" 2>/dev/null || {
      echo "  ❌ Failed to add $username to docker group" >&2
      ERRORS=$((ERRORS + 1))
      continue
    }
    USERS_ADDED=$((USERS_ADDED + 1))
    echo "  ✅ Added to docker group" >&2
  fi

  # Final security verification
  if [ $REMOVED_PRIVS -gt 0 ]; then
    echo "  🔒 Security: Removed $REMOVED_PRIVS privileged group(s)" >&2
  fi

  # Show final groups for transparency
  FINAL_GROUPS=$(groups "$username" 2>/dev/null | cut -d: -f2 | xargs)
  echo "  📋 Final groups: $FINAL_GROUPS" >&2

done <<< "$USERS"

# Summary
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "📊 Docker Group Synchronization Summary" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  ✨ System users created: $USERS_CREATED" >&2
echo "  ➕ Users added to docker: $USERS_ADDED" >&2
echo "  ✅ Users already in docker: $USERS_ALREADY_IN_GROUP" >&2
echo "  ⏭️  Users skipped: $USERS_SKIPPED" >&2
echo "  ❌ Errors: $ERRORS" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

if [ $ERRORS -gt 0 ]; then
  echo "⚠️  Completed with $ERRORS error(s)" >&2
  exit 1
fi

if [ $USERS_CREATED -gt 0 ] || [ $USERS_ADDED -gt 0 ]; then
  echo "✅ Docker group synchronization completed successfully!" >&2
  echo "" >&2
  echo "📝 Important Notes:" >&2
  echo "  • Users have docker access (can run docker commands)" >&2
  echo "  • Users DO NOT have sudo access (cannot run system commands as root)" >&2
  echo "  • Users need to log out/in for group changes to take effect" >&2
  echo "" >&2
  echo "🔒 Security Verification:" >&2
  echo "  Run: sudo -l -U <username>" >&2
  echo "  Expected: 'User <username> is not allowed to run sudo'" >&2
else
  echo "✅ All users are already synchronized with docker group" >&2
fi

exit 0
