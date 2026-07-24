# Grafana

Deploys Grafana with a provisioned Prometheus datasource, the **Host
hardware** dashboard, and a **Containers** dashboard (from cAdvisor).

Prometheus should already be deployed (`npm run deploy:prometheus`) so Grafana
can reach it at `http://prometheus:9090`. Deploy `apps/cadvisor` as well if you
want per-container graphs.

## Deploy

From the repository root:

Set `GF_SECURITY_ADMIN_PASSWORD` in `.env.deploy.local` (see
`.env.deploy.example`), then:

```sh
npm run deploy:grafana
```

Or pass it explicitly:

```sh
npm run deploy:grafana -- --env GF_SECURITY_ADMIN_PASSWORD=change-me
```

The default deploy settings bind Grafana at `127.0.0.1:3030`. Open a tunnel:

```sh
npm run tunnel:grafana
```

Then open http://localhost:3030 and sign in with `admin` and the password you
passed at deploy time.

To publish Grafana through a reverse proxy:

```sh
npm run deploy:grafana -- \
  --visibility domain \
  --domain metrics.example.com \
  --env GF_SECURITY_ADMIN_PASSWORD=change-me
```

## View-only access

Use the admin account for setup. For day-to-day dashboard viewing, prefer a
restricted Viewer path so Explore, alerting, and admin settings stay out of the
way.

### Viewer user (recommended)

1. Sign in as `admin`.
2. Open **Administration → Users and access → Users**.
3. Create a user with role **Viewer**.
4. Sign out and sign in as that user to view dashboards only.

Viewers can open dashboards. They cannot change datasources, users, or most
server settings.

### Anonymous Viewer (no login)

Anyone who can reach Grafana gets Viewer access without signing in:

```sh
npm run deploy:grafana -- \
  --env GF_AUTH_ANONYMOUS_ENABLED=true \
  --env GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
```

Only use this when Grafana is internal (SSH tunnel) or otherwise protected. Do
not enable anonymous access on a public URL unless you intend the dashboards to
be public.

### Hide extra UI for viewers

Optional environment flags when deploying:

```sh
npm run deploy:grafana -- \
  --env GF_USERS_VIEWERS_CAN_EDIT=false \
  --env GF_EXPLORE_ENABLED=false \
  --env GF_ALERTING_ENABLED=false \
  --env GF_UNIFIED_ALERTING_ENABLED=false
```

| Variable | Effect |
| --- | --- |
| `GF_USERS_VIEWERS_CAN_EDIT` | Keep viewers from editing dashboards when `false`. |
| `GF_EXPLORE_ENABLED` | Hide Explore when `false`. |
| `GF_ALERTING_ENABLED` / `GF_UNIFIED_ALERTING_ENABLED` | Hide alerting UI when `false`. |

You can put non-secret flags in `deploy.json` under `runtime.env`. Keep passwords
in `.env.deploy.local` or pass them with `--env`.

### Kiosk / TV mode

To show a single dashboard without Grafana chrome, open the dashboard URL and
append `?kiosk`:

```text
http://localhost:3030/d/chiwire-host-hardware/host-hardware?kiosk
```

## Defaults

- Grafana UI: container port `3000`, host port `3030` (`visibility: "internal"`)
- Admin user: `admin`
- Datasource: `http://prometheus:9090`
- Data volume: `chiwire-grafana-data:/var/lib/grafana`
- Both Grafana and Prometheus join the `chiwire` Docker network

Override non-secret settings in `deploy.json`. Pass
`GF_SECURITY_ADMIN_PASSWORD` with `--env KEY=VALUE`.

## Local Docker smoke test

```sh
docker build -f apps/grafana/Dockerfile -t chiwire/grafana:latest apps/grafana

docker network create chiwire 2>/dev/null || true

docker run --rm \
  --network chiwire \
  -p 3030:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=change-me \
  chiwire/grafana:latest
```
