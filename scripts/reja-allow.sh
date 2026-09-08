#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Update the Reja proxy allowlist on the deploy host without rebuilding.

Usage:
  ./scripts/reja-allow.sh list
  ./scripts/reja-allow.sh add CIDR [CIDR...]
  ./scripts/reja-allow.sh rm CIDR [CIDR...]
  ./scripts/reja-allow.sh set CIDR [CIDR...]

SSH options are the same as connect-deploy-ssh.sh:
  --host USER@HOST
  --ssh-port PORT
  --identity-file PATH
  --ssh-option OPTION

Examples:
  npm run reja:allow -- list
  npm run reja:allow -- add 108.171.104.41
  npm run reja:allow -- set 108.171.104.41 203.0.113.10
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONNECT_SCRIPT="$SCRIPT_DIR/connect-deploy-ssh.sh"
CONTAINER="reja"

SSH_ARGS=()
ACTION=""
CIDRS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host|--ssh-port|--identity-file|--ssh-option)
      SSH_ARGS+=("$1" "${2:-}")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    list|add|rm|set)
      ACTION="$1"
      shift
      CIDRS=("$@")
      break
      ;;
    *)
      fail "unknown option or command: $1"
      ;;
  esac
done

[[ -n "$ACTION" ]] || fail "command is required (list, add, rm, set)"

if [[ "$ACTION" != "list" && ${#CIDRS[@]} -eq 0 ]]; then
  fail "$ACTION needs at least one IPv4 address or CIDR"
fi

if [[ -f "$REPO_ROOT/apps/reja/deploy.json" ]]; then
  CONTAINER="$(node -e '
    const settings = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(settings.container ?? "reja"));
  ' "$REPO_ROOT/apps/reja/deploy.json")"
fi

REMOTE=(docker exec "$CONTAINER" reja-allow "$ACTION")
if [[ ${#CIDRS[@]} -gt 0 ]]; then
  REMOTE+=("${CIDRS[@]}")
fi

"$CONNECT_SCRIPT" "${SSH_ARGS[@]}" -- "${REMOTE[@]}"

# tinyproxy as PID 1 ignores SIGHUP; restart so the new allowlist is loaded.
if [[ "$ACTION" != "list" ]]; then
  "$CONNECT_SCRIPT" "${SSH_ARGS[@]}" -- docker restart "$CONTAINER"
fi
