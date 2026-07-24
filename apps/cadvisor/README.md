# cAdvisor

Deploys cAdvisor so Prometheus can scrape **per-container** CPU, memory, and
filesystem metrics. Pair with `apps/prometheus` and `apps/grafana`.

## Deploy

Prometheus should already be on the `chiwire` network. From the repository root:

```sh
npm run deploy:cadvisor
npm run deploy:prometheus
```

Redeploy Prometheus after the first cAdvisor install (or whenever
`prometheus.yml` changes) so it scrapes `cadvisor:8080`.

Then open Grafana (`npm run tunnel:grafana`) and use the **Containers**
dashboard.

## Defaults

- Metrics port: `8080` (`visibility: "internal"`)
- Docker network: `chiwire`
- `--docker_only=true` to focus on Docker containers
- Privileged host mounts for cgroup/Docker introspection

Override non-secret settings in `deploy.json`.
