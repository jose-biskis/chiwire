# Velero frontend

Ship's desk for the Velero watcher. Same stdout as the CLI, plus start/stop
and named profiles. The trader is `@chiwire/velero-shared` via
`@chiwire/velero-cli`; this UI talks to `@chiwire/velero-backend`.

## Local

Terminal 1:

```sh
npm run start:velero-api
```

Terminal 2 (Vite, hot reload):

```sh
npm run dev:velero-desk
```

Open http://localhost:5175

Or the built static server (port 3000, proxies `/api` to 3001):

```sh
npm run start:velero-desk
```

Keys stay in `apps/velero-cli/.env`. Starting a **live** profile from Full ahead
sends `--live --confirm` to the CLI.

## Deploy

```sh
npm run deploy:velero-api
npm run deploy:velero-desk
```

Internal: UI on host **8070**, API on **8071**. Tunnel:

```sh
npm run tunnel:velero-desk
```
