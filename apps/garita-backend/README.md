# Garita backend

Internal API for the Garita infra backoffice. Owns Postgres schema `mcps` writes
and Redis cache updates used by `@chiwire/mcps`.

## Local

```sh
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=chiwire
export REDIS_HOST=127.0.0.1
export PORT=3001
# export GARITA_ADMIN_SECRET=dev-secret

npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/db-migrate
npm run build --workspace @chiwire/mcps-config
npm run build --workspace @chiwire/garita-backend
npm run start:garita-api
```

## Deploy

Internal only (`hostPort` `8061`). Set `GARITA_ADMIN_SECRET`, `PGPASSWORD`,
`REDIS_PASSWORD` in `.env.deploy.local`, then:

```sh
npm run deploy:garita-api
```

The UI is `@chiwire/garita-frontend` (proxies `/api` here).
