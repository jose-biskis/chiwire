#!/usr/bin/env sh
set -eu

username="${REJA_USERNAME:-}"
password="${REJA_PASSWORD:-}"
allowed="${REJA_ALLOWED_CIDRS:-}"
config_path="/tmp/reja/tinyproxy.conf"

if [ -z "$username" ] || [ -z "$password" ]; then
  echo "error: REJA_USERNAME and REJA_PASSWORD are required" >&2
  exit 1
fi

case "$username$password" in
  *[[:space:]]*|*#*|*\"*|*"'"*)
    echo "error: REJA_USERNAME and REJA_PASSWORD cannot contain spaces, quotes, or #" >&2
    exit 1
    ;;
esac

mkdir -p /tmp/reja

is_ipv4_or_cidr() {
  echo "$1" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}(/([0-9]|[12][0-9]|3[0-2]))?$'
}

allow_block=""
if [ -n "$allowed" ]; then
  allow_block="Allow 127.0.0.1"
  old_ifs=$IFS
  IFS=,
  for cidr in $allowed; do
    cidr=$(printf '%s' "$cidr" | tr -d ' \t\r\n')
    [ -z "$cidr" ] && continue
    if ! is_ipv4_or_cidr "$cidr"; then
      echo "error: invalid REJA_ALLOWED_CIDRS entry: ${cidr}" >&2
      exit 1
    fi
    allow_block="${allow_block}
Allow ${cidr}"
  done
  IFS=$old_ifs
fi

error_file=""
stat_file=""
if [ -f /usr/share/tinyproxy/default.html ]; then
  error_file='DefaultErrorFile "/usr/share/tinyproxy/default.html"'
fi
if [ -f /usr/share/tinyproxy/stats.html ]; then
  stat_file='StatFile "/usr/share/tinyproxy/stats.html"'
fi

cat >"$config_path" <<EOF
User tinyproxy
Group tinyproxy
Port 3128
Listen 0.0.0.0
Timeout 600
PidFile "/tmp/reja/tinyproxy.pid"
MaxClients 100
Syslog Off
LogLevel Info
DisableViaHeader Yes
BasicAuth ${username} ${password}
${error_file}
${stat_file}
${allow_block}
EOF

if [ -n "$allowed" ]; then
  echo "Reja HTTP proxy on :3128 for ${username} (allowlist set)"
else
  echo "Reja HTTP proxy on :3128 for ${username} (any IP with password)"
fi

exec "$@"
