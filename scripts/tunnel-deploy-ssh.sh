#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Open a local SSH tunnel to an internal service on the deploy host.

Uses the same SSH variables as deploy-docker-ssh.sh and connect-deploy-ssh.sh.

Usage:
  ./scripts/tunnel-deploy-ssh.sh [options]

Options:
  --app PATH                App directory with deploy.json; uses runtime.hostPort
                            (or runtime.containerPort) as the remote port default
  --local-port PORT         Local port to bind (default: remote port)
  --remote-port PORT        Remote host port to forward to
  --remote-bind ADDRESS     Remote bind address (default: 127.0.0.1)
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
  ./scripts/tunnel-deploy-ssh.sh --app apps/grafana
  ./scripts/tunnel-deploy-ssh.sh --local-port 3030 --remote-port 3030
  npm run tunnel:grafana
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

read_app_remote_port() {
  local app_path="$1"
  local settings_path

  if [[ -f "$app_path" ]]; then
    settings_path="$app_path"
  elif [[ -f "$app_path/deploy.json" ]]; then
    settings_path="$app_path/deploy.json"
  else
    fail "deploy settings not found for --app ${app_path}"
  fi

  node -e '
const fs = require("node:fs");
const settings = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const runtime = settings.runtime ?? {};
const port = runtime.hostPort ?? runtime.containerPort ?? settings.containerPort;
if (port === undefined || port === null || port === "") {
  process.stderr.write("error: runtime.hostPort (or runtime.containerPort) is required in deploy.json\n");
  process.exit(1);
}
process.stdout.write(String(port));
' "$settings_path"
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/deploy-ssh-env.sh"

HOST=""
SSH_PORT_OPTION=""
IDENTITY_FILE_OPTION=""
SSH_OPTIONS=()
APP_PATH=""
LOCAL_PORT=""
REMOTE_PORT=""
REMOTE_BIND="127.0.0.1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      APP_PATH="${2:-}"
      shift 2
      ;;
    --local-port)
      LOCAL_PORT="${2:-}"
      shift 2
      ;;
    --remote-port)
      REMOTE_PORT="${2:-}"
      shift 2
      ;;
    --remote-bind)
      REMOTE_BIND="${2:-}"
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

if [[ -n "$APP_PATH" ]]; then
  if [[ "$APP_PATH" != /* ]]; then
    APP_PATH="$REPO_ROOT/$APP_PATH"
  fi
  if [[ -z "$REMOTE_PORT" ]]; then
    REMOTE_PORT="$(read_app_remote_port "$APP_PATH")"
  fi
fi

REMOTE_PORT="$(normalize_port "$REMOTE_PORT" "--remote-port")"
LOCAL_PORT="$(normalize_port "${LOCAL_PORT:-$REMOTE_PORT}" "--local-port")"
[[ -n "$REMOTE_BIND" ]] || fail "--remote-bind cannot be empty"

if ! HOST="$(deploy_ssh_resolve_host "$HOST")"; then
  fail "--host is required when SSH_HOST, DEPLOY_SSH_TARGET, or DEPLOY_SSH_USER + DEPLOY_SSH_HOST are not set"
fi
SSH_PORT="$(deploy_ssh_resolve_port "$SSH_PORT_OPTION")"
IDENTITY_FILE="$(deploy_ssh_resolve_identity_file "$IDENTITY_FILE_OPTION")"
deploy_ssh_export_password_from_env

[[ -n "$SSH_PORT" ]] || fail "--ssh-port cannot be empty"

require_command ssh
require_command node
if [[ -n "${SSHPASS:-}" ]]; then
  require_command sshpass
fi

FORWARD="${LOCAL_PORT}:${REMOTE_BIND}:${REMOTE_PORT}"

SSH_COMMAND=(ssh -N -L "$FORWARD" -p "$SSH_PORT")

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

echo "Tunneling localhost:${LOCAL_PORT} -> ${HOST}:${REMOTE_BIND}:${REMOTE_PORT}"
echo "Open http://localhost:${LOCAL_PORT}"
echo "Leave this session open; Ctrl+C to stop."
exec "${SSH_COMMAND[@]}"
