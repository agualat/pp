#!/bin/bash
# Script to generate NSS/PAM configuration files from environment variables
# Run this script on Ubuntu servers after setting up .env file

set -e

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

# Check required variables
REQUIRED_VARS=("DB_HOST" "DB_PORT" "DB_NAME" "NSS_DB_USER" "NSS_DB_PASSWORD")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set in .env"
        exit 1
    fi
done

# Generate nss-pgsql.conf
echo "Generating /etc/nss-pgsql.conf..."
envsubst < nss-pgsql.conf.template | sudo tee /etc/nss-pgsql.conf > /dev/null
sudo chmod 600 /etc/nss-pgsql.conf
sudo chown root:root /etc/nss-pgsql.conf

# Generate pam-pgsql.conf
echo "Generating /etc/pam-pgsql.conf..."
envsubst < pam-pgsql.conf.template | sudo tee /etc/pam-pgsql.conf > /dev/null
sudo chmod 600 /etc/pam-pgsql.conf
sudo chown root:root /etc/pam-pgsql.conf

# Install username validation script
echo "Installing username validation script..."
sudo install -m 0755 -o root -g root ./validate_username.sh /usr/local/sbin/validate_username.sh

echo "Configuration files generated successfully!"
echo "Next steps:"
echo "1. Edit /etc/nsswitch.conf to add 'pgsql' to passwd, group, and shadow"
echo "2. In /etc/pam.d/sshd, add this BEFORE pam_pgsql.so:"
echo "   auth    requisite    pam_exec.so quiet /usr/local/sbin/validate_username.sh"
echo "   then ensure:"
echo "   auth    sufficient   pam_pgsql.so"
echo "3. Restart SSH: sudo systemctl restart sshd"
echo "4. Test with: getent passwd"
