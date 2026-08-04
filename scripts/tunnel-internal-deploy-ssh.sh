#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Open local SSH port forwards for every deploy.json with visibility "internal".

Uses the same SSH variables as deploy-docker-ssh.sh and connect-deploy-ssh.sh.
Unlike the SOCKS tunnel, this works in a normal browser: open
http://localhost:<hostPort> for each forwarded service (no proxy config).

Usage:
  ./scripts/tunnel-internal-deploy-ssh.sh [options]

Options:
  --apps-dir PATH           Directory of app folders (default: <repo>/apps)
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
  ./scripts/tunnel-internal-deploy-ssh.sh
  npm run tunnel:internal
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

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/deploy-ssh-env.sh"

HOST=""
SSH_PORT_OPTION=""
IDENTITY_FILE_OPTION=""
SSH_OPTIONS=()
APPS_DIR="$REPO_ROOT/apps"
REMOTE_BIND="127.0.0.1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apps-dir)
      APPS_DIR="${2:-}"
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

[[ -n "$APPS_DIR" ]] || fail "--apps-dir cannot be empty"
[[ -n "$REMOTE_BIND" ]] || fail "--remote-bind cannot be empty"
if [[ "$APPS_DIR" != /* ]]; then
  APPS_DIR="$REPO_ROOT/$APPS_DIR"
fi
[[ -d "$APPS_DIR" ]] || fail "apps directory not found: ${APPS_DIR}"

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

local_port_in_use() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :${port} )" 2>/dev/null | tail -n +2 | grep -q .
    return $?
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  # Fallback: try binding briefly with bash /dev/tcp is not reliable for listen checks.
  return 1
}

mapfile -t INTERNAL_FORWARDS < <(
  node -e '
const fs = require("node:fs");
const path = require("node:path");

const appsDir = process.argv[1];
const remoteBind = process.argv[2];
const entries = fs.readdirSync(appsDir, { withFileTypes: true });
const forwards = [];

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const settingsPath = path.join(appsDir, entry.name, "deploy.json");
  if (!fs.existsSync(settingsPath)) continue;
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  const runtime = settings.runtime ?? {};
  if (runtime.visibility !== "internal") continue;
  const port = runtime.hostPort ?? runtime.containerPort ?? settings.containerPort;
  if (port === undefined || port === null || port === "") {
    process.stderr.write(`error: ${settingsPath}: runtime.hostPort required for internal apps\n`);
    process.exit(1);
  }
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    process.stderr.write(`error: ${settingsPath}: invalid hostPort ${port}\n`);
    process.exit(1);
  }
  forwards.push({
    app: entry.name,
    port: portNumber,
    forward: `${portNumber}:${remoteBind}:${portNumber}`,
  });
}

forwards.sort((a, b) => a.port - b.port || a.app.localeCompare(b.app));

const seen = new Map();
for (const item of forwards) {
  if (seen.has(item.port)) {
    process.stderr.write(
      `error: duplicate internal hostPort ${item.port} (${seen.get(item.port)} and ${item.app})\n`,
    );
    process.exit(1);
  }
  seen.set(item.port, item.app);
}

if (forwards.length === 0) {
  process.stderr.write("error: no apps with runtime.visibility \"internal\" found\n");
  process.exit(1);
}

for (const item of forwards) {
  process.stdout.write(`${item.app}\t${item.port}\t${item.forward}\n`);
}
' "$APPS_DIR" "$REMOTE_BIND"
)

FORWARD_ARGS=()
echo "Forwarding internal services via ${HOST}:"
for row in "${INTERNAL_FORWARDS[@]}"; do
  IFS=$'\t' read -r app_name host_port forward <<<"$row"
  if local_port_in_use "$host_port"; then
    echo "  skip ${app_name}: local port ${host_port} already in use" >&2
    continue
  fi
  FORWARD_ARGS+=(-L "$forward")
  echo "  ${app_name}: http://localhost:${host_port} -> ${REMOTE_BIND}:${host_port}"
done

if [[ ${#FORWARD_ARGS[@]} -eq 0 ]]; then
  fail "no internal ports available to forward (all local ports already in use)"
fi

SSH_COMMAND=(
  ssh
  -N
  -o ExitOnForwardFailure=yes
  "${FORWARD_ARGS[@]}"
  -p "$SSH_PORT"
)

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

echo "Leave this session open; Ctrl+C to stop."
exec "${SSH_COMMAND[@]}"
