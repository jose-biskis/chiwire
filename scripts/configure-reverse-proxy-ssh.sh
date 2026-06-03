#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Configure HTTPS reverse proxying on a deploy SSH host.

The script connects over SSH and creates or updates a host-level reverse proxy
for a root domain or subdomain that forwards to a locally published container
port, for example 127.0.0.1:3000.

Required:
  --domain DOMAIN            Root domain or subdomain to serve

Common options:
  --proxy caddy|nginx        Reverse proxy to configure (default: caddy)
  --upstream HOST:PORT       Upstream address (default: 127.0.0.1:3000)
                             May also include http:// or https://
  --email EMAIL              Let's Encrypt email for nginx/certbot
  --skip-tls                 Configure HTTP only

SSH options:
  --host USER@HOST           SSH target that can run privileged commands
                             Defaults from SSH_HOST, DEPLOY_SSH_TARGET, or
                             DEPLOY_SSH_USER + DEPLOY_SSH_HOST
  --ssh-port PORT            SSH port (default: 22)
  --identity-file PATH       SSH private key path
  --ssh-option OPTION        Extra ssh -o option; repeatable

Privilege options:
  --sudo-command COMMAND     Privilege command on the host (default: sudo)
  --no-sudo                  Run privileged commands directly; useful as root
  --caddyfile PATH           Caddyfile path (default: /etc/caddy/Caddyfile)

Environment:
  PROXY_TYPE                 Default for --proxy
  PROXY_DOMAIN               Default for --domain
  PROXY_UPSTREAM             Default for --upstream
  PROXY_TLS_EMAIL            Default for --email
  PROXY_SKIP_TLS             Set to 1/true/yes to default --skip-tls
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
  ./scripts/configure-reverse-proxy-ssh.sh \
    --proxy caddy \
    --domain host.dev \
    --upstream 127.0.0.1:3000

  ./scripts/configure-reverse-proxy-ssh.sh \
    --proxy nginx \
    --domain app.host.dev \
    --upstream 127.0.0.1:3000 \
    --email admin@host.dev
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

quote() {
  printf '%q' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "$1 is required but was not found in PATH"
  fi
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-ssh-env.sh"

HOST=""
PROXY="${PROXY_TYPE:-caddy}"
DOMAIN="${PROXY_DOMAIN:-}"
UPSTREAM="${PROXY_UPSTREAM:-127.0.0.1:3000}"
EMAIL="${PROXY_TLS_EMAIL:-}"
ENABLE_TLS="1"
SSH_PORT_OPTION=""
IDENTITY_FILE_OPTION=""
SUDO_COMMAND="sudo"
CADDYFILE="/etc/caddy/Caddyfile"

SSH_OPTIONS=()

case "${PROXY_SKIP_TLS:-}" in
  1|true|TRUE|yes|YES)
    ENABLE_TLS="0"
    ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --proxy)
      PROXY="${2:-}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --upstream)
      UPSTREAM="${2:-}"
      shift 2
      ;;
    --email)
      EMAIL="${2:-}"
      shift 2
      ;;
    --skip-tls)
      ENABLE_TLS="0"
      shift
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
    --sudo-command)
      SUDO_COMMAND="${2:-}"
      shift 2
      ;;
    --no-sudo)
      SUDO_COMMAND=""
      shift
      ;;
    --caddyfile)
      CADDYFILE="${2:-}"
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

if ! HOST="$(deploy_ssh_resolve_host "$HOST")"; then
  fail "--host is required when SSH_HOST, DEPLOY_SSH_TARGET, or DEPLOY_SSH_USER + DEPLOY_SSH_HOST are not set"
fi
SSH_PORT="$(deploy_ssh_resolve_port "$SSH_PORT_OPTION")"
IDENTITY_FILE="$(deploy_ssh_resolve_identity_file "$IDENTITY_FILE_OPTION")"
deploy_ssh_export_password_from_env

[[ "$PROXY" == "caddy" || "$PROXY" == "nginx" ]] || fail "--proxy must be caddy or nginx"
[[ -n "$DOMAIN" ]] || fail "--domain is required"
[[ -n "$UPSTREAM" ]] || fail "--upstream cannot be empty"
[[ -n "$SSH_PORT" ]] || fail "--ssh-port cannot be empty"
[[ -n "$CADDYFILE" ]] || fail "--caddyfile cannot be empty"

if [[ "$DOMAIN" == *"/"* || "$DOMAIN" == *":"* ]]; then
  fail "--domain must be a hostname only, for example host.dev or app.host.dev"
fi

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

REMOTE_SCRIPT=$(cat <<'REMOTE_SCRIPT'
set -Eeuo pipefail

PROXY="$1"
DOMAIN="$2"
UPSTREAM="$3"
ENABLE_TLS="$4"
EMAIL="$5"
SUDO_COMMAND="$6"
CADDYFILE="$7"

fail() {
  echo "error: $*" >&2
  exit 1
}

require_remote_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "$1 is required on the remote host but was not found in PATH"
  fi
}

run_root() {
  if [[ "$(id -u)" == "0" ]]; then
    "$@"
    return
  fi

  [[ -n "$SUDO_COMMAND" ]] || fail "root privileges are required; rerun as root or omit --no-sudo"
  require_remote_command "$SUDO_COMMAND"
  "$SUDO_COMMAND" "$@"
}

write_root_file() {
  local path="$1"
  local mode="${2:-0644}"
  local tmp

  tmp="$(mktemp)"
  cat > "$tmp"
  run_root mkdir -p "$(dirname "$path")"
  run_root install -m "$mode" "$tmp" "$path"
  rm -f "$tmp"
}

update_marked_file() {
  local path="$1"
  local start_marker="$2"
  local end_marker="$3"
  local block="$4"
  local current
  local next

  current="$(mktemp)"
  next="$(mktemp)"

  if run_root test -f "$path"; then
    run_root cat "$path" > "$current"
  else
    : > "$current"
  fi

  awk -v start="$start_marker" -v end="$end_marker" '
    $0 == start { skip = 1; next }
    $0 == end { skip = 0; next }
    skip != 1 { print }
  ' "$current" > "$next"

  {
    printf '\n%s\n' "$block"
  } >> "$next"

  run_root mkdir -p "$(dirname "$path")"
  run_root install -m 0644 "$next" "$path"
  rm -f "$current" "$next"
}

reload_service() {
  local service="$1"

  if command -v systemctl >/dev/null 2>&1; then
    if run_root systemctl reload "$service"; then
      return
    fi

    if run_root systemctl restart "$service"; then
      return
    fi
  fi

  case "$service" in
    caddy)
      run_root caddy reload --config "$CADDYFILE"
      ;;
    nginx)
      run_root nginx -s reload
      ;;
    *)
      fail "cannot reload unknown service: $service"
      ;;
  esac
}

normalize_nginx_upstream() {
  case "$UPSTREAM" in
    http://*|https://*)
      printf '%s\n' "$UPSTREAM"
      ;;
    *)
      printf 'http://%s\n' "$UPSTREAM"
      ;;
  esac
}

configure_caddy() {
  local site_address="$DOMAIN"
  local start_marker="# chiwire reverse proxy begin $DOMAIN"
  local end_marker="# chiwire reverse proxy end $DOMAIN"
  local block

  require_remote_command caddy

  if [[ "$ENABLE_TLS" != "1" ]]; then
    site_address="http://$DOMAIN"
  fi

  block="$(cat <<CADDY_SITE
$start_marker
$site_address {
	reverse_proxy $UPSTREAM
}
$end_marker
CADDY_SITE
)"

  echo "Configuring Caddy reverse proxy for $DOMAIN -> $UPSTREAM"
  update_marked_file "$CADDYFILE" "$start_marker" "$end_marker" "$block"
  run_root caddy fmt --overwrite "$CADDYFILE" >/dev/null
  run_root caddy validate --config "$CADDYFILE"
  reload_service caddy
}

configure_nginx() {
  local safe_domain
  local site_path
  local enabled_path
  local nginx_upstream

  require_remote_command nginx

  safe_domain="$(printf '%s' "$DOMAIN" | tr -c 'A-Za-z0-9_.-' '-')"
  nginx_upstream="$(normalize_nginx_upstream)"

  if run_root test -d /etc/nginx/sites-available && run_root test -d /etc/nginx/sites-enabled; then
    site_path="/etc/nginx/sites-available/chiwire-$safe_domain.conf"
    enabled_path="/etc/nginx/sites-enabled/chiwire-$safe_domain.conf"
  else
    site_path="/etc/nginx/conf.d/chiwire-$safe_domain.conf"
    enabled_path=""
  fi

  echo "Configuring nginx reverse proxy for $DOMAIN -> $nginx_upstream"
  write_root_file "$site_path" 0644 <<NGINX_SITE
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        proxy_pass $nginx_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_SITE

  if [[ -n "$enabled_path" ]]; then
    run_root ln -sfn "$site_path" "$enabled_path"
  fi

  run_root nginx -t
  reload_service nginx

  if [[ "$ENABLE_TLS" == "1" ]]; then
    require_remote_command certbot

    local certbot_command=(certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
    if [[ -n "$EMAIL" ]]; then
      certbot_command+=(-m "$EMAIL")
    else
      certbot_command+=(--register-unsafely-without-email)
    fi

    echo "Requesting Let's Encrypt certificate for $DOMAIN with certbot"
    run_root "${certbot_command[@]}"
  fi
}

case "$PROXY" in
  caddy)
    configure_caddy
    ;;
  nginx)
    configure_nginx
    ;;
  *)
    fail "unsupported proxy: $PROXY"
    ;;
esac

if [[ "$ENABLE_TLS" == "1" ]]; then
  echo "Reverse proxy configured: https://$DOMAIN/ -> $UPSTREAM"
else
  echo "Reverse proxy configured: http://$DOMAIN/ -> $UPSTREAM"
fi
REMOTE_SCRIPT
)

REMOTE_ARGS=("$PROXY" "$DOMAIN" "$UPSTREAM" "$ENABLE_TLS" "$EMAIL" "$SUDO_COMMAND" "$CADDYFILE")
REMOTE_ARG_STRING=""
for arg in "${REMOTE_ARGS[@]}"; do
  REMOTE_ARG_STRING+=" $(quote "$arg")"
done

echo "Configuring $PROXY reverse proxy on $HOST for $DOMAIN"
"${SSH_COMMAND[@]}" "bash -s --$REMOTE_ARG_STRING" <<< "$REMOTE_SCRIPT"
