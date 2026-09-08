# Reja

HTTP/HTTPS forward proxy on the deploy host. Windows and macOS use their
built-in **Network** proxy settings — no extra app. Traffic that honors the
OS proxy leaves from the VPS, so those apps see the VPS public IP.

This is not a VPN. Apps that ignore the system proxy (many games, some
Electron apps, some CLIs) still use your home IP. For the whole computer,
use Paso.

## Deploy

Set a username and password in `.env.deploy.local`:

```sh
REJA_USERNAME=jose
REJA_PASSWORD=choose-a-long-password
```

Optional: lock the proxy to your current public IPs (same idea as Eldenese).
If this is unset, anyone who knows the password can connect.

```sh
REJA_ALLOWED_CIDRS=203.0.113.10/32
```

Then:

```sh
npm run deploy:reja
```

The VPS / cloud firewall must allow **TCP 3128**.

## Windows

1. Settings → Network & internet → Proxy → **Manual proxy setup** → On.
2. Address: the VPS IPv4 (same as Paso / Eldenese, e.g. `198.177.123.162`).
3. Port: `3128`.
4. Save. When Windows or the browser asks, use `REJA_USERNAME` / `REJA_PASSWORD`.

Check in a browser: whatismyip should show the VPS IP.

## macOS

1. System Settings → Network → your active service → Details → **Proxies**.
2. Enable **Web Proxy (HTTP)** and **Secure Web Proxy (HTTPS)**.
3. Server: the VPS IPv4. Port: `3128`.
4. Turn on proxy authentication and enter `REJA_USERNAME` / `REJA_PASSWORD`.
5. Leave SOCKS off (Reja is HTTP CONNECT, not SOCKS). Apply.

Check in a browser: whatismyip should show the VPS IP.

Leave **Bypass proxy settings for these Hosts & Domains** as the macOS
defaults (localhost) unless you need extras.

## Defaults

- Port: `3128/tcp` on the public IPv4
- Auth: HTTP Basic (`REJA_USERNAME` / `REJA_PASSWORD`)
- HTTPS sites use `CONNECT` through the same HTTP proxy
- Optional allowlist: `REJA_ALLOWED_CIDRS` (IPv4 or CIDR, comma-separated)

The password is sent as HTTP Basic to the proxy (not TLS). Use a dedicated
password, and prefer `REJA_ALLOWED_CIDRS` if you can.

## Local Docker smoke test

```sh
docker build -f apps/reja/Dockerfile -t chiwire/reja:latest apps/reja

docker run --rm \
  -p 127.0.0.1:3128:3128 \
  -e REJA_USERNAME=jose \
  -e REJA_PASSWORD=secret \
  chiwire/reja:latest
```

```sh
curl -x http://jose:secret@127.0.0.1:3128 https://ifconfig.me
```
