# Paso

IKEv2 / IPsec VPN on the deploy host. Windows and macOS use their built-in
VPN clients — no extra app. Connected devices send traffic through the VPS,
so websites see the VPS public IP.

## Deploy

Set a username and password in `.env.deploy.local`:

```sh
VPN_USERNAME=jose
VPN_PASSWORD=choose-a-long-password
```

Then:

```sh
npm run deploy:paso
```

The VPS / cloud firewall must allow **UDP 500** and **UDP 4500**.

Download the CA certificate once (Windows and Mac must trust it):

```sh
npm run paso:cert
```

That writes `paso-ca.crt` in the repo root.

## Windows

1. Double-click `paso-ca.crt` → Install Certificate → **Local Machine** →
   Place all certificates in **Trusted Root Certification Authorities** → Finish.
2. Settings → Network & internet → VPN → Add VPN:
   - VPN provider: **Windows (built-in)**
   - Connection name: Paso
   - Server name or address: the VPS IPv4 (same as Eldenese, e.g. `198.177.123.162`)
   - VPN type: **IKEv2**
   - Sign-in info: **User name and password**
   - User name / password: `VPN_USERNAME` / `VPN_PASSWORD`
3. Connect. Check with a browser: whatismyip should show the VPS IP.

## macOS

1. Double-click `paso-ca.crt`. Open **Keychain Access**, find **Paso CA** in
   **System** (or login), Get Info → Trust → **Always Trust**.
2. System Settings → Network → VPN → Add VPN Configuration → **IKEv2**:
   - Display name: Paso
   - Server address: the VPS IPv4
   - Remote ID: the **same** VPS IPv4
   - Local ID: leave empty
   - Authentication: **Username**
   - Username / password: `VPN_USERNAME` / `VPN_PASSWORD`
3. Enable **Send All Traffic** if the option is shown. Connect.

## Defaults

- Client pool: `10.10.10.0/24`
- DNS inside the tunnel: Cloudflare `1.1.1.1` and `1.0.0.1`
- Server identity: the published VPS IPv4 (`VPN_PUBLIC_IP` from deploy)
- Ports: `500/udp`, `4500/udp` on the public IPv4
