#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const WEBSITE_DIR = path.resolve(path.dirname(SCRIPT_PATH), "..");
const REPO_ROOT = path.resolve(WEBSITE_DIR, "../..");
const LOCAL_APP_DIR = path.join(REPO_ROOT, "apps/cachicamo-coding-agent-local");
const RELEASE_DIR = path.join(LOCAL_APP_DIR, "release");
const DOWNLOADS_DIR = path.join(WEBSITE_DIR, "public/downloads");
const MANIFEST_PATH = path.join(DOWNLOADS_DIR, "manifest.json");

const BUILD_SCRIPTS = {
  win: "build:win",
  linux: "build:linux",
};

function usage() {
  return `Publish Cachicamo installer artifacts to the download site.

Usage:
  node apps/cachicamo-coding-agent-website/scripts/publish-installers.mjs [options]

Options:
  --build              Build installers before copying (current OS unless --win/--linux)
  --win                With --build, run the Windows electron-builder target
  --linux              With --build, run the Linux electron-builder target
  --release-dir PATH   Source directory (default: apps/cachicamo-coding-agent-local/release)
  --downloads-dir PATH Destination directory (default: public/downloads)
  --deploy             Deploy the website after publishing
  --dry-run            Print the manifest without writing files
  -h, --help           Show this help
`;
}

function fail(message) {
  throw new Error(message);
}

/**
 * @param {string} filename
 * @returns {{ platform: string, kind: string, label: string } | null}
 */
export function classifyArtifact(filename) {
  const lower = filename.toLowerCase();
  if (
    lower.endsWith(".blockmap") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".7z") ||
    lower.endsWith(".asar")
  ) {
    return null;
  }

  if (lower.includes("setup") && lower.endsWith(".exe")) {
    return { platform: "win", kind: "nsis", label: "Windows installer" };
  }
  if (lower.includes("portable") && lower.endsWith(".exe")) {
    return { platform: "win", kind: "portable", label: "Windows portable" };
  }
  if (lower.endsWith(".exe")) {
    return { platform: "win", kind: "exe", label: "Windows executable" };
  }
  if (lower.endsWith(".appimage")) {
    return { platform: "linux", kind: "appimage", label: "Linux AppImage" };
  }
  if (lower.endsWith(".deb")) {
    return { platform: "linux", kind: "deb", label: "Debian package" };
  }
  if (lower.endsWith(".rpm")) {
    return { platform: "linux", kind: "rpm", label: "RPM package" };
  }
  if (lower.endsWith(".dmg")) {
    return { platform: "mac", kind: "dmg", label: "macOS disk image" };
  }
  if (lower.endsWith(".pkg")) {
    return { platform: "mac", kind: "pkg", label: "macOS package" };
  }

  return null;
}

/**
 * @param {string} filePath
 */
export function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

/**
 * @param {string} releaseDir
 * @param {string} version
 */
export function collectArtifacts(releaseDir, version) {
  if (!existsSync(releaseDir)) {
    return [];
  }

  const entries = readdirSync(releaseDir, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const classified = classifyArtifact(entry.name);
    if (!classified) {
      continue;
    }

    const sourcePath = path.join(releaseDir, entry.name);
    const size = statSync(sourcePath).size;
    artifacts.push({
      filename: entry.name,
      label: classified.label,
      platform: classified.platform,
      kind: classified.kind,
      version,
      size,
      sha256: sha256File(sourcePath),
      url: `/downloads/${encodeURIComponent(entry.name)}`,
      sourcePath,
    });
  }

  artifacts.sort((a, b) => {
    const platformOrder = { win: 0, linux: 1, mac: 2 };
    const kindOrder = { nsis: 0, portable: 1, exe: 2, appimage: 3, deb: 4, rpm: 5, dmg: 6, pkg: 7 };
    return (
      (platformOrder[a.platform] ?? 9) - (platformOrder[b.platform] ?? 9) ||
      (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
      a.filename.localeCompare(b.filename)
    );
  });

  return artifacts;
}

/**
 * @param {{
 *   productName: string,
 *   version: string,
 *   publishedAt: string,
 *   artifacts: Array<Record<string, unknown>>,
 * }} manifest
 */
export function serializeManifest(manifest) {
  const artifacts = manifest.artifacts.map(({ sourcePath, ...artifact }) => artifact);
  return `${JSON.stringify({ ...manifest, artifacts }, null, 2)}\n`;
}

function currentBuildTarget() {
  if (process.platform === "win32") {
    return "win";
  }
  return "linux";
}

function parseArgs(argv) {
  const options = {
    build: false,
    targets: [],
    releaseDir: RELEASE_DIR,
    downloadsDir: DOWNLOADS_DIR,
    deploy: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--build":
        options.build = true;
        break;
      case "--win":
        options.targets.push("win");
        break;
      case "--linux":
        options.targets.push("linux");
        break;
      case "--release-dir":
        options.releaseDir = path.resolve(argv[index + 1] ?? "");
        index += 1;
        break;
      case "--downloads-dir":
        options.downloadsDir = path.resolve(argv[index + 1] ?? "");
        index += 1;
        break;
      case "--deploy":
        options.deploy = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        fail(`unknown option: ${arg}`);
    }
  }

  if (options.build && options.targets.length === 0) {
    options.targets.push(currentBuildTarget());
  }

  return options;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed with exit ${result.status ?? "unknown"}`);
  }
}

function readLocalVersion() {
  const packageJson = JSON.parse(
    readFileSync(path.join(LOCAL_APP_DIR, "package.json"), "utf8"),
  );
  return {
    productName: "Cachicamo Coding Agent Local",
    version: packageJson.version,
  };
}

export function publishInstallers(options) {
  const { productName, version } = readLocalVersion();

  if (options.build) {
    for (const target of options.targets) {
      const script = BUILD_SCRIPTS[target];
      if (!script) {
        fail(`unsupported build target: ${target}`);
      }
      if (target === "win" && process.platform !== "win32") {
        console.warn(
          "warning: Windows installers should be built on native Windows; Linux/WSL often needs Wine.",
        );
      }
      console.log(`Building ${target} installer (${script})…`);
      run("npm", ["run", script], LOCAL_APP_DIR);
    }
  }

  const collected = collectArtifacts(options.releaseDir, version);
  if (collected.length === 0) {
    fail(
      `no installer artifacts found in ${options.releaseDir}. Build first with --build, or npm run build:linux / build:win in cachicamo-coding-agent-local.`,
    );
  }

  const manifest = {
    productName,
    version,
    publishedAt: new Date().toISOString(),
    artifacts: collected,
  };

  if (options.dryRun) {
    process.stdout.write(serializeManifest(manifest));
    return manifest;
  }

  mkdirSync(options.downloadsDir, { recursive: true });

  const keep = new Set(["manifest.json"]);
  for (const artifact of collected) {
    const destination = path.join(options.downloadsDir, artifact.filename);
    copyFileSync(artifact.sourcePath, destination);
    keep.add(artifact.filename);
    console.log(`copied ${artifact.filename} (${artifact.size} bytes)`);
  }

  for (const entry of readdirSync(options.downloadsDir, { withFileTypes: true })) {
    if (!entry.isFile() || keep.has(entry.name)) {
      continue;
    }
    if (classifyArtifact(entry.name)) {
      unlinkSync(path.join(options.downloadsDir, entry.name));
      console.log(`removed stale ${entry.name}`);
    }
  }

  writeFileSync(path.join(options.downloadsDir, "manifest.json"), serializeManifest(manifest));
  console.log(`wrote ${path.relative(REPO_ROOT, MANIFEST_PATH)} (${collected.length} artifact(s))`);

  if (options.deploy) {
    const deployScript = path.join(REPO_ROOT, "scripts/deploy-app.sh");
    run(deployScript, [path.join(REPO_ROOT, "apps/cachicamo-coding-agent-website")], REPO_ROOT);
  }

  return manifest;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  publishInstallers(options);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    process.exitCode = 1;
  }
}
