#!/usr/bin/env node
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const repoRoot = path.resolve(appDir, "../..");
const releaseDir = path.join(appDir, "release");
const bundleFile = path.join(appDir, "dist", "harbor.cjs");

function run(command, args, cwd = appDir) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "build", "--workspace", "@chiwire/velero-shared"], repoRoot);
run("npm", ["run", "build", "--workspace", "@chiwire/velero-gate"], repoRoot);

await build({
  absWorkingDir: appDir,
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: bundleFile,
  logLevel: "info"
});

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

// Node 22 standard-mode pkg on Linux produces a Windows exe that exits
// immediately with code 4 and no stdout. SEA skips that bytecode path.
run(
  "npx",
  [
    "--no-install",
    "pkg",
    bundleFile,
    "--targets",
    "node22-win-x64,node22-linux-x64",
    "--sea",
    "--output",
    path.join(releaseDir, "VeleroHarbor")
  ],
  repoRoot
);

for (const name of readdirSync(releaseDir)) {
  const lower = name.toLowerCase();
  const from = path.join(releaseDir, name);
  if (lower.endsWith(".exe") && name !== "VeleroHarbor-win.exe") {
    renameSync(from, path.join(releaseDir, "VeleroHarbor-win.exe"));
  } else if (
    !lower.endsWith(".exe") &&
    name !== "VeleroHarbor-linux" &&
    (lower.includes("linux") || name === "VeleroHarbor")
  ) {
    renameSync(from, path.join(releaseDir, "VeleroHarbor-linux"));
  }
}

console.log(`Harbor binaries in ${releaseDir}`);
