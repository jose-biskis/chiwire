# AGENTS.md

Guidance for AI agents working in the Chiwire monorepo.

## Cursor Cloud specific instructions

### Repository overview

Chiwire is an npm workspaces monorepo with two independent apps and no shared backend or database:

| App | Workspace | Dev command | Default port |
|-----|-----------|-------------|--------------|
| AvilaLabs landing page | `@chiwire/avila-labs` | `npm run dev:avila` | 4321 |
| hello-http smoke-test API | `@chiwire/hello-http` | build then `npm run start:hello` | 3000 |
| self-hosted MCP servers | `@chiwire/mcps` | build then `npm run start:mcps` | 3000 |

There is no `docker-compose`, Makefile, or `.devcontainer`. Local development only requires Node.js and npm.

### Standard commands (from repo root)

See `README.md` for full details. Common commands:

- Install: `npm install`
- Typecheck all workspaces: `npm run typecheck`
- Deploy script tests: `npm run test:deploy-settings`
- AvilaLabs dev server: `npm run dev:avila`
- hello-http: `npm run build --workspace @chiwire/hello-http` then `npm run start:hello`
- MCP servers: `npm run build --workspace @chiwire/mcps` then `npm run start:mcps`
- Verify hello-http: `curl http://localhost:3000/` and `curl http://localhost:3000/health`
- Verify MCP servers: `curl http://localhost:3000/` and `curl http://localhost:3000/health`

### Running dev servers

Start long-running dev servers in tmux (not as one-shot background shell jobs):

```bash
# hello-http (after building)
npm run build --workspace @chiwire/hello-http
npm run start:hello

# MCP servers (after building)
npm run build --workspace @chiwire/mcps
npm run start:mcps

# AvilaLabs
npm run dev:avila
```

hello-http and MCP servers must be built before their start scripts — they run
`node dist/index.js`.

### Lint / test notes

- There is no ESLint or Prettier configured at the repo root.
- "Lint" for this repo is effectively `npm run typecheck` (Astro check + TypeScript project references).
- Automated tests: `npm run test:deploy-settings` (Node built-in test runner for deploy config).

### Deployment (optional, not needed for local dev)

SSH-based Docker deployment scripts live under `scripts/`. They require Docker locally, a remote SSH host, and credentials via direnv (`.envrc` / `.env.deploy.local`). Do not run deploy scripts unless explicitly testing deployment.

### Node.js version

Dockerfiles use Node 24; local development works on Node 22+ (the cloud VM ships Node 22).
