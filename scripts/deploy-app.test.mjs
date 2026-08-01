import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildDeployPlan, formatCommand, loadDeploySettings } from "./deploy-app.mjs";

function withFixture(settings, callback, appPath = "apps/hello-http") {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "deploy-app-"));
  try {
    const appDir = path.join(repoRoot, appPath);
    mkdirSync(appDir, { recursive: true });
    mkdirSync(path.join(repoRoot, "scripts"), { recursive: true });
    writeFileSync(path.join(appDir, "Dockerfile"), "FROM scratch\n");
    writeFileSync(path.join(appDir, "deploy.json"), `${JSON.stringify(settings, null, 2)}\n`);
    return callback({ repoRoot, appDir });
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

test("builds a public deploy command from app settings", () => {
  withFixture({
    image: "chiwire/hello-http",
    tag: "latest",
    container: "hello-http",
    build: {
      context: "../..",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 3000,
      visibility: "public",
      hostPort: 8080,
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/hello-http",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
    });

    assert.equal(plan.portBinding, "8080:3000");
    assert.equal(plan.commands.length, 1);
    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--port 8080:3000/);
    assert.match(command, /--env PORT=3000/);
    assert.match(command, /--dockerfile apps\/hello-http\/Dockerfile/);
    assert.match(command, /--context \./);
  });
});

test("domain visibility binds locally and configures reverse proxy", () => {
  withFixture({
    image: "chiwire/hello-http",
    container: "hello-http",
    build: {
      context: "../..",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 3000,
      visibility: "domain",
      hostPort: 3000,
    },
    proxy: {
      type: "caddy",
      domain: "app.example.com",
      skipTls: true,
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/hello-http",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
    });

    assert.equal(plan.portBinding, "127.0.0.1:3000:3000");
    assert.equal(plan.commands.length, 2);
    const proxyCommand = formatCommand(plan.commands[1]);
    assert.match(proxyCommand, /configure-reverse-proxy-ssh\.sh/);
    assert.match(proxyCommand, /--domain app\.example\.com/);
    assert.match(proxyCommand, /--upstream 127\.0\.0\.1:3000/);
    assert.match(proxyCommand, /--skip-tls/);
  });
});

test("proxy.wildcard adds --wildcard for caddy domain deploys", () => {
  withFixture({
    image: "chiwire/radiobemba",
    container: "radiobemba",
    runtime: {
      containerPort: 3000,
      visibility: "domain",
      hostPort: 8040,
    },
    proxy: {
      type: "caddy",
      domain: "bemba.example.com",
      wildcard: true,
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/hello-http",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
    });

    const proxyCommand = formatCommand(plan.commands[1]);
    assert.match(proxyCommand, /--domain bemba\.example\.com/);
    assert.match(proxyCommand, /--wildcard/);
  });
});

test("CLI env entries override matching deploy settings", () => {
  withFixture({
    image: "chiwire/hello-http",
    container: "hello-http",
    runtime: {
      containerPort: 3000,
      env: {
        PORT: 3000,
        API_TOKEN: "default",
        LOG_LEVEL: "info",
      },
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/hello-http",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
      cliOptions: {
        envEntries: [
          "API_TOKEN=secret",
          "EXTRA=true",
        ],
      },
    });

    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--env API_TOKEN=secret/);
    assert.match(command, /--env EXTRA=true/);
    assert.match(command, /--env LOG_LEVEL=info/);
    assert.doesNotMatch(command, /API_TOKEN=default/);
  });
});

test("builds an internal nginx deploy command for AvilaLabs", () => {
  withFixture({
    image: "chiwire/avila-labs",
    tag: "latest",
    container: "avila-labs",
    build: {
      context: "../..",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 80,
      visibility: "internal",
      hostPort: 3000,
      setPortEnv: false,
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/avila-labs",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
    });

    assert.equal(plan.portBinding, "127.0.0.1:3000:80");
    assert.equal(plan.commands.length, 1);
    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--port 127\.0\.0\.1:3000:80/);
    assert.doesNotMatch(command, /--env PORT=80/);
    assert.match(command, /--dockerfile apps\/avila-labs\/Dockerfile/);
  }, "apps/avila-labs");
});

test("builds a Postgres deploy command that exposes PgBouncer", () => {
  withFixture({
    image: "chiwire/postgres-pgbouncer",
    container: "postgres-pgbouncer",
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 6432,
      visibility: "internal",
      hostPort: 5432,
      setPortEnv: false,
      volumes: [
        "chiwire-postgres-data:/var/lib/postgresql/data",
      ],
      env: {
        POSTGRES_DB: "chiwire",
        POSTGRES_USER: "chiwire",
      },
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/postgres",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
      cliOptions: {
        envEntries: [
          "POSTGRES_PASSWORD=secret",
        ],
      },
    });

    assert.equal(plan.portBinding, "127.0.0.1:5432:6432");
    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--dockerfile apps\/postgres\/Dockerfile/);
    assert.match(command, /--port 127\.0\.0\.1:5432:6432/);
    assert.match(command, /--volume chiwire-postgres-data:\/var\/lib\/postgresql\/data/);
    assert.match(command, /--env POSTGRES_PASSWORD=secret/);
    assert.doesNotMatch(command, /--env PORT=6432/);
  }, "apps/postgres");
});

test("builds a Redis cache deploy command with memory settings", () => {
  withFixture({
    image: "chiwire/redis-cache",
    container: "redis-cache",
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 6379,
      visibility: "internal",
      hostPort: 6379,
      setPortEnv: false,
      env: {
        REDIS_MAXMEMORY: "256mb",
        REDIS_MAXMEMORY_POLICY: "allkeys-lru",
      },
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/redis",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
      cliOptions: {
        envEntries: [
          "REDIS_PASSWORD=secret",
        ],
      },
    });

    assert.equal(plan.portBinding, "127.0.0.1:6379:6379");
    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--dockerfile apps\/redis\/Dockerfile/);
    assert.match(command, /--env REDIS_MAXMEMORY=256mb/);
    assert.match(command, /--env REDIS_MAXMEMORY_POLICY=allkeys-lru/);
    assert.match(command, /--env REDIS_PASSWORD=secret/);
    assert.doesNotMatch(command, /--env PORT=6379/);
  }, "apps/redis");
});


test("builds a Prometheus deploy command with host mounts", () => {
  withFixture({
    image: "chiwire/prometheus",
    container: "prometheus",
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 9090,
      visibility: "internal",
      hostPort: 9090,
      setPortEnv: false,
      volumes: [
        "/:/host:ro,rslave",
        "chiwire-prometheus-data:/prometheus",
      ],
      runArgs: [
        "--pid",
        "host",
      ],
      network: "chiwire",
      env: {
        PROMETHEUS_RETENTION: "15d",
      },
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/prometheus",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
    });

    assert.equal(plan.portBinding, "127.0.0.1:9090:9090");
    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--dockerfile apps\/prometheus\/Dockerfile/);
    assert.match(command, /--port 127\.0\.0\.1:9090:9090/);
    assert.match(command, /--volume \/:\/host:ro,rslave/);
    assert.match(command, /--volume chiwire-prometheus-data:\/prometheus/);
    assert.match(command, /--run-arg --pid/);
    assert.match(command, /--run-arg host/);
    assert.match(command, /--network chiwire/);
    assert.match(command, /--env PROMETHEUS_RETENTION=15d/);
    assert.doesNotMatch(command, /--env PORT=9090/);
  }, "apps/prometheus");
});


test("builds a cAdvisor deploy command with privileged host mounts", () => {
  withFixture({
    image: "chiwire/cadvisor",
    container: "cadvisor",
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 8080,
      visibility: "internal",
      hostPort: 8080,
      setPortEnv: false,
      network: "chiwire",
      volumes: [
        "/:/rootfs:ro",
        "/var/run:/var/run:ro",
        "/sys:/sys:ro",
        "/var/lib/docker/:/var/lib/docker:ro",
        "/dev/disk/:/dev/disk:ro",
      ],
      runArgs: [
        "--privileged",
        "--device",
        "/dev/kmsg",
      ],
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/cadvisor",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
    });

    assert.equal(plan.portBinding, "127.0.0.1:8080:8080");
    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--dockerfile apps\/cadvisor\/Dockerfile/);
    assert.match(command, /--network chiwire/);
    assert.match(command, /--volume \/:\/rootfs:ro/);
    assert.match(command, /--volume \/var\/run:\/var\/run:ro/);
    assert.match(command, /--run-arg --privileged/);
    assert.match(command, /--run-arg --device/);
    assert.match(command, /--run-arg \/dev\/kmsg/);
    assert.doesNotMatch(command, /--env PORT=8080/);
  }, "apps/cadvisor");
});

test("builds a Grafana deploy command on the chiwire network", () => {
  withFixture({
    image: "chiwire/grafana",
    container: "grafana",
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 3000,
      visibility: "internal",
      hostPort: 3030,
      setPortEnv: false,
      volumes: [
        "chiwire-grafana-data:/var/lib/grafana",
      ],
      network: "chiwire",
      env: {
        GF_SECURITY_ADMIN_USER: "admin",
      },
      envFrom: [
        "GF_SECURITY_ADMIN_PASSWORD",
      ],
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/grafana",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
      processEnv: {
        GF_SECURITY_ADMIN_PASSWORD: "from-env",
      },
    });

    assert.equal(plan.portBinding, "127.0.0.1:3030:3000");
    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--dockerfile apps\/grafana\/Dockerfile/);
    assert.match(command, /--port 127\.0\.0\.1:3030:3000/);
    assert.match(command, /--volume chiwire-grafana-data:\/var\/lib\/grafana/);
    assert.match(command, /--network chiwire/);
    assert.match(command, /--env GF_SECURITY_ADMIN_USER=admin/);
    assert.match(command, /--env GF_SECURITY_ADMIN_PASSWORD=from-env/);
    assert.doesNotMatch(command, /--env PORT=3000/);
  }, "apps/grafana");
});

test("CLI --env overrides runtime.envFrom values", () => {
  withFixture({
    image: "chiwire/grafana",
    container: "grafana",
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    runtime: {
      containerPort: 3000,
      visibility: "internal",
      hostPort: 3030,
      setPortEnv: false,
      envFrom: [
        "GF_SECURITY_ADMIN_PASSWORD",
      ],
    },
  }, ({ repoRoot }) => {
    const loaded = loadDeploySettings({
      appPath: "apps/grafana",
      cwd: repoRoot,
    });
    const plan = buildDeployPlan({
      ...loaded,
      repoRoot,
      processEnv: {
        GF_SECURITY_ADMIN_PASSWORD: "from-env",
      },
      cliOptions: {
        envEntries: [
          "GF_SECURITY_ADMIN_PASSWORD=from-cli",
        ],
      },
    });

    const command = formatCommand(plan.commands[0]);
    assert.match(command, /--env GF_SECURITY_ADMIN_PASSWORD=from-cli/);
    assert.doesNotMatch(command, /--env GF_SECURITY_ADMIN_PASSWORD=from-env/);
  }, "apps/grafana");
});

test("rejects unknown visibility values", () => {
  assert.throws(
    () => buildDeployPlan({
      repoRoot: "/tmp/repo",
      appDir: "/tmp/repo/apps/example",
      settings: {
        image: "example",
        container: "example",
        runtime: {
          containerPort: 3000,
          visibility: "private",
        },
      },
    }),
    /runtime\.visibility must be one of/,
  );
});
