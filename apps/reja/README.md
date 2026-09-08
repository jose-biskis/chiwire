# Reja

HTTP/HTTPS forward proxy on the deploy host. Windows and macOS use their
built-in **Network** proxy settings — no extra app. Traffic that honors the
OS proxy leaves from the VPS, so those apps see the VPS public IP.

This is not a VPN. Apps that ignore the system proxy (many games, some
Electron apps, some CLIs) still use your home IP. For the whole computer,
use Paso.

## Deploy

Set a username and password in `.env.deploy.local` **before** deploy (without
these the container exits and restart-loops):

```sh
REJA_USERNAME=jose
REJA_PASSWORD=choose-a-long-password
```

Without an allowlist, Reja only accepts localhost and private (RFC1918) IPs.
Set the public IPs of the networks your Windows and Mac use, or add them after
deploy with `npm run reja:allow`.

```sh
# in .env.deploy.local — seed for the first start only
REJA_ALLOWED_CIDRS=203.0.113.10/32
```

Find an IP from the machine that will use Reja:

```sh
curl -4 https://ifconfig.me
```

Then:

```sh
npm run deploy:reja
```

The VPS / cloud firewall must allow **TCP 3128**.

## Update the allowlist without redeploying

`REJA_ALLOWED_CIDRS` is only a seed for the first start. After that the list
lives on the `chiwire-reja-data` volume. Add or replace IPs over SSH; Reja
restarts so tinyproxy loads the new list (a few seconds of downtime):

```sh
npm run reja:allow -- list
npm run reja:allow -- add 108.171.104.41
npm run reja:allow -- rm 108.171.104.41
npm run reja:allow -- set 108.171.104.41 203.0.113.10
```

This does not change a cloud firewall / security group. If port 3128 is locked
to specific IPs there, update that separately.

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
- Always allowed: localhost and RFC1918 (for Docker / Paso)
- Extra allowlist: `REJA_ALLOWED_CIDRS` (IPv4 or CIDR, comma-separated), then
  `npm run reja:allow`

The password is sent as HTTP Basic to the proxy (not TLS). Use a dedicated
password. Cafe / phone-hotspot Wi-Fi will fail until you add that network's
public IP.

## Local Docker smoke test

```sh
docker build -f apps/reja/Dockerfile -t chiwire/reja:latest apps/reja

docker run --rm \
  -p 127.0.0.1:3128:3128 \
  -e REJA_USERNAME=jose \
  -e REJA_PASSWORD=secret \
  -e REJA_ALLOWED_CIDRS=127.0.0.1/32 \
  chiwire/reja:latest
```

```sh
curl -x http://jose:secret@127.0.0.1:3128 https://ifconfig.me
```
