import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { classifyArtifact, collectArtifacts, serializeManifest } from "./publish-installers.mjs";

test("classifies installer filenames", () => {
  assert.deepEqual(classifyArtifact("Cachicamo Coding Agent Local-0.1.0-setup.exe"), {
    platform: "win",
    kind: "nsis",
    label: "Windows installer",
  });
  assert.deepEqual(classifyArtifact("Cachicamo Coding Agent Local-0.1.0-portable.exe"), {
    platform: "win",
    kind: "portable",
    label: "Windows portable",
  });
  assert.deepEqual(classifyArtifact("Cachicamo Coding Agent Local-0.1.0-linux.AppImage"), {
    platform: "linux",
    kind: "appimage",
    label: "Linux AppImage",
  });
  assert.deepEqual(classifyArtifact("Cachicamo Coding Agent Local-0.1.0-linux.deb"), {
    platform: "linux",
    kind: "deb",
    label: "Debian package",
  });
  assert.equal(classifyArtifact("latest.yml"), null);
  assert.equal(classifyArtifact("file.exe.blockmap"), null);
});

test("collects and serializes artifacts without source paths", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cachicamo-publish-"));
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "Cachicamo-0.1.0-linux.AppImage"), "appimage");
    writeFileSync(path.join(dir, "latest-linux.yml"), "skip");
    writeFileSync(path.join(dir, "Cachicamo-0.1.0-setup.exe"), "nsis");

    const artifacts = collectArtifacts(dir, "0.1.0");
    assert.equal(artifacts.length, 2);
    assert.equal(artifacts[0].kind, "nsis");
    assert.equal(artifacts[1].kind, "appimage");
    assert.match(artifacts[0].sha256, /^[a-f0-9]{64}$/);

    const json = JSON.parse(serializeManifest({
      productName: "Cachicamo Coding Agent Local",
      version: "0.1.0",
      publishedAt: "2026-09-08T00:00:00.000Z",
      artifacts,
    }));
    assert.equal(json.artifacts.length, 2);
    assert.equal(json.artifacts[0].sourcePath, undefined);
    assert.equal(json.artifacts[0].url, "/downloads/Cachicamo-0.1.0-setup.exe");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
