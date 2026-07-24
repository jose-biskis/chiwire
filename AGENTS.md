# AGENTS.md

Guidance for AI agents working in the Chiwire monorepo.

## Cursor Cloud specific instructions

### Repository overview

Chiwire is an npm workspaces monorepo with independent apps and shared packages:

| App | Workspace | Dev command | Default port |
|-----|-----------|-------------|--------------|
| AvilaLabs landing page | `@chiwire/avila-labs` | `npm run dev:avila` | 4321 |
| Contimiti share app | `@chiwire/contimiti` | build then `npm run start:contimiti` | 3000 |
| hello-http smoke-test API | `@chiwire/hello-http` | build then `npm run start:hello` | 3000 |
| self-hosted MCP servers | `@chiwire/mcps` | build then `npm run start:mcps` | 3000 |
| Prometheus + node_exporter | `apps/prometheus` | `npm run deploy:prometheus` | 9090 |
| cAdvisor (containers) | `apps/cadvisor` | `npm run deploy:cadvisor` | 8080 |
| Grafana dashboards | `apps/grafana` | `npm run deploy:grafana` | 3030 |

Shared code lives under `packages/` (starting with `@chiwire/core`). Contimiti v1
does not talk to Postgres yet; Knex + `pg` helpers are available in core for later.

There is no `docker-compose`, Makefile, or `.devcontainer`. Local development only requires Node.js and npm.

### Standard commands (from repo root)

See `README.md` for full details. Common commands:

- Install: `npm install`
- Typecheck all workspaces: `npm run typecheck`
- Deploy script tests: `npm run test:deploy-settings`
- AvilaLabs dev server: `npm run dev:avila`
- Contimiti: `npm run build --workspace @chiwire/core` then `npm run build --workspace @chiwire/contimiti` then `npm run start:contimiti`
- hello-http: `npm run build --workspace @chiwire/hello-http` then `npm run start:hello`
- MCP servers: `npm run build --workspace @chiwire/mcps` then `npm run start:mcps`
- Verify Contimiti: `curl http://localhost:3000/health` and open `http://localhost:3000/`
- Verify hello-http: `curl http://localhost:3000/` and `curl http://localhost:3000/health`
- Verify MCP servers: `curl http://localhost:3000/`, `curl http://localhost:3000/health`, and `curl -X POST http://localhost:3000/trello -H "content-type: application/json" -H "accept: application/json, text/event-stream" --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`

### Running dev servers

Start long-running dev servers in tmux (not as one-shot background shell jobs):

```bash
# Contimiti (after building core + app)
npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/contimiti
npm run start:contimiti

# hello-http (after building)
npm run build --workspace @chiwire/hello-http
npm run start:hello

# MCP servers (after building)
npm run build --workspace @chiwire/mcps
npm run start:mcps

# AvilaLabs
npm run dev:avila
```

hello-http, Contimiti, and MCP servers must be built before their start scripts — they run
`node dist/index.js`.

### Lint / test notes

- There is no ESLint or Prettier configured at the repo root.
- "Lint" for this repo is effectively `npm run typecheck` (Astro check + TypeScript project references).
- Automated tests: `npm run test:deploy-settings` (Node built-in test runner for deploy config).

### Deployment (optional, not needed for local dev)

SSH-based Docker deployment scripts live under `scripts/`. They require Docker locally, a remote SSH host, and credentials via direnv (`.envrc` / `.env.deploy.local`). Do not run deploy scripts unless explicitly testing deployment.

### Node.js version

Dockerfiles use Node 24; local development works on Node 22+ (the cloud VM ships Node 22).
