#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Download the Paso CA certificate from the deploy host.

Usage:
  ./scripts/paso-cert.sh [output-path]

SSH options are the same as connect-deploy-ssh.sh:
  --host USER@HOST
  --ssh-port PORT
  --identity-file PATH
  --ssh-option OPTION

Examples:
  npm run paso:cert
  npm run paso:cert -- ~/Downloads/paso-ca.crt
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONNECT_SCRIPT="$SCRIPT_DIR/connect-deploy-ssh.sh"
CONTAINER="paso"
OUTPUT="$REPO_ROOT/paso-ca.crt"

SSH_ARGS=()

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
    *)
      OUTPUT="$1"
      shift
      ;;
  esac
done

if [[ -f "$REPO_ROOT/apps/paso/deploy.json" ]]; then
  CONTAINER="$(node -e '
    const settings = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(settings.container ?? "paso"));
  ' "$REPO_ROOT/apps/paso/deploy.json")"
fi

"$CONNECT_SCRIPT" "${SSH_ARGS[@]}" -- docker exec "$CONTAINER" cat /var/lib/paso/ca.crt >"$OUTPUT"
if [[ ! -s "$OUTPUT" ]]; then
  rm -f "$OUTPUT"
  fail "CA certificate was empty; is Paso deployed?"
fi

echo "Wrote $OUTPUT"
echo "Install this certificate as a trusted root on Windows or macOS, then add an IKEv2 VPN to the VPS IPv4."
