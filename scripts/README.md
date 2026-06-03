# Scripts

This folder contains reusable local development and deployment scripts.

## Deploy Docker over SSH

Use `deploy-docker-ssh.sh` to build a Docker image locally, upload it to a
remote server over SSH, load it into Docker on the server, and replace a running
container.

The remote SSH user must be able to run `docker` commands in a non-interactive
SSH session.

### Load deploy settings with direnv

Enable direnv for Bash if it is not already hooked into your shell:

```sh
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc && source ~/.bashrc
```

Then use the committed `.envrc` to load local deployment settings
automatically:

```sh
cp .env.deploy.example .env.deploy.local
$EDITOR .env.deploy.local
direnv allow
```

`.env.deploy.local` is ignored by git and should contain your real deploy host,
user, and optional password or SSH key path. The `.envrc` maps these local
settings into the variables used by the deploy scripts:

| Local variable | Exported variable | Description |
| --- | --- | --- |
| `DEPLOY_SSH_TARGET` | `SSH_HOST` | Full SSH target, for example `deploy@example.com`. |
| `DEPLOY_SSH_USER` + `DEPLOY_SSH_HOST` | `SSH_HOST` | User and host values used to build `user@host`. |
| `DEPLOY_SSH_PORT` | `SSH_PORT` | SSH port. |
| `DEPLOY_SSH_IDENTITY_FILE` | `SSH_IDENTITY_FILE` | SSH private key path. |
| `DEPLOY_SSH_PASSWORD` | `SSHPASS` | Password used by `sshpass -e`. |

Prefer SSH keys when possible. If you use `DEPLOY_SSH_PASSWORD`, install
`sshpass` locally first; the deploy script will fail with a clear message if
`SSHPASS` is set and `sshpass` is unavailable.

The deploy scripts resolve the SSH target in this order:

1. `--host USER@HOST`
2. `SSH_HOST`
3. `DEPLOY_SSH_TARGET`
4. `DEPLOY_SSH_USER` + `DEPLOY_SSH_HOST`

### Deploy the hello HTTP test app directly

Run this from the repository root:

```sh
./scripts/deploy-docker-ssh.sh \
  --image chiwire/hello-http \
  --tag latest \
  --container hello-http \
  --dockerfile apps/hello-http/Dockerfile \
  --context . \
  --port 8080:3000 \
  --env PORT=3000
```

If you are not using `direnv`, pass `--host deploy@example.com` or export
`SSH_HOST`, `DEPLOY_SSH_TARGET`, or both `DEPLOY_SSH_USER` and
`DEPLOY_SSH_HOST` before running the command. `--ssh-port` is also optional when
`SSH_PORT` or `DEPLOY_SSH_PORT` is set.

Then test the remote service:

```sh
curl http://example.com:8080/
# Hello, world!
```

### Use the example wrapper script

Copy the example script, then configure it with environment variables or the
direnv workflow above:

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
| `DEPLOY_SSH_TARGET` | unset | SSH target used when `SSH_HOST` is unset. |
| `DEPLOY_SSH_USER` + `DEPLOY_SSH_HOST` | unset | User and host values used when `SSH_HOST` and `DEPLOY_SSH_TARGET` are unset. |
| `SSH_PORT` | `22` | SSH port. |
| `DEPLOY_SSH_PORT` | unset | SSH port used when `SSH_PORT` is unset. |
| `SSH_IDENTITY_FILE` | unset | Optional SSH private key path. |
| `SSHPASS` | unset | Optional password used through `sshpass -e`. |
| `IMAGE_NAME` | `chiwire/hello-http` | Docker image name to build and deploy. |
| `IMAGE_TAG` | `latest` | Docker image tag. |
| `CONTAINER_NAME` | `hello-http` | Remote Docker container name. |
| `HOST_PORT` | `8080` | Remote host port to publish. |
| `CONTAINER_PORT` | `3000` | Container port used by the app. |

### Connect to the deploy host over SSH

Use `connect-deploy-ssh.sh` to open an SSH session with the same deploy
variables:

```sh
./scripts/connect-deploy-ssh.sh
```

You can also run a remote command by placing it after `--`:

```sh
./scripts/connect-deploy-ssh.sh -- docker ps
```

The script accepts the same SSH target options as the deploy script:
`--host`, `--ssh-port`, `--identity-file`, and repeatable `--ssh-option`.

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
