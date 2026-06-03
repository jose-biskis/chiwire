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

### Deploy an app from project settings

Each app can keep non-secret deployment defaults in a committed `deploy.json`
file. For example, `apps/hello-http/deploy.json` defines the Docker image,
container name, build paths, container port, and whether the app should be
reachable publicly or only through localhost.

Run this from the repository root:

```sh
./scripts/deploy-app.sh apps/hello-http
```

The wrapper reads `apps/hello-http/deploy.json`, then calls
`deploy-docker-ssh.sh` with the derived `--port` and `--env PORT=...` values.
You can also use the npm shortcut:

```sh
npm run deploy:hello
```

The settings file supports these core fields:

| Field | Description |
| --- | --- |
| `image` | Docker image name, without the tag. |
| `tag` | Docker image tag. Defaults to `latest`. |
| `container` | Remote Docker container name. |
| `build.context` | Docker build context, relative to the settings file. |
| `build.dockerfile` | Dockerfile path, relative to the settings file. |
| `runtime.containerPort` | Port the app listens on inside the container. |
| `runtime.visibility` | `internal`, `public`, or `domain`. Defaults to `internal`. |
| `runtime.hostPort` | Host port to bind. Defaults to `runtime.containerPort`. |
| `proxy.domain` | Root domain or subdomain required for `visibility: "domain"`. |
| `proxy.type` | `caddy` or `nginx` for domain deployments. Defaults to `caddy`. |

Visibility controls how the Docker port is published:

| Visibility | Docker binding | Use case |
| --- | --- | --- |
| `internal` | `127.0.0.1:hostPort:containerPort` | App is reachable only on the deploy host or by another host-level service. |
| `public` | `hostPort:containerPort` | App is reachable directly from the internet on the host port. |
| `domain` | `127.0.0.1:hostPort:containerPort` plus reverse proxy | App is served from a root domain or subdomain through Caddy or nginx. |

AvilaLabs has the same kind of settings in `apps/avila-labs/deploy.json` and
can be deployed with:

```sh
./scripts/deploy-app.sh apps/avila-labs
npm run deploy:avila
```

For one-off changes, prefer CLI overrides instead of editing the file:

```sh
./scripts/deploy-app.sh apps/hello-http --visibility internal
./scripts/deploy-app.sh apps/hello-http --visibility domain --domain app.example.com
```

Use `--dry-run` to inspect the generated commands without building, uploading,
or connecting over SSH:

```sh
./scripts/deploy-app.sh apps/hello-http --dry-run
```

Keep secrets such as SSH credentials in `.env.deploy.local`; `deploy.json`
should contain app metadata and routing choices that are safe to commit.

### Deploy the hello HTTP test app directly

`deploy-docker-ssh.sh` remains available as the low-level command when you need
to pass every Docker option manually.

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

### Deploy the AvilaLabs Astro landing page directly

The AvilaLabs app builds to static files and is served from an nginx container.
Run this from the repository root:

```sh
./scripts/deploy-docker-ssh.sh \
  --image chiwire/avila-labs \
  --tag latest \
  --container avila-labs \
  --dockerfile apps/avila-labs/Dockerfile \
  --context . \
  --port 127.0.0.1:3000:80
```

Then configure the reverse proxy with `--upstream 127.0.0.1:3000`.

### Use the example wrapper script

Copy the example script, then configure it with environment variables or the
direnv workflow above:

```sh
cp scripts/examples/deploy-hello-http.example.sh deploy-hello-http.sh
chmod +x deploy-hello-http.sh

SSH_HOST=deploy@example.com \
SSH_PORT=22 \
./deploy-hello-http.sh
```

For AvilaLabs:

```sh
cp scripts/examples/deploy-avila-labs.example.sh deploy-avila-labs.sh
chmod +x deploy-avila-labs.sh

SSH_HOST=deploy@example.com \
SSH_PORT=22 \
./deploy-avila-labs.sh
```

The wrappers read each app's `deploy.json` and support the same CLI overrides as
`deploy-app.sh`, for example:

```sh
./deploy-hello-http.sh --visibility internal
./deploy-hello-http.sh --tag canary --dry-run
./deploy-avila-labs.sh --visibility domain --domain avilalabs.example
```

The example still supports the SSH-related environment variables loaded by
`.env.deploy.local`:

| Variable | Default | Description |
| --- | --- | --- |
| `SSH_HOST` | `deploy@example.com` | SSH target for the remote Docker host. |
| `DEPLOY_SSH_TARGET` | unset | SSH target used when `SSH_HOST` is unset. |
| `DEPLOY_SSH_USER` + `DEPLOY_SSH_HOST` | unset | User and host values used when `SSH_HOST` and `DEPLOY_SSH_TARGET` are unset. |
| `SSH_PORT` | `22` | SSH port. |
| `DEPLOY_SSH_PORT` | unset | SSH port used when `SSH_PORT` is unset. |
| `SSH_IDENTITY_FILE` | unset | Optional SSH private key path. |
| `SSHPASS` | unset | Optional password used through `sshpass -e`. |

### Serve the app from a root domain or subdomain

Direct port publishing serves plain HTTP, for example `http://example.com:8080/`.
To serve `.dev` domains or any production-style URL over HTTPS, publish the
container on localhost and configure a host-level reverse proxy. With app
settings, change the app's `deploy.json` to use `domain` visibility:

```json
{
  "runtime": {
    "containerPort": 3000,
    "visibility": "domain",
    "hostPort": 3000
  },
  "proxy": {
    "type": "caddy",
    "domain": "app.host.dev"
  }
}
```

Then point DNS for the root domain (`host.dev`) or subdomain (`app.host.dev`) to
the deploy host and run:

```sh
./scripts/deploy-app.sh apps/hello-http
```

The wrapper deploys the container to `127.0.0.1:3000` and then runs
`configure-reverse-proxy-ssh.sh` for the configured domain. You can still run the
proxy script directly when you need to manage host-level routing separately.

#### Caddy

Caddy obtains and renews Let's Encrypt certificates automatically:

```sh
./scripts/configure-reverse-proxy-ssh.sh \
  --proxy caddy \
  --domain host.dev \
  --upstream 127.0.0.1:3000
```

Use a subdomain by changing only the domain:

```sh
./scripts/configure-reverse-proxy-ssh.sh \
  --proxy caddy \
  --domain app.host.dev \
  --upstream 127.0.0.1:3000
```

The remote host must already have Caddy installed and reachable on ports 80 and
443. The SSH user must be able to run `sudo` without an interactive password, or
you can connect as root with `--no-sudo`.

#### nginx

The nginx mode writes an HTTP reverse proxy site, validates nginx, reloads it,
and then uses certbot's nginx plugin to request and install HTTPS:

```sh
./scripts/configure-reverse-proxy-ssh.sh \
  --proxy nginx \
  --domain app.host.dev \
  --upstream 127.0.0.1:3000 \
  --email admin@host.dev
```

The remote host must already have nginx, certbot, and the certbot nginx plugin
installed. If you only want HTTP, pass `--skip-tls`.

The proxy script accepts the same SSH target options as the deploy script:
`--host`, `--ssh-port`, `--identity-file`, and repeatable `--ssh-option`.

You can also configure it with environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PROXY_TYPE` | `caddy` | Reverse proxy to configure: `caddy` or `nginx`. |
| `PROXY_DOMAIN` | unset | Root domain or subdomain to serve. |
| `PROXY_UPSTREAM` | `127.0.0.1:3000` | Local upstream address for the container. |
| `PROXY_TLS_EMAIL` | unset | Let's Encrypt email used by nginx/certbot. |
| `PROXY_SKIP_TLS` | unset | Set to `1`, `true`, or `yes` to configure HTTP only. |

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
