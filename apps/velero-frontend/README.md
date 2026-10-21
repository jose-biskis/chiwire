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

On the **deployed** desk, keys stay in Velero Harbor on your laptop
(`npm run velero-gate`), not in this UI. Starting a **live** profile from Full
ahead still sends `--live --confirm` to the CLI child on the VPS; that child
asks Harbor to talk to Binance.

## Deploy

```sh
npm run deploy:velero-api
npm run deploy:velero-desk
```

Domains: UI **velero.avilalabs.dev**, API **api.velero.avilalabs.dev**.
Upstream binds stay **8070** / **8071** on loopback. Tunnel still works:

```sh
npm run tunnel:velero-desk
```
