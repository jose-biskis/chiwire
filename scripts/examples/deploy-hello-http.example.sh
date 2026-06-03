#!/usr/bin/env bash
set -Eeuo pipefail

# Copy this file, update SSH_HOST for your server, then run it from the
# repository root:
#
#   cp scripts/examples/deploy-hello-http.example.sh deploy-hello-http.sh
#   SSH_HOST=deploy@example.com ./deploy-hello-http.sh

if [[ -z "${SSH_HOST:-}" && -z "${DEPLOY_SSH_TARGET:-}" &&
  ( -z "${DEPLOY_SSH_USER:-}" || -z "${DEPLOY_SSH_HOST:-}" ) ]]; then
  export SSH_HOST="deploy@example.com"
fi
if [[ -z "${SSH_PORT:-}" && -z "${DEPLOY_SSH_PORT:-}" ]]; then
  export SSH_PORT="22"
fi
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

"$REPO_ROOT/scripts/deploy-app.sh" "$REPO_ROOT/apps/hello-http" "$@"
