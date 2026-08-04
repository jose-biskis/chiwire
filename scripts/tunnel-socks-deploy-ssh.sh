#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Open a dynamic SSH SOCKS proxy to the deploy host.

Uses the same SSH variables as deploy-docker-ssh.sh and connect-deploy-ssh.sh.
With the proxy up, point a SOCKS5 client at the local port and reach internal
binds on the remote host (for example http://127.0.0.1:3030 for Grafana).

Usage:
  ./scripts/tunnel-socks-deploy-ssh.sh [options]

Options:
  --local-port PORT         Local SOCKS port (default: 1080)
  --bind ADDRESS            Local bind address (default: 127.0.0.1)
  --host USER@HOST          SSH target
                            Defaults from SSH_HOST, DEPLOY_SSH_TARGET, or
                            DEPLOY_SSH_USER + DEPLOY_SSH_HOST
  --ssh-port PORT           SSH port (default: 22)
  --identity-file PATH      SSH private key path
  --ssh-option OPTION       Extra ssh -o option; repeatable
  -h, --help                Show this help

Environment:
  Same SSH_* / DEPLOY_SSH_* variables as connect-deploy-ssh.sh

Examples:
  ./scripts/tunnel-socks-deploy-ssh.sh
  ./scripts/tunnel-socks-deploy-ssh.sh --local-port 1080
  npm run tunnel:socks
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "$1 is required but was not found in PATH"
  fi
}

normalize_port() {
  local port="${1:-}"
  local label="${2:-port}"

  [[ -n "$port" ]] || fail "${label} is required"
  [[ "$port" =~ ^[1-9][0-9]*$ ]] || fail "${label} must be a TCP port number"
  ((port >= 1 && port <= 65535)) || fail "${label} must be between 1 and 65535"
  printf '%s\n' "$port"
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-ssh-env.sh"

HOST=""
SSH_PORT_OPTION=""
IDENTITY_FILE_OPTION=""
SSH_OPTIONS=()
LOCAL_PORT="1080"
BIND_ADDRESS="127.0.0.1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-port)
      LOCAL_PORT="${2:-}"
      shift 2
      ;;
    --bind)
      BIND_ADDRESS="${2:-}"
      shift 2
      ;;
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --ssh-port)
      SSH_PORT_OPTION="${2:-}"
      shift 2
      ;;
    --identity-file)
      IDENTITY_FILE_OPTION="${2:-}"
      shift 2
      ;;
    --ssh-option)
      SSH_OPTIONS+=("${2:-}")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

LOCAL_PORT="$(normalize_port "$LOCAL_PORT" "--local-port")"
[[ -n "$BIND_ADDRESS" ]] || fail "--bind cannot be empty"

if ! HOST="$(deploy_ssh_resolve_host "$HOST")"; then
  fail "--host is required when SSH_HOST, DEPLOY_SSH_TARGET, or DEPLOY_SSH_USER + DEPLOY_SSH_HOST are not set"
fi
SSH_PORT="$(deploy_ssh_resolve_port "$SSH_PORT_OPTION")"
IDENTITY_FILE="$(deploy_ssh_resolve_identity_file "$IDENTITY_FILE_OPTION")"
deploy_ssh_export_password_from_env

[[ -n "$SSH_PORT" ]] || fail "--ssh-port cannot be empty"

require_command ssh
if [[ -n "${SSHPASS:-}" ]]; then
  require_command sshpass
fi

SOCKS_FORWARD="${BIND_ADDRESS}:${LOCAL_PORT}"

SSH_COMMAND=(ssh -N -D "$SOCKS_FORWARD" -p "$SSH_PORT")

if [[ -n "$IDENTITY_FILE" ]]; then
  SSH_COMMAND+=(-i "$IDENTITY_FILE")
fi

for option in "${SSH_OPTIONS[@]}"; do
  [[ -n "$option" ]] || fail "--ssh-option cannot be empty"
  SSH_COMMAND+=(-o "$option")
done

if [[ -n "${SSHPASS:-}" ]]; then
  SSH_COMMAND=(sshpass -e "${SSH_COMMAND[@]}")
fi

SSH_COMMAND+=("$HOST")

echo "SOCKS5 proxy on ${BIND_ADDRESS}:${LOCAL_PORT} via ${HOST}"
echo "Point a SOCKS5 client at socks5://${BIND_ADDRESS}:${LOCAL_PORT}"
echo "Then open internal services as http://127.0.0.1:<remote-port> (e.g. Grafana :3030)."
echo "Leave this session open; Ctrl+C to stop."
exec "${SSH_COMMAND[@]}"
