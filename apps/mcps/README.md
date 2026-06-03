# Chiwire MCPs

`apps/mcps` is a deployable workspace for self-hosted Model Context Protocol
servers. It exposes Streamable HTTP MCP endpoints at dynamic `/{server}` paths,
plus simple `/` and `/health` endpoints for deployment smoke tests.

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
curl http://localhost:3000/trello
```

## Trello MCP tools

This workspace includes Trello MCP tools for:

- listing boards, lists, and cards
- fetching a card
- creating a card
- updating or moving a card
- adding a card comment

The Trello MCP endpoint is `/trello`, so a deployed server can be used as
`https://mcps.example.dev/trello`.

Send these headers with MCP requests:

```sh
x-trello-api-key: your-trello-api-key
x-trello-token: your-trello-token
```

The server falls back to these environment variables when headers are absent:

```sh
TRELLO_API_KEY=your-trello-api-key
TRELLO_TOKEN=your-trello-token
```

Optionally send `x-trello-api-base-url` or set `TRELLO_API_BASE_URL` to override
the Trello API base URL.

Generate both from [trello.com/app-key](https://trello.com/app-key) while signed
in to Trello.

## Add your own MCPs

Edit `src/index.ts` or add modules beside it to register your own MCP
capabilities:

- `server.registerTool(...)` for actions the model can call.
- `server.registerResource(...)` for data the model can read.
- `server.registerPrompt(...)` for reusable prompt templates.

The Trello server includes a `server-info` tool, a `deployment-guide` resource,
and a `trello-setup` resource so MCP clients can verify the endpoint and Trello
setup.

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
