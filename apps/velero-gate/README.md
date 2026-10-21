# Velero Harbor

Laptop side of the desk. **Keys and Binance traffic stay on this machine.**
The VPS only runs the watch loop (gold-digger, momentum, tend).

## Run (this laptop)

```sh
npm run build --workspace @chiwire/velero-shared
npm run build --workspace @chiwire/velero-gate
npm run velero-gate
```

Opens http://127.0.0.1:17890

1. Desk API: `https://api.velero.avilalabs.dev` (or `http://localhost:3001` for local API)
2. Harbor token: same `VELERO_GATE_TOKEN` as `.env.deploy.local`
3. Binance API key + secret
4. Make fast

Whitelist **this laptop's public IP** on the Binance key (not the VPS).

Credentials: `~/.config/velero-gate/credentials.json` (Windows:
`%APPDATA%\velero-gate\credentials.json`). Never paste keys into the public
desk page.

## Installer for another laptop

Build a Windows `.exe` and a Linux binary (no Node install on that machine):

```sh
npm run publish:velero-gate
```

That writes `VeleroHarbor-win.exe` and `VeleroHarbor-linux` into
`apps/velero-frontend/client/public/downloads/` and refreshes the desk
download buttons. Redeploy the desk so the files are on
https://velero.avilalabs.dev

On the other laptop: download, double-click (Windows SmartScreen may warn —
Run anyway), set token + keys, leave it running.
