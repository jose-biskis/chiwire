#!/usr/bin/env sh
set -eu

REJA_ALLOW_DIR="${REJA_ALLOW_DIR:-/var/lib/reja}"
REJA_ALLOW_LIST="${REJA_ALLOW_LIST:-$REJA_ALLOW_DIR/allowed-cidrs}"
REJA_CONFIG_PATH="${REJA_CONFIG_PATH:-/tmp/reja/tinyproxy.conf}"
REJA_RUNTIME_DIR="${REJA_RUNTIME_DIR:-/tmp/reja}"

reja_is_ipv4() {
  echo "$1" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
}

reja_is_cidr() {
  echo "$1" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$'
}

reja_normalize_cidr() {
  cidr=$(echo "$1" | tr -d '[:space:]')
  [ -n "$cidr" ] || return 1
  if reja_is_ipv4 "$cidr"; then
    cidr="${cidr}/32"
  fi
  if ! reja_is_cidr "$cidr"; then
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

reja_read_allow_list() {
  if [ ! -f "$REJA_ALLOW_LIST" ]; then
    return 0
  fi
  while IFS= read -r raw || [ -n "$raw" ]; do
    case "$raw" in
      ""|\#*) continue ;;
    esac
    reja_normalize_cidr "$raw"
  done <"$REJA_ALLOW_LIST"
}

reja_write_allow_list() {
  mkdir -p "$REJA_ALLOW_DIR"
  {
    for cidr in "$@"; do
      printf '%s\n' "$cidr"
    done
  } | sort -u >"$REJA_ALLOW_LIST"
}

reja_seed_allow_list() {
  mkdir -p "$REJA_ALLOW_DIR"
  if [ -s "$REJA_ALLOW_LIST" ]; then
    return 0
  fi
  old_ifs=$IFS
  IFS=,
  # shellcheck disable=SC2086
  set -- ${REJA_ALLOWED_CIDRS:-}
  IFS=$old_ifs
  seeded=""
  for raw in "$@"; do
    cidr=$(echo "$raw" | tr -d '[:space:]')
    [ -n "$cidr" ] || continue
    cidr=$(reja_normalize_cidr "$cidr")
    seeded="$seeded
$cidr"
  done
  if [ -n "$seeded" ]; then
    printf '%s\n' "$seeded" | sed '/^$/d' | sort -u >"$REJA_ALLOW_LIST"
  else
    : >"$REJA_ALLOW_LIST"
  fi
}

reja_validate_credentials() {
  username="${REJA_USERNAME:-}"
  password="${REJA_PASSWORD:-}"
  if [ -z "$username" ] || [ -z "$password" ]; then
    echo "error: REJA_USERNAME and REJA_PASSWORD are required" >&2
    return 1
  fi
  case "$username$password" in
    *[[:space:]]*|*#*|*\"*|*"'"*)
      echo "error: REJA_USERNAME and REJA_PASSWORD cannot contain spaces, quotes, or #" >&2
      return 1
      ;;
  esac
}

reja_write_tinyproxy_conf() {
  reja_validate_credentials
  mkdir -p "$REJA_RUNTIME_DIR"

  error_file=""
  stat_file=""
  if [ -f /usr/share/tinyproxy/default.html ]; then
    error_file='DefaultErrorFile "/usr/share/tinyproxy/default.html"'
  fi
  if [ -f /usr/share/tinyproxy/stats.html ]; then
    stat_file='StatFile "/usr/share/tinyproxy/stats.html"'
  fi

  extra_allows=""
  while IFS= read -r cidr || [ -n "$cidr" ]; do
    [ -n "$cidr" ] || continue
    extra_allows="${extra_allows}
Allow ${cidr}"
  done <<EOF
$(reja_read_allow_list)
EOF

  cat >"$REJA_CONFIG_PATH" <<EOF
User tinyproxy
Group tinyproxy
Port 3128
Listen 0.0.0.0
Timeout 600
PidFile "$REJA_RUNTIME_DIR/tinyproxy.pid"
MaxClients 100
Syslog Off
LogLevel Info
DisableViaHeader Yes
BasicAuth ${REJA_USERNAME} ${REJA_PASSWORD}
${error_file}
${stat_file}
Allow 127.0.0.0/8
Allow 10.0.0.0/8
Allow 172.16.0.0/12
Allow 192.168.0.0/16
${extra_allows}
EOF
}

reja_apply_config() {
  mkdir -p "$REJA_ALLOW_DIR" "$REJA_RUNTIME_DIR"
  reja_write_tinyproxy_conf
  chown tinyproxy:tinyproxy "$REJA_RUNTIME_DIR" "$REJA_CONFIG_PATH"
}

reja_reload() {
  pidfile="$REJA_RUNTIME_DIR/tinyproxy.pid"
  if [ -f "$pidfile" ]; then
    kill -HUP "$(cat "$pidfile")"
    return 0
  fi
  if [ -f /proc/1/comm ] && grep -q '^tinyproxy$' /proc/1/comm; then
    kill -HUP 1
    return 0
  fi
  echo "warning: tinyproxy is not running; allowlist saved, reload skipped" >&2
}
