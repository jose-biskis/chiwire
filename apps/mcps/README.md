# Chiwire MCPs

`apps/mcps` is a deployable workspace for self-hosted Model Context Protocol
servers. It exposes a Streamable HTTP MCP endpoint at `/mcp`, plus simple
`/` and `/health` endpoints for deployment smoke tests.

## Run locally

From the repository root:

```sh
npm run build --workspace @chiwire/mcps
npm run start:mcps
```

Then smoke test the service:

```sh
curl http://localhost:3000/
curl http://localhost:3000/health
```

## Add your own MCPs

Edit `src/index.ts` and register your own MCP capabilities:

- `server.registerTool(...)` for actions the model can call.
- `server.registerResource(...)` for data the model can read.
- `server.registerPrompt(...)` for reusable prompt templates.

The starter server includes a `server-info` tool and a `deployment-guide`
resource so MCP clients can verify the endpoint.

## Deploy to your own server

Configure the SSH deployment environment from `scripts/README.md`, then run:

```sh
npm run deploy:mcps
```

The committed `deploy.json` binds the container internally on host port `8010`
by default. Override it when deploying if you want a public port or a domain:

```sh
./scripts/deploy-app.sh apps/mcps --visibility domain --domain mcps.example.com
```

Set `MCP_ALLOWED_ORIGIN` in your server environment to restrict browser-based
MCP clients.
