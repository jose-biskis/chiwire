#!/usr/bin/env sh
set -eu

data_dir="/var/lib/paso"
username="${VPN_USERNAME:-}"
password="${VPN_PASSWORD:-}"
public_ip="${VPN_PUBLIC_IP:-}"
client_net="${VPN_CLIENT_NET:-10.10.10.0/24}"
dns_servers="${VPN_DNS:-1.1.1.1,1.0.0.1}"

if [ -z "$username" ] || [ -z "$password" ]; then
  echo "error: VPN_USERNAME and VPN_PASSWORD are required" >&2
  exit 1
fi

if [ -z "$public_ip" ]; then
  echo "error: VPN_PUBLIC_IP is required (deploy sets this from the VPS IPv4)" >&2
  exit 1
fi

mkdir -p "$data_dir" \
  /etc/ipsec.d/cacerts \
  /etc/ipsec.d/certs \
  /etc/ipsec.d/private

if [ ! -f "$data_dir/ca.crt" ] || [ ! -f "$data_dir/ca.key" ]; then
  openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
    -subj "/CN=Paso CA" \
    -keyout "$data_dir/ca.key" \
    -out "$data_dir/ca.crt"
fi

if [ ! -f "$data_dir/server.crt" ] || [ ! -f "$data_dir/server.key" ] \
  || [ "$(cat "$data_dir/server.ip" 2>/dev/null || true)" != "$public_ip" ]; then
  openssl req -newkey rsa:2048 -nodes \
    -subj "/CN=${public_ip}" \
    -keyout "$data_dir/server.key" \
    -out "$data_dir/server.csr"
  cat >"$data_dir/server.ext" <<EOF
subjectAltName=IP:${public_ip}
extendedKeyUsage=serverAuth
EOF
  openssl x509 -req -sha256 -days 825 \
    -in "$data_dir/server.csr" \
    -CA "$data_dir/ca.crt" \
    -CAkey "$data_dir/ca.key" \
    -CAcreateserial \
    -out "$data_dir/server.crt" \
    -extfile "$data_dir/server.ext"
  printf '%s\n' "$public_ip" >"$data_dir/server.ip"
  rm -f "$data_dir/server.csr"
fi

cp "$data_dir/ca.crt" /etc/ipsec.d/cacerts/ca.crt
cp "$data_dir/server.crt" /etc/ipsec.d/certs/server.crt
cp "$data_dir/server.key" /etc/ipsec.d/private/server.key
chmod 600 /etc/ipsec.d/private/server.key "$data_dir/ca.key" "$data_dir/server.key"

escaped_password=$(printf '%s' "$password" | sed 's/["\\]/\\&/g')

cat >/etc/ipsec.conf <<EOF
config setup
  uniqueids=never
  charondebug="ike 1, knl 1, cfg 1"

conn ikev2
  auto=add
  keyexchange=ikev2
  ike=aes256-sha256-modp2048,aes256-sha1-modp2048,aes128-sha256-modp2048!
  esp=aes256-sha256,aes256-sha1,aes128-sha256!
  fragmentation=yes
  forceencaps=yes
  dpdaction=clear
  dpddelay=30s
  rekey=no
  left=%any
  leftid=${public_ip}
  leftcert=server.crt
  leftsendcert=always
  leftsubnet=0.0.0.0/0
  right=%any
  rightid=%any
  rightauth=eap-mschapv2
  rightsourceip=${client_net}
  rightdns=${dns_servers}
  eap_identity=%identity
EOF

cat >/etc/ipsec.secrets <<EOF
: RSA server.key
${username} : EAP "${escaped_password}"
EOF
chmod 600 /etc/ipsec.secrets

# ip_forward is set via docker --sysctl; /proc is read-only for sysctl -w here.

iptables -C FORWARD -s "$client_net" -j ACCEPT 2>/dev/null \
  || iptables -A FORWARD -s "$client_net" -j ACCEPT
iptables -C FORWARD -d "$client_net" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null \
  || iptables -A FORWARD -d "$client_net" -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -t nat -C POSTROUTING -s "$client_net" -j MASQUERADE 2>/dev/null \
  || iptables -t nat -A POSTROUTING -s "$client_net" -j MASQUERADE

echo "Paso IKEv2 listening for ${username} at ${public_ip} (UDP 500/4500)"

exec "$@"
