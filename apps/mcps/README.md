# Chiwire MCPs

Self-hosted Model Context Protocol servers. Trello credentials are managed by
**Garita** (Postgres + Redis). Cursor only needs the MCP auth bearer secret.

## Architecture

```text
Garita UI → Garita API → Postgres (mcps.*) → Redis cache
                                         ↑
Cursor → MCP_AUTH_SECRET → /trello  ─────┘
```

Each Trello workspace has its own API key and token. Tools take a
`workspace` argument (`avilalabs`, `valenstonic`, …).

## Run locally

### With Garita / Postgres / Redis (preferred)

```sh
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=chiwire
export REDIS_HOST=127.0.0.1
# optional: export MCP_AUTH_SECRET=...

npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/db-migrate
npm run build --workspace @chiwire/mcps-config
npm run build --workspace @chiwire/mcps
npm run start:mcps
```

Configure workspaces in Garita, then point Cursor at `http://localhost:3000/trello`.

### Env-only fallback (no Postgres)

```sh
export TRELLO_AVILALABS_API_KEY=...
export TRELLO_AVILALABS_TOKEN=...
export TRELLO_VALENSTONIC_API_KEY=...
export TRELLO_VALENSTONIC_TOKEN=...

npm run build --workspace @chiwire/mcps-config
npm run build --workspace @chiwire/mcps
npm run start:mcps
```

## Cursor (deployed)

```json
{
  "mcpServers": {
    "ChiwireTrello": {
      "url": "https://mcps.avilalabs.dev/trello",
      "headers": {
        "Authorization": "Bearer ${env:AVILALABS_MCP_SECRET}"
      }
    }
  }
}
```

Set `AVILALABS_MCP_SECRET` in your OS env to the value managed in Garita
(or `MCP_AUTH_SECRET` at deploy). Never put Trello keys in `mcp.json`.

## Deploy

```sh
npm run deploy:mcps
```

`deploy.json` forwards `PGPASSWORD`, `REDIS_PASSWORD`, and optional
`MCP_AUTH_SECRET`. Workspace credentials should live in the database via Garita.

## Smoke test

```sh
curl http://localhost:3000/
curl http://localhost:3000/health
curl -X POST http://localhost:3000/trello \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
