#!/usr/bin/env bash
set -Eeuo pipefail

# Copy this file, update SSH_HOST for your server, then run it from the
# repository root:
#
#   cp scripts/examples/deploy-hello-http.example.sh deploy-hello-http.sh
#   SSH_HOST=deploy@example.com ./deploy-hello-http.sh

SSH_HOST="${SSH_HOST:-deploy@example.com}"
SSH_PORT="${SSH_PORT:-22}"
IMAGE_NAME="${IMAGE_NAME:-chiwire/hello-http}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CONTAINER_NAME="${CONTAINER_NAME:-hello-http}"
HOST_PORT="${HOST_PORT:-8080}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"

./scripts/deploy-docker-ssh.sh \
  --host "$SSH_HOST" \
  --ssh-port "$SSH_PORT" \
  --image "$IMAGE_NAME" \
  --tag "$IMAGE_TAG" \
  --container "$CONTAINER_NAME" \
  --dockerfile apps/hello-http/Dockerfile \
  --context . \
  --port "${HOST_PORT}:${CONTAINER_PORT}" \
  --env "PORT=${CONTAINER_PORT}"
