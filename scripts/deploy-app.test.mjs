import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildDeployPlan, formatCommand, loadDeploySettings } from "./deploy-app.mjs";

function withFixture(settings, callback) {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "deploy-app-"));
  try {
    const appDir = path.join(repoRoot, "apps/hello-http");
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
