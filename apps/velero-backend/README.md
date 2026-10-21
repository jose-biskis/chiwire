# Velero backend

HTTP desk for the Velero CLI watcher. `@chiwire/velero-shared` is the trader;
`@chiwire/velero-cli` is the argv/stdout transport. This process starts/stops
that CLI, stores named profiles, and streams the same stdout the terminal
would show.

Keys still live in `apps/velero-cli/.env` (or `envFrom` on deploy). Never paste
them in the UI.

## Local

```sh
npm run build --workspace @chiwire/velero-shared
npm run build --workspace @chiwire/velero-cli
npm run build --workspace @chiwire/velero-backend
PORT=3001 npm run start --workspace @chiwire/velero-backend
```

Or from repo root: `npm run start:velero-api`

- `GET /health`
- `GET /api/status`
- `GET/POST /api/profiles`  `PUT/DELETE /api/profiles/:id`
- `POST /api/watch/start` `{ "profileId": "..." }`
- `POST /api/watch/stop`
- `GET /api/logs`  `GET /api/logs/stream` (SSE)

Starting a live profile from the desk is the confirm (the child gets
`--live --confirm`).

Deployed desks set `VELERO_REQUIRE_GATE=true`. Binance is signed on the laptop
(**Velero Harbor**, `npm run velero-gate`). Set `VELERO_GATE_TOKEN` in
`.env.deploy.local` and in the Harbor UI. Do not put API keys on the VPS.

## Deploy

```sh
npm run deploy:velero-api
```

Domain **api.velero.avilalabs.dev** (loopback upstream **8071**). Profiles persist
on volume `chiwire-velero-data`.
