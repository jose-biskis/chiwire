# Valenstonic Academy API

JSON API for courses, practices, and admin CRUD. Uses Postgres schema `vt_academy` via Knex.

## Local

```sh
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=chiwire
export CORS_ORIGINS=http://localhost:3000
export PORT=3001

npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/valenstonic-academy-shared
npm run build --workspace @chiwire/valenstonic-academy-backend
npm run start:vtacademy-api
```

Domain: `api.vtacademy.avilalabs.dev` (hostPort `8031`).

Deploy picks up `PGPASSWORD` and `REDIS_PASSWORD` from the host env /
`.env.deploy.local` via `runtime.envFrom`:

```sh
# in .env.deploy.local
PGPASSWORD=your-postgres-password
REDIS_PASSWORD=your-redis-password

npm run deploy:vtacademy-api
```

`PGPASSWORD` must match `POSTGRES_PASSWORD` used for `apps/postgres`.
`REDIS_PASSWORD` must match the password used for `apps/redis`.

On the deploy host, the API joins Docker network `chiwire` and talks to
`postgres-pgbouncer:6432` (and `redis-cache:6379`) by container name.
If Postgres/Redis were deployed before that network existed, attach them once:

```sh
./scripts/connect-deploy-ssh.sh -- docker network connect chiwire postgres-pgbouncer
./scripts/connect-deploy-ssh.sh -- docker network connect chiwire redis-cache
```
