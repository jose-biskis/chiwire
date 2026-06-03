#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Connect to the deploy SSH host using the same variables as deploy-docker-ssh.sh.

Usage:
  ./scripts/connect-deploy-ssh.sh [options] [-- remote-command...]

Options:
  --host USER@HOST          SSH target
                            Defaults from SSH_HOST, DEPLOY_SSH_TARGET, or
                            DEPLOY_SSH_USER + DEPLOY_SSH_HOST
  --ssh-port PORT           SSH port (default: 22)
  --identity-file PATH      SSH private key path
  --ssh-option OPTION       Extra ssh -o option; repeatable
  -h, --help                Show this help

Environment:
  SSH_HOST                  Default for --host
  DEPLOY_SSH_TARGET         Default for --host when SSH_HOST is unset
  DEPLOY_SSH_USER           Used with DEPLOY_SSH_HOST for --host defaults
  DEPLOY_SSH_HOST           Used with DEPLOY_SSH_USER for --host defaults
  SSH_PORT                  Default for --ssh-port
  DEPLOY_SSH_PORT           Default for --ssh-port when SSH_PORT is unset
  SSH_IDENTITY_FILE         Default for --identity-file
  DEPLOY_SSH_IDENTITY_FILE  Default for --identity-file when SSH_IDENTITY_FILE
                            is unset
  SSHPASS                   Use sshpass -e for password auth when set
  DEPLOY_SSH_PASSWORD       Default for SSHPASS when SSHPASS is unset

Examples:
  ./scripts/connect-deploy-ssh.sh
  ./scripts/connect-deploy-ssh.sh -- docker ps
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
source "$SCRIPT_DIR/lib/deploy-ssh-env.sh"

HOST=""
SSH_PORT_OPTION=""
IDENTITY_FILE_OPTION=""
SSH_OPTIONS=()
REMOTE_COMMAND=()

while [[ $# -gt 0 ]]; do
  case "$1" in
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
    --)
      shift
      REMOTE_COMMAND=("$@")
      break
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

SSH_COMMAND=(ssh -p "$SSH_PORT")

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

exec "${SSH_COMMAND[@]}" "${REMOTE_COMMAND[@]}"
