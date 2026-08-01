# Bemba CLI

CLI for [Radiobemba](../radiobemba/README.md). Opens an SSH reverse tunnel and
registers a temp or permanent subdomain.

## Usage

```sh
npm run build --workspace @chiwire/radiobemba-shared
npm run build --workspace @chiwire/bemba

npm run bemba -- http 3000
npm run bemba -- http 5173 --subdomain demo
npm run bemba -- http 3000 --permanent --subdomain myapp --token secret
npm run bemba -- http 3000 --server https://bemba.avilalabs.dev --ssh-port 2222
```

## Options

| Flag / env | Purpose |
|------------|---------|
| `--server` / `BEMBA_SERVER` | HTTP origin (defaults + URL context) |
| `--ssh-host` / `BEMBA_SSH_HOST` | SSH host (default: host from `--server`) |
| `--ssh-port` / `BEMBA_SSH_PORT` | SSH port (default `2222`) |
| `--token` / `BEMBA_TOKEN` | SSH password / permanent owner token |
| `--subdomain` | Requested slug |
| `--permanent` | Durable reservation (needs subdomain + token) |
