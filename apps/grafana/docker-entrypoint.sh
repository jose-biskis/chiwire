#!/usr/bin/env sh
set -eu

if [ "${1:-}" != "grafana" ]; then
  exec "$@"
fi

: "${GF_SECURITY_ADMIN_USER:=admin}"

if [ -z "${GF_SECURITY_ADMIN_PASSWORD:-}" ]; then
  echo "error: GF_SECURITY_ADMIN_PASSWORD is required for the Grafana service" >&2
  echo "pass it at deploy time with: --env GF_SECURITY_ADMIN_PASSWORD=..." >&2
  exit 1
fi

export \
  GF_SECURITY_ADMIN_USER \
  GF_SECURITY_ADMIN_PASSWORD \
  GF_PATHS_PROVISIONING="${GF_PATHS_PROVISIONING:-/etc/grafana/provisioning}" \
  GF_PATHS_DATA="${GF_PATHS_DATA:-/var/lib/grafana}" \
  GF_USERS_ALLOW_SIGN_UP="${GF_USERS_ALLOW_SIGN_UP:-false}" \
  GF_AUTH_ANONYMOUS_ENABLED="${GF_AUTH_ANONYMOUS_ENABLED:-false}" \
  GF_SERVER_HTTP_ADDR="${GF_SERVER_HTTP_ADDR:-0.0.0.0}" \
  GF_SERVER_HTTP_PORT="${GF_SERVER_HTTP_PORT:-3000}"

exec /run.sh
