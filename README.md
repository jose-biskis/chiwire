# Chiwire

Chiwire is a TypeScript monorepo for personal and business idea projects.
It is set up to hold multiple applications and shared packages while keeping a
single baseline for TypeScript configuration and developer scripts.

## Repository layout

```text
.
├── apps/              # Deployable apps and experiments
│   ├── avila-labs/    # Astro landing page for AvilaLabs
│   ├── contimiti/     # One-day text and file shares
│   ├── bull-board/    # Internal BullMQ dashboard (SSH tunnel)
│   ├── hello-http/    # Minimal HTTP service for Docker deployment testing
│   ├── mcps/          # Self-hosted Model Context Protocol servers
│   ├── postgres/      # Postgres service fronted by PgBouncer
│   ├── cadvisor/      # Per-container metrics for Prometheus
│   ├── grafana/       # Grafana dashboards for Prometheus metrics
│   ├── prometheus/    # Prometheus + node_exporter host metrics
│   ├── redis/         # Redis for cache + BullMQ
│   ├── radiobemba/    # Self-hosted HTTP tunnel control plane + proxy
│   ├── bemba/         # CLI for Radiobemba tunnels
│   └── cachicamo-coding-agent-local/ # Electron coding agent (Ollama local/cloud)
├── packages/          # Shared libraries, utilities, and project modules
│   ├── core/          # Ids, TTL, Knex/pg, BullMQ helpers
│   └── radiobemba-shared/ # Radiobemba wire protocol + slug helpers
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

## AvilaLabs landing page

The `apps/avila-labs` workspace is an Astro landing page with a stylized
low-poly mountain scene, a Three.js 3D mascot, and Anime.js-powered macaws.

Run it locally:

```sh
npm run dev:avila
```

Build the static site:

```sh
npm run build --workspace @chiwire/avila-labs
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

## MCP servers

The `apps/mcps` workspace is a deployable home for self-hosted Model Context
Protocol servers. It exposes Streamable HTTP endpoints at dynamic `/{server}`
paths, plus `/` and `/health` endpoints for deployment checks.

It includes Trello MCP tools for listing boards, lists, and cards; fetching a
card; creating or updating cards; and adding card comments. Send
`x-trello-api-key` and `x-trello-token` MCP request headers, or configure
`TRELLO_API_KEY` and `TRELLO_TOKEN` in the server environment as a fallback.
The Trello MCP endpoint is `/trello`.

Run it locally:

```sh
npm run build --workspace @chiwire/mcps
npm run start:mcps
```

Deploy it to your own server:

```sh
npm run deploy:mcps
```

Add custom MCP tools, resources, and prompts in
[`apps/mcps/src/index.ts`](apps/mcps/src/index.ts). See
[`apps/mcps/README.md`](apps/mcps/README.md) for extension and deployment
details.

## Contimiti

The `apps/contimiti` workspace is a one-day share app for notes and files.
Texts open in the browser (copy + update). Files support upload, download, and
delete. Storage is local filesystem for v1. Expired shares are purged by a
BullMQ repeatable job every 5 minutes (Redis required).

```sh
npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/contimiti
npm run start:contimiti
```

Deploy to `contimiti.avilalabs.dev`:

```sh
npm run deploy:contimiti
```

See [`apps/contimiti/README.md`](apps/contimiti/README.md).

## Bull Board

Internal BullMQ dashboard (same tunnel pattern as Grafana):

```sh
npm run deploy:bull-board
npm run tunnel:bull-board
```

Open [http://localhost:3040/bullboard](http://localhost:3040/bullboard). See
[`apps/bull-board/README.md`](apps/bull-board/README.md).

## Design system

Storybook for Chiwire UI archetypes (Internal default, Valenstonic, …):

```sh
npm run dev:design-system
```

Open [http://localhost:6006](http://localhost:6006). Deployed preview (same tunnel
pattern as Grafana / Bull Board):

```sh
npm run deploy:design-system
npm run tunnel:design-system
```

Open [http://localhost:3050](http://localhost:3050). See
[`apps/design-system/README.md`](apps/design-system/README.md).

## Service sections

The `apps/postgres`, `apps/prometheus`, `apps/cadvisor`, `apps/grafana`, and
`apps/redis` sections are Docker-deployable services that use the same SSH
deployment wrapper as the apps.

Postgres is fronted by PgBouncer. The default deployment binds
`127.0.0.1:5432` on the Docker host to PgBouncer inside the container on port
`6432`, with Postgres listening only inside the container:

```sh
npm run deploy:postgres -- --env POSTGRES_PASSWORD=change-me
```

Redis serves cache and BullMQ (`maxmemory 256mb`, `noeviction` so job keys are
not LRU-evicted):

```sh
npm run deploy:redis
npm run deploy:redis -- --env REDIS_PASSWORD=change-me
```

Prometheus + node_exporter collect host hardware metrics on
`127.0.0.1:9090`. cAdvisor adds per-container CPU/memory. Grafana serves
dashboards on `127.0.0.1:3030`. Bull Board serves queue UI on `127.0.0.1:3040`.
Design system Storybook serves on `127.0.0.1:3050`:

```sh
npm run deploy:prometheus
npm run deploy:cadvisor
npm run deploy:grafana
npm run tunnel:grafana
npm run deploy:bull-board
npm run tunnel:bull-board
npm run deploy:design-system
npm run tunnel:design-system
```

Keep committed service defaults in each section's `deploy.json`. Pass secrets at
deploy time with repeatable `--env KEY=VALUE` options.

## Deploy Docker over SSH

See [`scripts/README.md`](scripts/README.md) for the reusable SSH-based Docker
deployment scripts. Apps can keep non-secret deploy defaults in their own
`deploy.json` files, so ports and public/internal visibility are defined once
beside the app:

```sh
npm run deploy:avila
npm run deploy:hello
npm run deploy:contimiti
npm run deploy:bull-board
npm run deploy:design-system
npm run deploy:postgres -- --env POSTGRES_PASSWORD=change-me
npm run deploy:prometheus
npm run deploy:cadvisor
npm run deploy:grafana
npm run deploy:redis
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

## Radiobemba

Radiobemba is a self-hosted ngrok-style HTTP tunnel over **SSH reverse
forwards**. Public URLs look like `{slug}.bemba.avilalabs.dev`.

```sh
# server (local, in-memory permanent store)
npm run dev:radiobemba

# CLI (another terminal)
npm run build --workspace @chiwire/bemba
npm run bemba -- http 3000
# permanent:
# npm run bemba -- http 3000 --permanent --subdomain myapp --token secret
```

See [`apps/radiobemba/README.md`](apps/radiobemba/README.md) and
[`apps/bemba/README.md`](apps/bemba/README.md).

## Cachicamo Coding Agent Local

`apps/cachicamo-coding-agent-local` is an Electron desktop coding agent that talks to
Ollama (local daemon or [ollama.com](https://ollama.com) cloud) and can edit a
workspace folder via tools.

```sh
npm run dev:cachicamo-coding-agent-local
```

See [`apps/cachicamo-coding-agent-local/README.md`](apps/cachicamo-coding-agent-local/README.md)
for setup details.

## TypeScript

The root TypeScript setup is intentionally small:

- `tsconfig.base.json` contains strict shared compiler options.
- `tsconfig.json` is a solution-style project that can reference apps and
  packages as they are added.

Individual workspaces should extend `../../tsconfig.base.json` and define their
own `rootDir`, `outDir`, `include`, and `exclude` settings.
