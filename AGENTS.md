# AGENTS.md

Guidance for AI agents working in the Chiwire monorepo.

## Project scope gate

Before any exploratory reads, searches, builds, or edits: establish **project scope**.

1. If the user message includes `PROJECT: <name>` (or clearly names one workspace/app), use that as scope.
2. If scope is missing, **ask once** and **stop** — do not scan the monorepo.
3. Bypass only when the user includes `FORCED_RUN: TRUE` (repo-wide, multi-app, or root tooling).

After scope is set: read/edit only that app (or package) plus its confirmed `@chiwire/*` deps. Prefer workspace-scoped npm commands. Full alias table and details: `.cursor/rules/project-scope.mdc`.

## Cursor Cloud specific instructions

### Repository overview

Chiwire is an npm workspaces monorepo with independent apps and shared packages:

| App | Workspace | Dev command | Default port |
|-----|-----------|-------------|--------------|
| AvilaLabs landing page | `@chiwire/avila-labs` | `npm run dev:avila` | 4321 |
| Contimiti share app | `@chiwire/contimiti` | build then `npm run start:contimiti` | 3000 |
| Bull Board (queues UI) | `@chiwire/bull-board` | build then `npm run start:bull-board` | 3000 (deploy host 3040) |
| Design system (Storybook) | `@chiwire/design-system` | `npm run dev:design-system` | 6006 (deploy host 3050) |
| Valenstonic Academy frontend | `@chiwire/valenstonic-academy-frontend` | build then `npm run start:vtacademy` | 3000 |
| Valenstonic Academy API | `@chiwire/valenstonic-academy-backend` | build then `npm run start:vtacademy-api` | 3001 |
| hello-http smoke-test API | `@chiwire/hello-http` | build then `npm run start:hello` | 3000 |
| self-hosted MCP servers | `@chiwire/mcps` | build then `npm run start:mcps` | 3000 |
| Prometheus + node_exporter | `apps/prometheus` | `npm run deploy:prometheus` | 9090 |
| cAdvisor (containers) | `apps/cadvisor` | `npm run deploy:cadvisor` | 8080 |
| Grafana dashboards | `apps/grafana` | `npm run deploy:grafana` | 3030 |
| Cachicamo Coding Agent Local (Electron) | `@chiwire/cachicamo-coding-agent-local` | `npm run dev:cachicamo-coding-agent-local` | desktop app |
| Radiobemba tunnel server | `@chiwire/radiobemba` | `npm run dev:radiobemba` (HTTP :3000 + SSH :2222) | 3000 / 2222 |
| Bemba tunnel CLI | `@chiwire/bemba` | build then `npm run bemba -- http <port>` | n/a |

Shared code lives under `packages/` (`@chiwire/core` has ids, TTL, Knex/pg, and
BullMQ helpers; `@chiwire/radiobemba-shared` has the tunnel wire protocol). Contimiti purge jobs use BullMQ against Redis; Postgres helpers
are available for later persistence.

There is no `docker-compose`, Makefile, or `.devcontainer`. Local development only requires Node.js and npm.

### Standard commands (from repo root)

See `README.md` for full details. Common commands:

- Install: `npm install`
- Typecheck all workspaces: `npm run typecheck`
- Deploy script tests: `npm run test:deploy-settings`
- AvilaLabs dev server: `npm run dev:avila`
- Contimiti: Redis required; `npm run build --workspace @chiwire/core` then `npm run build --workspace @chiwire/contimiti` then `npm run start:contimiti`
- Bull Board: `npm run build --workspace @chiwire/core` then `npm run build --workspace @chiwire/bull-board` then `npm run start:bull-board` (or `npm run tunnel:bull-board` after deploy)
- Design system: `npm run dev:design-system` locally; after deploy `npm run tunnel:design-system` → http://localhost:3050
- Valenstonic Academy API: set `PG*` env vars, then `npm run build --workspace @chiwire/core` && `npm run build --workspace @chiwire/valenstonic-academy-shared` && `npm run build --workspace @chiwire/valenstonic-academy-backend` && `npm run start:vtacademy-api`
- Valenstonic Academy frontend: set `API_BASE_URL=http://localhost:3001`, then build shared + frontend and `npm run start:vtacademy`
- hello-http: `npm run build --workspace @chiwire/hello-http` then `npm run start:hello`
- MCP servers: `npm run build --workspace @chiwire/mcps` then `npm run start:mcps`
- Verify Contimiti: `curl http://localhost:3000/health` and open `http://localhost:3000/`
- Verify Bull Board: `curl http://localhost:3000/health` and open `http://localhost:3000/bullboard`
- Verify hello-http: `curl http://localhost:3000/` and `curl http://localhost:3000/health`
- Verify MCP servers: `curl http://localhost:3000/`, `curl http://localhost:3000/health`, and `curl -X POST http://localhost:3000/trello -H "content-type: application/json" -H "accept: application/json, text/event-stream" --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`
- Radiobemba: `npm run dev:radiobemba` (SSH reverse tunnels on :2222); CLI `npm run build --workspace @chiwire/bemba` then `npm run bemba -- http <port>`; verify `curl http://localhost:3000/health`

### Running dev servers

Start long-running dev servers in tmux (not as one-shot background shell jobs):

```bash
# Contimiti (after building core + app; needs Redis)
npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/contimiti
npm run start:contimiti

# Bull Board (after building core + app; needs Redis)
npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/bull-board
npm run start:bull-board

# hello-http (after building)
npm run build --workspace @chiwire/hello-http
npm run start:hello

# MCP servers (after building)
npm run build --workspace @chiwire/mcps
npm run start:mcps

# AvilaLabs
npm run dev:avila

# Cachicamo Coding Agent Local (Electron desktop; needs Ollama local or cloud API key)
# Supports rules/skills/MCP/subagents + localhost API for n8n on :3847
npm run dev:cachicamo-coding-agent-local

# Radiobemba (HTTP :3000 + SSH :2222; memory persistence by default in dev script)
npm run dev:radiobemba

# Design system Storybook (dev UI on :6006)
npm run dev:design-system
```

hello-http, Contimiti, Bull Board, MCP servers, Radiobemba, and the design-system
static server must be built before their start scripts — they run `node dist/...`.

### Lint / test notes

- There is no ESLint or Prettier configured at the repo root.
- "Lint" for this repo is effectively `npm run typecheck` (Astro check + TypeScript project references).
- Automated tests: `npm run test:deploy-settings` (Node built-in test runner for deploy config).

### Deployment (optional, not needed for local dev)

SSH-based Docker deployment scripts live under `scripts/`. They require Docker locally, a remote SSH host, and credentials via direnv (`.envrc` / `.env.deploy.local`). Do not run deploy scripts unless explicitly testing deployment.

### Node.js version

Dockerfiles use Node 24; local development works on Node 22+ (the cloud VM ships Node 22).
