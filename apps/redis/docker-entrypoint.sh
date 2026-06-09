#!/usr/bin/env sh
set -eu

config_path="/tmp/redis-cache.conf"
cp /usr/local/etc/redis/redis.conf "$config_path"

sed -i "s/^maxmemory .*/maxmemory ${REDIS_MAXMEMORY:-256mb}/" "$config_path"
sed -i "s/^maxmemory-policy .*/maxmemory-policy ${REDIS_MAXMEMORY_POLICY:-allkeys-lru}/" "$config_path"

if [ -n "${REDIS_PASSWORD:-}" ]; then
  printf '\nrequirepass %s\n' "$REDIS_PASSWORD" >> "$config_path"
fi

exec "$@"
