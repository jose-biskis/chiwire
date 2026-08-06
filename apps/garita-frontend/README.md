# Garita frontend

Internal UI for the Garita infra backoffice (`@chiwire/ui` internal archetype).
Serves the SPA and proxies `/api` to `@chiwire/garita-backend` (same pattern as
Valenstonic Academy frontend).

## Local

```sh
# terminal 1 — API on :3001
export PORT=3001
npm run start:garita-api

# terminal 2 — UI on :3000
export API_BASE_URL=http://localhost:3001
npm run build --workspace @chiwire/garita-frontend
npm run start:garita
```

Open `http://localhost:3000/`. Unlock with `GARITA_ADMIN_SECRET` when the API
has that env set.

Vite client-only: `npm run dev:client --workspace @chiwire/garita-frontend`
(proxies `/api` to `:3001`).

## Deploy

Internal only (`hostPort` `8060`). Points at the backend container:

```json
"API_BASE_URL": "http://garita-backend:3000"
```

```sh
npm run deploy:garita-api
npm run deploy:garita
npm run tunnel:garita
```
