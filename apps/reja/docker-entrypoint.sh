#!/usr/bin/env sh
set -eu

. /usr/local/lib/reja-lib.sh

reja_seed_allow_list
reja_apply_config

if [ -s "$REJA_ALLOW_LIST" ]; then
  echo "Reja HTTP proxy on :3128 for ${REJA_USERNAME} (allowlist set)"
else
  echo "Reja HTTP proxy on :3128 for ${REJA_USERNAME} (localhost and RFC1918 only until you add IPs)"
fi

exec "$@"
