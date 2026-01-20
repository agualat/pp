#!/bin/bash
# Verification script for SSH Container Access
# Verifies that users can properly connect to containers with their own username

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     SSH Container Access Verification Script              ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Helper functions
check_pass() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo -e "${RED}✗${NC} $1"
    if [ -n "$2" ]; then
        echo -e "  ${RED}→${NC} $2"
    fi
}

check_warn() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
    echo -e "${YELLOW}⚠${NC} $1"
    if [ -n "$2" ]; then
        echo -e "  ${YELLOW}→${NC} $2"
    fi
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo -e "${BLUE}═══ $1 ═══${NC}"
    echo ""
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    check_warn "Running as root" "This script should preferably be run as a regular user to test permissions"
fi

# 1. Check Frontend Code
section "1. Frontend Code Verification"

FRONTEND_FILE="frontend/app/dashboard/user/containers/page.tsx"
if [ -f "$FRONTEND_FILE" ]; then
    check_pass "Frontend file exists: $FRONTEND_FILE"

    # Check for currentUsername parameter
    if grep -q "currentUsername" "$FRONTEND_FILE"; then
        check_pass "Frontend uses currentUsername parameter"
    else
        check_fail "Frontend missing currentUsername parameter" "Update required in ContainerCard component"
    fi

    # Check for username variable in SSH command
    if grep -q "const username = currentUsername" "$FRONTEND_FILE"; then
        check_pass "Frontend generates SSH command with username variable"
    else
        check_fail "Frontend SSH command generation needs update" "Should use currentUsername, not hardcoded 'root'"
    fi

    # Check it's NOT using hardcoded root
    if grep -q "root@\${container.server_ip}" "$FRONTEND_FILE"; then
        check_fail "Frontend still uses hardcoded 'root@'" "Line should use '\${username}@\${container.server_ip}'"
    else
        check_pass "Frontend does not use hardcoded 'root@'"
    fi
else
    check_fail "Frontend file not found: $FRONTEND_FILE"
fi

# 2. Check Backend SSH Connection Handler
section "2. Backend SSH Connection Handler"

DOCKER_REMOTE_FILE="server/utils/docker_remote.py"
if [ -f "$DOCKER_REMOTE_FILE" ]; then
    check_pass "Docker remote manager file exists: $DOCKER_REMOTE_FILE"

    # Check for retry logic
    if grep -q "max_retries" "$DOCKER_REMOTE_FILE"; then
        check_pass "SSH connection handler has retry logic"
    else
        check_warn "SSH connection handler may lack retry logic" "Consider adding retry mechanism"
    fi

    # Check for socket validation
    if grep -q "fileno()" "$DOCKER_REMOTE_FILE"; then
        check_pass "SSH connection validates socket health"
    else
        check_warn "SSH connection may not validate socket state" "Consider adding socket health checks"
    fi

    # Check for keepalive
    if grep -q "set_keepalive" "$DOCKER_REMOTE_FILE"; then
        check_pass "SSH connection uses TCP keepalive"
    else
        check_warn "SSH connection may not use keepalive" "Consider adding to prevent timeouts"
    fi

    # Check for banner_timeout
    if grep -q "banner_timeout" "$DOCKER_REMOTE_FILE"; then
        check_pass "SSH connection has banner_timeout configured"
    else
        check_warn "SSH connection may lack banner_timeout" "Can help with 'Error reading SSH protocol banner'"
    fi
else
    check_fail "Docker remote manager file not found: $DOCKER_REMOTE_FILE"
fi

# 3. Check Documentation
section "3. Documentation"

SSH_DOC="documentation/SSH_CONTAINER_ACCESS.md"
if [ -f "$SSH_DOC" ]; then
    check_pass "SSH Container Access documentation exists"

    # Check for key sections
    if grep -q "Antes vs Ahora" "$SSH_DOC" || grep -q "Before vs Now" "$SSH_DOC"; then
        check_pass "Documentation includes before/after comparison"
    else
        check_warn "Documentation may lack before/after examples"
    fi

    if grep -q "Troubleshooting" "$SSH_DOC"; then
        check_pass "Documentation includes troubleshooting section"
    else
        check_warn "Documentation lacks troubleshooting section"
    fi
else
    check_warn "SSH Container Access documentation not found: $SSH_DOC"
fi

# 4. Check Migration Scripts
section "4. Migration and Sync Scripts"

SYNC_SCRIPT="client/utils/sync_docker_group.sh"
if [ -f "$SYNC_SCRIPT" ]; then
    check_pass "Docker group sync script exists: $SYNC_SCRIPT"

    if [ -x "$SYNC_SCRIPT" ]; then
        check_pass "Sync script is executable"
    else
        check_warn "Sync script is not executable" "Run: chmod +x $SYNC_SCRIPT"
    fi
else
    check_fail "Docker group sync script not found: $SYNC_SCRIPT"
fi

FIX_SCRIPT="scripts/maintenance/fix_user_gid.sh"
if [ -f "$FIX_SCRIPT" ]; then
    check_pass "User GID fix script exists: $FIX_SCRIPT"

    if [ -x "$FIX_SCRIPT" ]; then
        check_pass "Fix script is executable"
    else
        check_warn "Fix script is not executable" "Run: chmod +x $FIX_SCRIPT"
    fi
else
    check_warn "User GID fix script not found: $FIX_SCRIPT"
fi

CHECK_SCRIPT="scripts/maintenance/check_user_permissions.sh"
if [ -f "$CHECK_SCRIPT" ]; then
    check_pass "Permission check script exists: $CHECK_SCRIPT"

    if [ -x "$CHECK_SCRIPT" ]; then
        check_pass "Check script is executable"
    else
        check_warn "Check script is not executable" "Run: chmod +x $CHECK_SCRIPT"
    fi
else
    check_warn "Permission check script not found: $CHECK_SCRIPT"
fi

# 5. Check Database Schema
section "5. Database Configuration"

# Try to check if we can query the database
if command -v docker &> /dev/null; then
    if docker ps | grep -q "pp_api"; then
        check_pass "API container is running"

        # Try to verify system_gid column exists
        info "Checking database schema..."

        # This is a simplified check - in production you'd query the actual DB
        if [ -f "migrations/archive/migrate_system_gid.sql" ]; then
            check_pass "System GID migration file exists"
        else
            check_warn "System GID migration file not found in archive"
        fi
    else
        check_warn "API container not running" "Cannot verify database schema"
    fi
else
    check_warn "Docker not available" "Cannot verify containers"
fi

# 6. System Requirements
section "6. System Requirements Check"

# Check for required commands
for cmd in ssh docker; do
    if command -v $cmd &> /dev/null; then
        check_pass "Command '$cmd' is available"
    else
        check_warn "Command '$cmd' not found" "May be required for full functionality"
    fi
done

# 7. Security Checks
section "7. Security Configuration"

info "Verifying security best practices..."

# Check if sudoers files exist (should not have wildcard sudo for regular users)
if [ -d "/etc/sudoers.d" ]; then
    if ls /etc/sudoers.d/* 2>/dev/null | grep -q "pp_users"; then
        check_warn "Found pp_users sudoers file" "Verify that regular users don't have sudo access"
    else
        check_pass "No pp_users sudoers file found (expected after migration)"
    fi
fi

# Check README for warning
section "8. README Warning"

if [ -f "README.md" ]; then
    if grep -q "SSH_CONTAINER_ACCESS" README.md || grep -q "propio nombre de usuario" README.md; then
        check_pass "README.md includes SSH user change warning"
    else
        check_warn "README.md may not mention SSH user change" "Consider adding a prominent warning"
    fi
else
    check_warn "README.md not found"
fi

# 9. CHANGELOG
if [ -f "CHANGELOG.md" ]; then
    check_pass "CHANGELOG.md exists"
    if grep -q "SSH connection" CHANGELOG.md; then
        check_pass "CHANGELOG documents SSH changes"
    else
        check_warn "CHANGELOG may not document SSH changes"
    fi
else
    check_warn "CHANGELOG.md not found" "Consider documenting changes"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    VERIFICATION SUMMARY                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Checks:    ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "Passed:          ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed:          ${RED}$FAILED_CHECKS${NC}"
echo -e "Warnings:        ${YELLOW}$WARNING_CHECKS${NC}"
echo ""

# Overall status
if [ $FAILED_CHECKS -eq 0 ]; then
    if [ $WARNING_CHECKS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! SSH Container Access is properly configured.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠ Checks passed with warnings. Review warnings above.${NC}"
        exit 0
    fi
else
    echo -e "${RED}✗ Some checks failed. Please review and fix the issues above.${NC}"
    exit 1
fi
