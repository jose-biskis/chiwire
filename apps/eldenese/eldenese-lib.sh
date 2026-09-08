#!/usr/bin/env sh
set -eu

ELDENESE_ALLOW_DIR="${ELDENESE_ALLOW_DIR:-/var/lib/eldenese}"
ELDENESE_ALLOW_LIST="${ELDENESE_ALLOW_LIST:-$ELDENESE_ALLOW_DIR/allowed-cidrs}"
ELDENESE_ALLOW_CONF="${ELDENESE_ALLOW_CONF:-$ELDENESE_ALLOW_DIR/allowed.conf}"
ELDENESE_CONFIG_PATH="${ELDENESE_CONFIG_PATH:-/tmp/eldenese/unbound.conf}"
ELDENESE_RUNTIME_DIR="${ELDENESE_RUNTIME_DIR:-/tmp/eldenese}"

eldenese_is_ipv4() {
  echo "$1" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
}

eldenese_is_cidr() {
  echo "$1" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$'
}

eldenese_is_upstream() {
  host="${1%@*}"
  if [ "$host" = "$1" ]; then
    eldenese_is_ipv4 "$1"
    return
  fi
  port="${1##*@}"
  eldenese_is_ipv4 "$host" && echo "$port" | grep -Eq '^[1-9][0-9]{0,4}$'
}

eldenese_normalize_cidr() {
  cidr=$(echo "$1" | tr -d '[:space:]')
  [ -n "$cidr" ] || return 1
  if eldenese_is_ipv4 "$cidr"; then
    cidr="${cidr}/32"
  fi
  if ! eldenese_is_cidr "$cidr"; then
    echo "error: invalid CIDR: $1" >&2
    return 1
  fi
  prefix="${cidr##*/}"
  if [ "$prefix" -lt 1 ] || [ "$prefix" -gt 32 ]; then
    echo "error: CIDR prefix must be 1-32 (not a wildcard): $1" >&2
    return 1
  fi
  printf '%s\n' "$cidr"
}

eldenese_read_allow_list() {
  if [ ! -f "$ELDENESE_ALLOW_LIST" ]; then
    return 0
  fi
  while IFS= read -r raw || [ -n "$raw" ]; do
    case "$raw" in
      ""|\#*) continue ;;
    esac
    eldenese_normalize_cidr "$raw"
  done <"$ELDENESE_ALLOW_LIST"
}

eldenese_write_allow_list() {
  mkdir -p "$ELDENESE_ALLOW_DIR"
  {
    for cidr in "$@"; do
      printf '%s\n' "$cidr"
    done
  } | sort -u >"$ELDENESE_ALLOW_LIST"
}

eldenese_seed_allow_list() {
  mkdir -p "$ELDENESE_ALLOW_DIR"
  if [ -s "$ELDENESE_ALLOW_LIST" ]; then
    return 0
  fi
  old_ifs=$IFS
  IFS=,
  # shellcheck disable=SC2086
  set -- ${ELDENESE_ALLOWED_CIDRS:-}
  IFS=$old_ifs
  seeded=""
  for raw in "$@"; do
    cidr=$(echo "$raw" | tr -d '[:space:]')
    [ -n "$cidr" ] || continue
    cidr=$(eldenese_normalize_cidr "$cidr")
    seeded="$seeded
$cidr"
  done
  if [ -n "$seeded" ]; then
    printf '%s\n' "$seeded" | sed '/^$/d' | sort -u >"$ELDENESE_ALLOW_LIST"
  else
    : >"$ELDENESE_ALLOW_LIST"
  fi
}

eldenese_write_allow_conf() {
  mkdir -p "$ELDENESE_ALLOW_DIR"
  {
    printf 'server:\n'
    eldenese_read_allow_list | while IFS= read -r cidr; do
      [ -n "$cidr" ] || continue
      printf '  access-control: %s allow\n' "$cidr"
    done
  } >"$ELDENESE_ALLOW_CONF"
}

eldenese_write_unbound_conf() {
  mkdir -p "$ELDENESE_RUNTIME_DIR"
  {
    cat <<EOF
server:
  do-daemonize: no
  use-syslog: no
  chroot: ""
  username: unbound
  directory: $ELDENESE_RUNTIME_DIR
  pidfile: $ELDENESE_RUNTIME_DIR/unbound.pid
  interface: 0.0.0.0
  port: 53
  do-ip6: no
  prefetch: yes
  hide-identity: yes
  hide-version: yes
  harden-glue: yes
  qname-minimisation: yes
  cache-min-ttl: 60
  cache-max-ttl: 86400
  access-control: 127.0.0.0/8 allow
  access-control: 10.0.0.0/8 allow
  access-control: 172.16.0.0/12 allow
  access-control: 192.168.0.0/16 allow

include: "$ELDENESE_ALLOW_CONF"
EOF

    printf '\nforward-zone:\n  name: "."\n'

    old_ifs=$IFS
    IFS=,
    # shellcheck disable=SC2086
    set -- ${ELDENESE_UPSTREAMS:-1.1.1.1,1.0.0.1}
    IFS=$old_ifs

    for raw in "$@"; do
      upstream=$(echo "$raw" | tr -d '[:space:]')
      [ -n "$upstream" ] || continue
      if ! eldenese_is_upstream "$upstream"; then
        echo "error: invalid ELDENESE_UPSTREAMS entry: ${raw}" >&2
        exit 1
      fi
      printf '  forward-addr: %s\n' "$upstream"
    done
  } >"$ELDENESE_CONFIG_PATH"
}

eldenese_apply_config() {
  mkdir -p "$ELDENESE_ALLOW_DIR" "$ELDENESE_RUNTIME_DIR"
  eldenese_write_allow_conf
  eldenese_write_unbound_conf
  unbound-checkconf "$ELDENESE_CONFIG_PATH"
  chown -R unbound:unbound "$ELDENESE_ALLOW_DIR" "$ELDENESE_RUNTIME_DIR"
}

eldenese_reload() {
  pidfile="$ELDENESE_RUNTIME_DIR/unbound.pid"
  if [ -f "$pidfile" ]; then
    kill -HUP "$(cat "$pidfile")"
    return 0
  fi
  if [ -f /proc/1/comm ] && grep -q '^unbound$' /proc/1/comm; then
    kill -HUP 1
    return 0
  fi
  echo "warning: unbound is not running; allowlist saved, reload skipped" >&2
}
