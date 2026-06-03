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

See [`scripts/README.md`](scripts/README.md) for the reusable SSH-based Docker
deployment scripts. Apps can keep non-secret deploy defaults in their own
`deploy.json` files, so ports and public/internal visibility are defined once
beside the app:

```sh
npm run deploy:hello
```

The lower-level Docker deploy script and reverse proxy setup are still available
for manual deployments and host routing with Caddy or nginx.

## Dependency map

Use `npm run dependency-map` to generate a source dependency map, or
`npm run affected -- --base origin/main` to list changed files plus every file
that depends on them. See [`docs/dependency-map.md`](docs/dependency-map.md) for
details and the future test-targeting workflow.

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
