# NSS+PAM PostgreSQL Authentication Setup Guide

This setup allows Ubuntu servers to authenticate users directly from your PostgreSQL database.

## Architecture

- **NSS (Name Service Switch)**: Resolves user/group information from PostgreSQL
- **PAM (Pluggable Authentication Modules)**: Authenticates passwords against PostgreSQL
- **Benefits**: 
  - Centralized user management from your FastAPI
  - UIDs shared across all servers (consistent file permissions)
  - No manual user synchronization needed
  - Real-time user activation/deactivation

## Prerequisites

- Ubuntu 18.04+ servers
- PostgreSQL database accessible from all servers
- Firewall rules allowing PostgreSQL connections (port 5432)

## Installation Steps (Run on each Ubuntu server)

### 1. Install Required Packages

```bash
sudo apt update
sudo apt install -y libnss-pgsql libpam-pgsql
```

### 2. Create NSS Database User

On your PostgreSQL server, create a read-only user for NSS:

```sql
-- Run this SQL (included in nss_pam_setup.sql)
CREATE USER nss_user WITH PASSWORD 'secure_password_here';
GRANT SELECT ON users TO nss_user;
```

### 3. Configure NSS-PGSQL

Copy the template and configure:

```bash
sudo cp client/utils/nss-pgsql.conf.template /etc/nss-pgsql.conf
sudo nano /etc/nss-pgsql.conf
```

Update these values:
- `YOUR_DB_HOST` → Your PostgreSQL server IP/hostname
- `YOUR_NSS_PASSWORD` → Password for nss_user

Set proper permissions:
```bash
sudo chmod 600 /etc/nss-pgsql.conf
sudo chown root:root /etc/nss-pgsql.conf
```

### 4. Configure PAM-PGSQL

```bash
sudo cp client/utils/pam-pgsql.conf.template /etc/pam-pgsql.conf
sudo nano /etc/pam-pgsql.conf
```

Update the same database connection values.

Set proper permissions:
```bash
sudo chmod 600 /etc/pam-pgsql.conf
sudo chown root:root /etc/pam-pgsql.conf
```

### 5. Configure NSSwitch

Edit `/etc/nsswitch.conf`:

```bash
sudo nano /etc/nsswitch.conf
```

Modify these lines to add `pgsql` AFTER `files`:

```
passwd:         files pgsql
group:          files pgsql
shadow:         files pgsql
```

This means: check local files first, then PostgreSQL.

### 6. Configure PAM for SSH

Edit `/etc/pam.d/sshd`:

```bash
sudo nano /etc/pam.d/sshd
```

Add these lines at the top (before other auth lines), in this order:

```
# Validate username pattern to mitigate injection attempts
auth    requisite    pam_exec.so quiet /usr/local/sbin/validate_username.sh

# Authenticate against PostgreSQL if username is valid
auth    sufficient   pam_pgsql.so
```

### 7. Enable Password Authentication in SSH (if needed)

Edit `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Ensure these settings:
```
PasswordAuthentication yes
UsePAM yes
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

### 8. Test NSS Configuration

```bash
# Should show users from PostgreSQL
getent passwd

# Test specific user
getent passwd your_username

# Should show UID 2000+, home directory /home/username
```

### 9. Test Authentication

Try to SSH with a user from your database:

```bash
ssh username@server_ip
```

If the user exists in PostgreSQL with `is_active=1`, authentication should work.

## Automatic Home Directory Creation

To create home directories automatically on first login:

Edit `/etc/pam.d/common-session`:

```bash
sudo nano /etc/pam.d/common-session
```

Add this line:

```
session required    pam_mkhomedir.so skel=/etc/skel umask=0022
```

Now home directories will be created automatically when users first log in.

## Security Considerations

1. **Database Connection Security**:
   - Use SSL for PostgreSQL connections in production
   - Restrict PostgreSQL firewall rules to only your servers
   - Use strong password for nss_user

2. **Password Storage**:
   - Passwords are stored as bcrypt hashes in PostgreSQL
   - Never expose raw passwords

3. **User Activation**:
   - Setting `is_active=0` immediately blocks user access
   - No need to manually lock accounts on each server

## Troubleshooting

### Users not showing in `getent passwd`

```bash
# Check NSS configuration
sudo cat /etc/nss-pgsql.conf

# Test database connection
psql -h YOUR_DB_HOST -U nss_user -d mydb -c "SELECT * FROM users WHERE is_active=1;"

# Check NSS logs
sudo tail -f /var/log/auth.log
```

### Authentication failing

```bash
# Check PAM configuration
sudo cat /etc/pam-pgsql.conf

# Test PAM module
sudo pamtester sshd username authenticate

# Check auth logs
sudo tail -f /var/log/auth.log
```

### Permission denied errors

```bash
# Verify file permissions
ls -la /etc/nss-pgsql.conf
ls -la /etc/pam-pgsql.conf

# Should be 600 root:root
```

## API Usage

### Create User with System Access

```bash
POST /auth/signup
{
  "username": "john",
  "email": "john@example.com",
  "password": "secure_password",
  "ssh_public_key": "ssh-rsa AAAAB3NzaC1yc2E..."
}
```

This user will:
- Get auto-assigned system_uid (starting from 2000)
- Be able to SSH into all configured servers
- Have home directory `/home/john` created automatically
- Have consistent UID across all servers

### Deactivate User

```bash
PUT /users/{id}/deactivate
```

User is immediately blocked from all servers (authentication fails).

### Reactivate User

```bash
PUT /users/{id}/activate
```

User can log in again immediately.

## Next Steps

You can create an Ansible playbook to automate the installation of these packages and configuration files across all your servers.
