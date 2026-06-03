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

if [[ -f "$SCRIPT_DIR/scripts/deploy-app.sh" ]]; then
  REPO_ROOT="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../deploy-app.sh" ]]; then
  REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
else
  echo "error: run this script from a copy in the repository root or from scripts/examples" >&2
  exit 1
fi

"$REPO_ROOT/scripts/deploy-app.sh" "$REPO_ROOT/apps/hello-http" "$@"
