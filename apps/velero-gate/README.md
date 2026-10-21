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

Credentials: `~/.config/velero-gate/credentials.json` (mode 0600). Never paste
keys into the public desk page.
