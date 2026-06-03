#!/usr/bin/env bash
set -Eeuo pipefail

# Copy this file, update SSH_HOST for your server, then run it from the
# repository root:
#
#   cp scripts/examples/deploy-avila-labs.example.sh deploy-avila-labs.sh
#   SSH_HOST=deploy@example.com ./deploy-avila-labs.sh

if [[ -z "${SSH_HOST:-}" && -z "${DEPLOY_SSH_TARGET:-}" &&
  ( -z "${DEPLOY_SSH_USER:-}" || -z "${DEPLOY_SSH_HOST:-}" ) ]]; then
  export SSH_HOST="deploy@example.com"
fi
if [[ -z "${SSH_PORT:-}" && -z "${DEPLOY_SSH_PORT:-}" ]]; then
  export SSH_PORT="22"
fi
IMAGE_NAME="${IMAGE_NAME:-chiwire/avila-labs}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CONTAINER_NAME="${CONTAINER_NAME:-avila-labs}"
HOST_PORT="${HOST_PORT:-127.0.0.1:3000}"
CONTAINER_PORT="${CONTAINER_PORT:-80}"

./scripts/deploy-docker-ssh.sh \
  --image "$IMAGE_NAME" \
  --tag "$IMAGE_TAG" \
  --container "$CONTAINER_NAME" \
  --dockerfile apps/avila-labs/Dockerfile \
  --context . \
  --port "${HOST_PORT}:${CONTAINER_PORT}"
