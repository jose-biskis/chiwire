#!/usr/bin/env node
import { spawnSync } from "node:child_process";

if (process.platform === "win32") {
  process.exit(0);
}

const wine = spawnSync("wine", ["--version"], { encoding: "utf8" });
const wine64 = spawnSync("wine64", ["--version"], { encoding: "utf8" });
const found = [wine, wine64].some((result) => result.status === 0);

if (found) {
  process.exit(0);
}

console.error(`error: electron-builder --win on ${process.platform} needs Wine (spawn wine ENOENT).

This repo is open in WSL. NSIS/portable Windows artifacts require either:

  1. Native Windows (recommended)
     Open the repo under C:\\... in PowerShell / cmd, then:
       npm run build:cachicamo-coding-agent-local:win

  2. Wine in this WSL distro
       sudo dpkg --add-architecture i386
       sudo apt update
       sudo apt install -y wine64 wine32
     then retry:
       npm run build:cachicamo-coding-agent-local:win

To build a Linux AppImage/.deb from here instead:
  npm run build:cachicamo-coding-agent-local:linux
`);
process.exit(1);
