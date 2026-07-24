#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "prometheus" ]]; then
  exec "$@"
fi

: "${PROMETHEUS_RETENTION:=15d}"
: "${PROMETHEUS_LISTEN_ADDRESS:=0.0.0.0:9090}"
: "${NODE_EXPORTER_LISTEN_ADDRESS:=127.0.0.1:9100}"

install -d -m 0755 /prometheus

rootfs_args=()
if [[ -d /host/proc ]]; then
  rootfs_args+=(--path.rootfs=/host)
fi

/usr/local/bin/node_exporter \
  --web.listen-address="${NODE_EXPORTER_LISTEN_ADDRESS}" \
  "${rootfs_args[@]}" &
node_exporter_pid=$!

/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --storage.tsdb.retention.time="${PROMETHEUS_RETENTION}" \
  --web.listen-address="${PROMETHEUS_LISTEN_ADDRESS}" \
  --web.enable-lifecycle &
prometheus_pid=$!

cleanup() {
  if [[ -n "${prometheus_pid:-}" ]]; then
    kill "$prometheus_pid" 2>/dev/null || true
    wait "$prometheus_pid" 2>/dev/null || true
  fi
  if [[ -n "${node_exporter_pid:-}" ]]; then
    kill "$node_exporter_pid" 2>/dev/null || true
    wait "$node_exporter_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT TERM INT

wait -n "$node_exporter_pid" "$prometheus_pid"
exit_code=$?
exit "$exit_code"
