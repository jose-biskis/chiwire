# Radiobemba

Self-hosted HTTP tunnels for AvilaLabs — *la radio bemba del localhost*.

Transport is an **SSH reverse tunnel** (`ssh -R` via `ssh2`). TypeScript owns
subdomain allocation, temp vs permanent reservations, and the public HTTP proxy.

Public tunnel hostnames:

```text
{slug}.bemba.avilalabs.dev
```

## Pieces

| Package | Role |
|---------|------|
| `@chiwire/radiobemba` | HTTP control/proxy + embedded SSH server |
| `@chiwire/bemba` | CLI that opens the reverse tunnel |
| `@chiwire/radiobemba-shared` | Control-channel protocol + slug helpers |

## How it works

1. CLI authenticates to Radiobemba SSH and requests `tcpip-forward` (remote port 0)
2. CLI runs `register` over an SSH exec channel (`temp` or `permanent` + slug)
3. Public HTTP for `{slug}.…` is streamed to `127.0.0.1:<forwardPort>`
4. That TCP connection is forwarded over SSH to the agent’s localhost port

## Temp vs permanent

| Kind | Storage | Lifetime |
|------|---------|----------|
| **temp** | In-memory session map | Dies when SSH disconnects; slug freed |
| **permanent** | Postgres `radiobemba.tunnel_reservations` (or memory if no DB) | Slug reserved offline; reconnect with same token |

Permanent requires `--subdomain` and a token (owner key). Offline permanent URLs
return HTTP 503 `Tunnel offline`.

## Local development

```sh
# terminal 1 — server (memory reservations; no Postgres required)
npm run build --workspace @chiwire/radiobemba-shared
npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/db-migrate
npm run build --workspace @chiwire/radiobemba
RADIOBEMBA_PERSISTENCE=memory \
RADIOBEMBA_BASE_DOMAIN=bemba.localhost \
RADIOBEMBA_PUBLIC_ORIGIN=http://localhost:3000 \
npm run start:radiobemba

# terminal 2 — local app
npx --yes serve -l 4173

# terminal 3 — CLI
npm run build --workspace @chiwire/bemba
npm run bemba -- http 4173
```

Without wildcard DNS, use the printed **Path URL**:

```text
http://localhost:3000/t/{slug}/
```

### Permanent (local memory)

```sh
npm run bemba -- http 4173 --permanent --subdomain demo --token secret
```

### Permanent (Postgres)

```sh
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=chiwire
RADIOBEMBA_PERSISTENCE=postgres npm run start:radiobemba
# schema applies on boot; or: npm run db:migrate:radiobemba
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP listen port |
| `RADIOBEMBA_SSH_PORT` | `2222` | SSH listen port |
| `RADIOBEMBA_SSH_HOST` | public origin host | Advertised SSH host |
| `RADIOBEMBA_BASE_DOMAIN` | `bemba.avilalabs.dev` | `{slug}.…` base |
| `RADIOBEMBA_PUBLIC_ORIGIN` | `https://bemba.avilalabs.dev` | URL printer |
| `RADIOBEMBA_AUTH_TOKEN` | unset | If set, SSH password must match |
| `RADIOBEMBA_DATA_DIR` | `./data` | Persistent SSH host key |
| `RADIOBEMBA_PERSISTENCE` | `auto` | `auto` / `postgres` / `memory` |
| `PG*` | — | Postgres when persistence is postgres/auto |

## Deploy

```sh
npm run deploy:radiobemba
```

- HTTP/Caddy: `bemba.avilalabs.dev` + `*.bemba.avilalabs.dev` → host `8040`
  (`proxy.wildcard: true` uses Caddy on-demand TLS + `/v1/tls-ask`)
- SSH: public `2222` → container `2222` (agents connect here)
- Needs Postgres on the `chiwire` network + `PGPASSWORD`
- Optional: `RADIOBEMBA_AUTH_TOKEN` in `.env.deploy.local`
- DNS: wildcard `*.bemba.avilalabs.dev` A/AAAA record to the same host

Path URLs (`/t/{slug}/`) work even without wildcard TLS.
