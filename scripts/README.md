# Scripts

This folder contains reusable local development and deployment scripts.

## Deploy Docker over SSH

Use `deploy-docker-ssh.sh` to build a Docker image locally, upload it to a
remote server over SSH, load it into Docker on the server, and replace a running
container.

The remote SSH user must be able to run `docker` commands in a non-interactive
SSH session.

### Deploy the hello HTTP test app directly

Run this from the repository root:

```sh
./scripts/deploy-docker-ssh.sh \
  --host deploy@example.com \
  --ssh-port 22 \
  --image chiwire/hello-http \
  --tag latest \
  --container hello-http \
  --dockerfile apps/hello-http/Dockerfile \
  --context . \
  --port 8080:3000 \
  --env PORT=3000
```

Then test the remote service:

```sh
curl http://example.com:8080/
# Hello, world!
```

### Use the example wrapper script

Copy the example script, then configure it with environment variables:

```sh
cp scripts/examples/deploy-hello-http.example.sh deploy-hello-http.sh
chmod +x deploy-hello-http.sh

SSH_HOST=deploy@example.com \
SSH_PORT=22 \
HOST_PORT=8080 \
./deploy-hello-http.sh
```

The example supports these environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `SSH_HOST` | `deploy@example.com` | SSH target for the remote Docker host. |
| `SSH_PORT` | `22` | SSH port. |
| `IMAGE_NAME` | `chiwire/hello-http` | Docker image name to build and deploy. |
| `IMAGE_TAG` | `latest` | Docker image tag. |
| `CONTAINER_NAME` | `hello-http` | Remote Docker container name. |
| `HOST_PORT` | `8080` | Remote host port to publish. |
| `CONTAINER_PORT` | `3000` | Container port used by the app. |

### More options

The deploy script is reusable for other Dockerized apps. Run the help command to
see all supported build, run, and SSH options:

```sh
./scripts/deploy-docker-ssh.sh --help
```

### Troubleshooting

If deployment fails with a message like `bash: line 4: docker: command not
found`, Docker is missing from the remote host's non-interactive SSH `PATH`.
Install Docker on the remote host, or connect as a user whose SSH session can run
`docker`.

If Docker is installed but the deploy user cannot access the daemon, verify this
from your local machine:

```sh
ssh deploy@example.com 'docker info'
```

The command must succeed without `sudo` for this script to deploy the container.
