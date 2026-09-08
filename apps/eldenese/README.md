# Eldenese

DNS forwarder for the deploy host. Windows and Mac can use the VPS as their
DNS server. That sends **name lookups** through the VPS, not your web traffic.

If you want the whole connection through the VPS, use WireGuard (not in this
app yet) or the existing SOCKS tunnel: `npm run tunnel:socks`.

## Deploy

Set the public IPs of the networks your Windows and Mac use. Without this,
Eldenese refuses queries from the internet (it is not an open resolver).

```sh
# in .env.deploy.local — your current public IP, or several CIDRs
ELDENESE_ALLOWED_CIDRS=203.0.113.10/32,198.51.100.0/24
```

Find an IP from the machine that will query Eldenese:

```sh
curl -4 https://ifconfig.me
```

Then deploy:

```sh
npm run deploy:eldenese
```

The VPS firewall / security group must allow UDP and TCP 53 from those same
IPs. Some providers block inbound 53.

Eldenese binds the host's public IPv4 on port 53, not `0.0.0.0`. Ubuntu's
`systemd-resolved` already owns `127.0.0.53:53`, so publishing every interface
fails with "address already in use". Override the detected address with
`ELDENESE_BIND_ADDRESS` or `--bind-address` if needed.

## Windows

1. Settings → Network & internet → your active adapter → DNS server assignment → Edit.
2. Manual, IPv4 preferred DNS = the VPS public IP.
3. Save. Check with `nslookup example.com` — Server should be the VPS.

## macOS

1. System Settings → Network → your active service → Details → DNS.
2. Add the VPS public IP. Remove other servers if you want only Eldenese.
3. Apply. Check with `dig example.com` — the SERVER line should be the VPS.

Cafe / phone-hotspot Wi-Fi will fail until you add that network's public IP
(`npm run eldenese:allow -- add …`) or switch to a VPN later.

## Update the allowlist without redeploying

`ELDENESE_ALLOWED_CIDRS` is only a seed for the first start. After that the
list lives on the `chiwire-eldenese-data` volume. Add or replace IPs over SSH
and Unbound reloads in place:

```sh
npm run eldenese:allow -- list
npm run eldenese:allow -- add 108.171.104.41
npm run eldenese:allow -- rm 108.171.104.41
npm run eldenese:allow -- set 108.171.104.41 203.0.113.10
```

This does not change a cloud firewall / security group. If port 53 is locked
to specific IPs there, update that separately.

## Defaults

- Upstream: Cloudflare `1.1.1.1` and `1.0.0.1`
- Always allowed: localhost and RFC1918 (for Docker / a future VPN)
- Extra allowlist: `ELDENESE_ALLOWED_CIDRS` (IPv4 or CIDR, comma-separated)
- Ports: `53/tcp` and `53/udp`, `visibility: "public"`

## Local Docker smoke test

```sh
docker build -f apps/eldenese/Dockerfile -t chiwire/eldenese:latest apps/eldenese

docker run --rm \
  -p 127.0.0.1:5353:53/tcp \
  -p 127.0.0.1:5353:53/udp \
  -e ELDENESE_ALLOWED_CIDRS=127.0.0.1/32 \
  chiwire/eldenese:latest
```

```sh
dig @127.0.0.1 -p 5353 example.com
```
