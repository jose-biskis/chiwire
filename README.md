# Chiwire

Chiwire is a TypeScript monorepo for personal and business idea projects.
It is set up to hold multiple applications and shared packages while keeping a
single baseline for TypeScript configuration and developer scripts.

## Repository layout

```text
.
├── apps/              # Deployable apps and experiments
│   └── hello-http/    # Minimal HTTP service for Docker deployment testing
├── packages/          # Shared libraries, utilities, and project modules
├── scripts/           # Reusable local development and deployment scripts
├── package.json       # Root workspace metadata and scripts
├── tsconfig.base.json # Shared TypeScript compiler options
└── tsconfig.json      # Root TypeScript project references entrypoint
```

## Getting started

Install dependencies from the repository root:

```sh
npm install
```

Run the workspace type check:

```sh
npm run typecheck
```

## Hello HTTP test app

The `apps/hello-http` workspace is a minimal Node.js HTTP service for smoke
testing Docker deployments.

Build and run it locally:

```sh
npm run build --workspace @chiwire/hello-http
npm run start:hello
```

Test the GET endpoint:

```sh
curl http://localhost:3000/
# Hello, world!
```

Build the Docker image from the repository root:

```sh
docker build \
  -f apps/hello-http/Dockerfile \
  -t chiwire/hello-http:latest \
  .
```

Run the container locally:

```sh
docker run --rm -p 3000:3000 chiwire/hello-http:latest
curl http://localhost:3000/
```

## Deploy Docker over SSH

Use `scripts/deploy-docker-ssh.sh` to build a Docker image locally, upload it to
a remote server over SSH, load it into Docker on the server, and replace a
running container.

The remote SSH user must be able to run `docker` commands.

Deploy the hello test app:

```sh
./scripts/deploy-docker-ssh.sh \
  --host deploy@example.com \
  --image chiwire/hello-http \
  --tag latest \
  --container hello-http \
  --dockerfile apps/hello-http/Dockerfile \
  --context . \
  --port 8080:3000
```

Then test the remote service:

```sh
curl http://example.com:8080/
# Hello, world!
```

The script is reusable for other Dockerized apps. Run the help command to see
all supported build, run, and SSH options:

```sh
./scripts/deploy-docker-ssh.sh --help
```

## Workspaces

This repository uses npm workspaces:

- `apps/*` for application projects.
- `packages/*` for shared TypeScript packages.

When adding a new app or package, create a `package.json` in the workspace
folder and add its TypeScript project to the root `tsconfig.json` references if
it should be included in `npm run typecheck`.

## TypeScript

The root TypeScript setup is intentionally small:

- `tsconfig.base.json` contains strict shared compiler options.
- `tsconfig.json` is a solution-style project that can reference apps and
  packages as they are added.

Individual workspaces should extend `../../tsconfig.base.json` and define their
own `rootDir`, `outDir`, `include`, and `exclude` settings.
