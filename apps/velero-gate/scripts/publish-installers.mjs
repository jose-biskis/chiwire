#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const repoRoot = path.resolve(appDir, "../..");
const releaseDir = path.join(appDir, "release");
const downloadsDir = path.join(
  repoRoot,
  "apps/velero-frontend/client/public/downloads"
);
const manifestPath = path.join(downloadsDir, "manifest.json");
const version = JSON.parse(
  readFileSync(path.join(appDir, "package.json"), "utf8")
).version;

function classify(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".exe")) {
    return { platform: "win", kind: "exe", label: "Windows" };
  }
  if (lower.endsWith("-linux") || lower.endsWith(".appimage")) {
    return { platform: "linux", kind: "bin", label: "Linux" };
  }
  return null;
}

const args = new Set(process.argv.slice(2));
if (args.has("--build") || args.has("--build-bin")) {
  const result = spawnSync(process.execPath, [path.join(here, "build-bin.mjs")], {
    cwd: repoRoot,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mkdirSync(downloadsDir, { recursive: true });
const artifacts = [];
if (existsSync(releaseDir)) {
  for (const name of readdirSync(releaseDir)) {
    const meta = classify(name);
    if (!meta) {
      continue;
    }
    const from = path.join(releaseDir, name);
    if (!statSync(from).isFile()) {
      continue;
    }
    const to = path.join(downloadsDir, name);
    copyFileSync(from, to);
    const buffer = readFileSync(to);
    artifacts.push({
      filename: name,
      label: meta.label,
      platform: meta.platform,
      kind: meta.kind,
      version,
      size: buffer.byteLength,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      url: `/downloads/${encodeURIComponent(name)}`
    });
  }
}

const manifest = {
  productName: "Velero Harbor",
  version,
  publishedAt: new Date().toISOString(),
  artifacts
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifestPath} (${artifacts.length} artifacts)`);
