# Postgres with PgBouncer

Deploys a small Postgres service that exposes PgBouncer on the host while
keeping the Postgres server private inside the container.

## Deploy

From the repository root:

```sh
npm run deploy:postgres -- --env POSTGRES_PASSWORD=change-me
```

The default deploy settings bind `127.0.0.1:5432` on the Docker host to
PgBouncer inside the container on port `6432`.

## Defaults

- Database: `chiwire`
- User: `chiwire`
- Pool mode: `transaction`
- Max client connections: `100`
- Default pool size: `20`
- Data volume: `chiwire-postgres-data:/var/lib/postgresql/data`

Override non-secret settings in `deploy.json`. Pass secrets such as
`POSTGRES_PASSWORD` with `--env KEY=VALUE` so they are not committed.
