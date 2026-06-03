deploy_ssh_load_local_env() {
  local env_file="${DEPLOY_SSH_ENV_FILE:-}"

  if [[ -z "$env_file" ]]; then
    local lib_dir repo_root
    lib_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
    repo_root="$(cd -- "$lib_dir/../.." && pwd)"
    env_file="$repo_root/.env.deploy.local"
  fi

  [[ -f "$env_file" ]] || return 0

  # shellcheck source=/dev/null
  source "$env_file"
}

deploy_ssh_resolve_host() {
  local explicit_host="${1:-}"

  if [[ -n "$explicit_host" ]]; then
    printf '%s\n' "$explicit_host"
    return 0
  fi

  if [[ -n "${SSH_HOST:-}" ]]; then
    printf '%s\n' "$SSH_HOST"
    return 0
  fi

  if [[ -n "${DEPLOY_SSH_TARGET:-}" ]]; then
    printf '%s\n' "$DEPLOY_SSH_TARGET"
    return 0
  fi

  if [[ -n "${DEPLOY_SSH_USER:-}" && -n "${DEPLOY_SSH_HOST:-}" ]]; then
    printf '%s@%s\n' "$DEPLOY_SSH_USER" "$DEPLOY_SSH_HOST"
    return 0
  fi

  return 1
}

deploy_ssh_resolve_port() {
  local explicit_port="${1:-}"

  if [[ -n "$explicit_port" ]]; then
    printf '%s\n' "$explicit_port"
    return 0
  fi

  if [[ -n "${SSH_PORT:-}" ]]; then
    printf '%s\n' "$SSH_PORT"
    return 0
  fi

  if [[ -n "${DEPLOY_SSH_PORT:-}" ]]; then
    printf '%s\n' "$DEPLOY_SSH_PORT"
    return 0
  fi

  printf '%s\n' "22"
}

deploy_ssh_resolve_identity_file() {
  local explicit_identity_file="${1:-}"

  if [[ -n "$explicit_identity_file" ]]; then
    printf '%s\n' "$explicit_identity_file"
    return 0
  fi

  if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then
    printf '%s\n' "$SSH_IDENTITY_FILE"
    return 0
  fi

  if [[ -n "${DEPLOY_SSH_IDENTITY_FILE:-}" ]]; then
    printf '%s\n' "$DEPLOY_SSH_IDENTITY_FILE"
    return 0
  fi
}

deploy_ssh_export_password_from_env() {
  if [[ -z "${SSHPASS:-}" && -n "${DEPLOY_SSH_PASSWORD:-}" ]]; then
    export SSHPASS="$DEPLOY_SSH_PASSWORD"
  fi
}
