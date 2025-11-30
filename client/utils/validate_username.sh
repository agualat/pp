#!/usr/bin/env bash
# Validate PAM_USER against a strict regex to mitigate injection attempts
# Allowed: lowercase letters, digits, underscore, dash; must start with letter or underscore

set -euo pipefail

USER="${PAM_USER:-}"

if [[ -z "$USER" ]]; then
  exit 1
fi

if [[ "$USER" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
  exit 0
else
  exit 1
fi
