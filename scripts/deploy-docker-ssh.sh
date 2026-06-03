#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Deploy a locally built Docker image to a remote host over SSH.

Required:
  --image IMAGE             Docker image name, without the tag
  --container NAME          Remote container name

Common options:
  --host USER@HOST          SSH target that can run Docker commands
                            Defaults from SSH_HOST, DEPLOY_SSH_TARGET, or
                            DEPLOY_SSH_USER + DEPLOY_SSH_HOST
  --tag TAG                 Image tag (default: latest)
  --context PATH            Docker build context (default: .)
  --dockerfile PATH         Dockerfile path (default: Dockerfile)
  --port HOST:CONTAINER     Publish a port; repeatable
  --env KEY=VALUE           Set a container environment variable; repeatable
  --volume HOST:CONTAINER   Mount a volume; repeatable
  --network NAME            Attach the container to a Docker network
  --restart POLICY          Restart policy (default: unless-stopped)
  --platform PLATFORM       Optional docker build platform, e.g. linux/amd64
  --build-arg KEY=VALUE     Pass a Docker build argument; repeatable
  --run-arg ARG             Append a raw docker run argument; repeatable

SSH options:
  --ssh-port PORT           SSH port (default: 22)
  --identity-file PATH      SSH private key path
  --ssh-option OPTION       Extra ssh/scp -o option; repeatable
  --remote-tmp-dir PATH     Remote upload directory (default: /tmp)

Environment:
  DEPLOY_SSH_ENV_FILE       Deploy env file to source before resolving values
                            (default: .env.deploy.local in the repo root)
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

Other:
  -h, --help                Show this help

Example:
  ./scripts/deploy-docker-ssh.sh \
    --host deploy@example.com \
    --image chiwire/hello-http \
    --tag latest \
    --container hello-http \
    --dockerfile apps/hello-http/Dockerfile \
    --context . \
    --port 8080:3000
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-ssh-env.sh"
deploy_ssh_load_local_env

quote() {
  printf '%q' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "$1 is required but was not found in PATH"
  fi
}

remote_docker_check_script() {
  cat <<'REMOTE_DOCKER_CHECK'
if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is required on the remote host but was not found in PATH" >&2
  echo "Install Docker or connect as a user whose non-interactive SSH session can run docker." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: docker is installed on the remote host, but this SSH user cannot use the Docker daemon" >&2
  echo "Add the user to the docker group, configure rootless Docker, or deploy with a user that can run docker." >&2
  exit 1
fi
REMOTE_DOCKER_CHECK
}

HOST=""
IMAGE=""
CONTAINER=""
TAG="${TAG:-latest}"
CONTEXT="."
DOCKERFILE="Dockerfile"
SSH_PORT_OPTION=""
REMOTE_TMP_DIR="${REMOTE_TMP_DIR:-/tmp}"
RESTART_POLICY="${RESTART_POLICY:-unless-stopped}"
PLATFORM="${PLATFORM:-}"
IDENTITY_FILE_OPTION=""
NETWORK=""

BUILD_ARGS=()
CONTAINER_ENVS=()
PORTS=()
RUN_ARGS=()
SSH_OPTIONS=()
VOLUMES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --image)
      IMAGE="${2:-}"
      shift 2
      ;;
    --container)
      CONTAINER="${2:-}"
      shift 2
      ;;
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --context)
      CONTEXT="${2:-}"
      shift 2
      ;;
    --dockerfile)
      DOCKERFILE="${2:-}"
      shift 2
      ;;
    --port)
      PORTS+=("${2:-}")
      shift 2
      ;;
    --env)
      CONTAINER_ENVS+=("${2:-}")
      shift 2
      ;;
    --volume)
      VOLUMES+=("${2:-}")
      shift 2
      ;;
    --network)
      NETWORK="${2:-}"
      shift 2
      ;;
    --restart)
      RESTART_POLICY="${2:-}"
      shift 2
      ;;
    --platform)
      PLATFORM="${2:-}"
      shift 2
      ;;
    --build-arg)
      BUILD_ARGS+=("${2:-}")
      shift 2
      ;;
    --run-arg)
      RUN_ARGS+=("${2:-}")
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
    --remote-tmp-dir)
      REMOTE_TMP_DIR="${2:-}"
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

[[ -n "$IMAGE" ]] || fail "--image is required"
[[ -n "$CONTAINER" ]] || fail "--container is required"
[[ -n "$TAG" ]] || fail "--tag cannot be empty"
[[ -n "$CONTEXT" ]] || fail "--context cannot be empty"
[[ -n "$DOCKERFILE" ]] || fail "--dockerfile cannot be empty"
[[ -n "$SSH_PORT" ]] || fail "--ssh-port cannot be empty"
[[ -n "$REMOTE_TMP_DIR" ]] || fail "--remote-tmp-dir cannot be empty"
[[ -n "$RESTART_POLICY" ]] || fail "--restart cannot be empty"

require_command docker
require_command gzip
require_command scp
require_command ssh
if [[ -n "${SSHPASS:-}" ]]; then
  require_command sshpass
fi

SSH_COMMAND=(ssh -p "$SSH_PORT")
SCP_COMMAND=(scp -P "$SSH_PORT")

if [[ -n "$IDENTITY_FILE" ]]; then
  SSH_COMMAND+=(-i "$IDENTITY_FILE")
  SCP_COMMAND+=(-i "$IDENTITY_FILE")
fi

for option in "${SSH_OPTIONS[@]}"; do
  [[ -n "$option" ]] || fail "--ssh-option cannot be empty"
  SSH_COMMAND+=(-o "$option")
  SCP_COMMAND+=(-o "$option")
done

if [[ -n "${SSHPASS:-}" ]]; then
  SSH_COMMAND=(sshpass -e "${SSH_COMMAND[@]}")
  SCP_COMMAND=(sshpass -e "${SCP_COMMAND[@]}")
fi

SSH_COMMAND+=("$HOST")
REMOTE_DOCKER_CHECK="$(remote_docker_check_script)"

echo "Checking remote Docker access on $HOST"
"${SSH_COMMAND[@]}" "bash -s" <<< "$REMOTE_DOCKER_CHECK"

FULL_IMAGE="${IMAGE}:${TAG}"
ARCHIVE_SAFE_NAME="$(printf '%s-%s' "$CONTAINER" "$TAG" | tr -c 'A-Za-z0-9_.-' '-')"
LOCAL_ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/${ARCHIVE_SAFE_NAME}.XXXXXX.tar.gz")"
REMOTE_ARCHIVE="${REMOTE_TMP_DIR%/}/${ARCHIVE_SAFE_NAME}.tar.gz"

cleanup() {
  rm -f "$LOCAL_ARCHIVE"
}
trap cleanup EXIT

BUILD_COMMAND=(docker build --file "$DOCKERFILE" --tag "$FULL_IMAGE")
if [[ -n "$PLATFORM" ]]; then
  BUILD_COMMAND+=(--platform "$PLATFORM")
fi
for build_arg in "${BUILD_ARGS[@]}"; do
  [[ -n "$build_arg" ]] || fail "--build-arg cannot be empty"
  BUILD_COMMAND+=(--build-arg "$build_arg")
done
BUILD_COMMAND+=("$CONTEXT")

echo "Building $FULL_IMAGE from $DOCKERFILE"
"${BUILD_COMMAND[@]}"

echo "Saving $FULL_IMAGE to $LOCAL_ARCHIVE"
docker save "$FULL_IMAGE" | gzip > "$LOCAL_ARCHIVE"

echo "Creating remote upload directory $REMOTE_TMP_DIR"
"${SSH_COMMAND[@]}" "mkdir -p $(quote "$REMOTE_TMP_DIR")"

echo "Uploading image archive to $HOST:$REMOTE_ARCHIVE"
"${SCP_COMMAND[@]}" "$LOCAL_ARCHIVE" "$HOST:$REMOTE_ARCHIVE"

RUN_COMMAND=(docker run -d --name "$CONTAINER" --restart "$RESTART_POLICY")
for port in "${PORTS[@]}"; do
  [[ -n "$port" ]] || fail "--port cannot be empty"
  RUN_COMMAND+=(-p "$port")
done
for container_env in "${CONTAINER_ENVS[@]}"; do
  [[ -n "$container_env" ]] || fail "--env cannot be empty"
  RUN_COMMAND+=(-e "$container_env")
done
for volume in "${VOLUMES[@]}"; do
  [[ -n "$volume" ]] || fail "--volume cannot be empty"
  RUN_COMMAND+=(-v "$volume")
done
if [[ -n "$NETWORK" ]]; then
  RUN_COMMAND+=(--network "$NETWORK")
fi
for run_arg in "${RUN_ARGS[@]}"; do
  [[ -n "$run_arg" ]] || fail "--run-arg cannot be empty"
  RUN_COMMAND+=("$run_arg")
done
RUN_COMMAND+=("$FULL_IMAGE")

printf -v REMOTE_RUN_COMMAND '%q ' "${RUN_COMMAND[@]}"

REMOTE_SCRIPT=$(cat <<REMOTE_SCRIPT
set -Eeuo pipefail

$REMOTE_DOCKER_CHECK

echo "Loading $FULL_IMAGE"
docker load -i $(quote "$REMOTE_ARCHIVE")

if docker container inspect $(quote "$CONTAINER") >/dev/null 2>&1; then
  echo "Removing existing container $CONTAINER"
  docker rm -f $(quote "$CONTAINER")
fi

echo "Starting $CONTAINER"
$REMOTE_RUN_COMMAND

rm -f $(quote "$REMOTE_ARCHIVE")
echo "Deployment complete: $CONTAINER is running $FULL_IMAGE"
REMOTE_SCRIPT
)

echo "Starting remote container"
"${SSH_COMMAND[@]}" "bash -s" <<< "$REMOTE_SCRIPT"
