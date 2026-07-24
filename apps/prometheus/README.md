# Prometheus

Deploys Prometheus with node_exporter for host hardware metrics.

Prometheus stays internal on the deploy host. Pair it with `apps/grafana` for
dashboards and `apps/cadvisor` for per-container CPU/memory.

## Deploy

From the repository root:

```sh
npm run deploy:prometheus
```

The default deploy settings bind Prometheus at `127.0.0.1:9090` on the Docker
host and attach it to the `chiwire` Docker network for Grafana.

## Defaults

- Prometheus: container/host port `9090` (`visibility: "internal"`)
- Retention: `15d`
- Host root mounted read-only at `/host` for node_exporter
- Container shares the host PID namespace (`--pid host`)
- Data volume: `chiwire-prometheus-data:/prometheus`

Override non-secret settings in `deploy.json`.

## Local Docker smoke test

```sh
docker build -f apps/prometheus/Dockerfile -t chiwire/prometheus:latest apps/prometheus

docker run --rm \
  --pid host \
  -p 127.0.0.1:9090:9090 \
  -v /:/host:ro,rslave \
  chiwire/prometheus:latest
```

Then check readiness:

```sh
curl http://127.0.0.1:9090/-/ready
```
