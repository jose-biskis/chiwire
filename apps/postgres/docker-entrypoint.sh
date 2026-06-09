#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "postgres" ]]; then
  exec "$@"
fi

: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_DB:=$POSTGRES_USER}"
: "${PGBOUNCER_LISTEN_PORT:=6432}"
: "${PGBOUNCER_POOL_MODE:=transaction}"
: "${PGBOUNCER_MAX_CLIENT_CONN:=100}"
: "${PGBOUNCER_DEFAULT_POOL_SIZE:=20}"
: "${PGBOUNCER_AUTH_TYPE:=scram-sha-256}"
export \
  POSTGRES_USER \
  POSTGRES_DB \
  PGBOUNCER_LISTEN_PORT \
  PGBOUNCER_POOL_MODE \
  PGBOUNCER_MAX_CLIENT_CONN \
  PGBOUNCER_DEFAULT_POOL_SIZE \
  PGBOUNCER_AUTH_TYPE

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "error: POSTGRES_PASSWORD is required for the Postgres/PgBouncer service" >&2
  echo "pass it at deploy time with: --env POSTGRES_PASSWORD=..." >&2
  exit 1
fi

install -d -o postgres -g postgres -m 0750 /etc/pgbouncer /var/log/pgbouncer /var/run/pgbouncer

envsubst < /etc/pgbouncer/pgbouncer.ini.template > /etc/pgbouncer/pgbouncer.ini
chown postgres:postgres /etc/pgbouncer/pgbouncer.ini
chmod 0640 /etc/pgbouncer/pgbouncer.ini

printf '"%s" "%s"\n' "$POSTGRES_USER" "$POSTGRES_PASSWORD" > /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt
chmod 0600 /etc/pgbouncer/userlist.txt

docker-entrypoint.sh postgres &
postgres_pid=$!
pgbouncer_pid=""

cleanup() {
  if [[ -n "${postgres_pid:-}" ]]; then
    kill "$postgres_pid" 2>/dev/null || true
    wait "$postgres_pid" 2>/dev/null || true
  fi
  if [[ -n "${pgbouncer_pid:-}" ]]; then
    kill "$pgbouncer_pid" 2>/dev/null || true
    wait "$pgbouncer_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT TERM INT

until pg_isready -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  if ! kill -0 "$postgres_pid" 2>/dev/null; then
    wait "$postgres_pid"
    exit $?
  fi
  sleep 1
done

gosu postgres pgbouncer /etc/pgbouncer/pgbouncer.ini &
pgbouncer_pid=$!

wait -n "$postgres_pid" "$pgbouncer_pid"
exit_code=$?
exit "$exit_code"
