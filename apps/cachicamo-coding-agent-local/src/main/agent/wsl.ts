import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import type { AgentSettings, WslStatus } from "../../shared/types.js";

const execFileAsync = promisify(execFile);

const DOCKER_DISTRO = /^docker-desktop/i;

export type WslExecTarget = {
  distro: string | null;
  linuxCwd: string;
};

export function detectInsideWsl(platform = process.platform): boolean {
  if (platform !== "linux") return false;
  try {
    return /microsoft/i.test(readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}

export function normalizeWindowsPath(winPath: string): string {
  return winPath.replace(/\//g, "\\");
}

export function isWslUncPath(winPath: string): boolean {
  const normalized = normalizeWindowsPath(winPath);
  return /^\\\\wsl(?:\$|\.localhost)\\/i.test(normalized);
}

export function inferDistroFromWindowsPath(winPath: string): string | null {
  const match = normalizeWindowsPath(winPath).match(/^\\\\wsl(?:\$|\.localhost)\\([^\\]+)/i);
  return match?.[1] ?? null;
}

export function windowsPathToWslPath(winPath: string): string {
  const trimmed = winPath.trim();
  if (!trimmed) {
    throw new Error("Cannot map an empty path to WSL.");
  }
  if (trimmed.startsWith("/")) {
    return trimmed.replace(/\\/g, "/");
  }

  const normalized = normalizeWindowsPath(trimmed);
  const unc = normalized.match(/^\\\\wsl(?:\$|\.localhost)\\[^\\]+\\?(.*)$/i);
  if (unc) {
    const rest = (unc[1] ?? "").replace(/\\/g, "/");
    return rest ? `/${rest.replace(/^\/+/, "")}` : "/";
  }

  const drive = normalized.match(/^([A-Za-z]):\\(.*)$/);
  if (drive) {
    const letter = drive[1]!.toLowerCase();
    const rest = drive[2]!.replace(/\\/g, "/");
    return rest ? `/mnt/${letter}/${rest}` : `/mnt/${letter}`;
  }

  throw new Error(`Cannot map Windows path to WSL: ${winPath}`);
}

export function posixSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function wslCommandArgs(target: WslExecTarget, command: string): string[] {
  const args: string[] = [];
  if (target.distro?.trim()) {
    args.push("-d", target.distro.trim());
  }
  args.push("--", "bash", "-lc", `cd ${posixSingleQuote(target.linuxCwd)} && ${command}`);
  return args;
}

export function decodeWslText(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }
  if (buffer.length >= 4 && buffer[1] === 0x00 && buffer[3] === 0x00) {
    return buffer.toString("utf16le");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

export function parseWslDistroList(text: string): string[] {
  const names: string[] = [];
  for (const raw of text.replace(/\u0000/g, "").split(/\r?\n/)) {
    const line = raw.replace(/^\*\s*/, "").trim();
    if (!line) continue;
    if (/^windows subsystem for linux/i.test(line)) continue;
    if (/^wsl /i.test(line)) continue;
    if (DOCKER_DISTRO.test(line)) continue;
    names.push(line);
  }
  return names;
}

export function applyWorkspaceWslHints(
  settings: AgentSettings,
  workspacePath: string
): AgentSettings {
  const next: AgentSettings = { ...settings, workspacePath };
  const distro = inferDistroFromWindowsPath(workspacePath);
  if (!distro) return next;
  next.wslEnabled = true;
  next.wslDistro = distro;
  return next;
}

export function resolveWslExecTarget(
  settings: Pick<AgentSettings, "wslEnabled" | "wslDistro" | "workspacePath">,
  platform = process.platform
): WslExecTarget | null {
  if (!settings.wslEnabled || platform !== "win32" || !settings.workspacePath) {
    return null;
  }
  const inferred = inferDistroFromWindowsPath(settings.workspacePath);
  return {
    distro: settings.wslDistro.trim() || inferred,
    linuxCwd: windowsPathToWslPath(settings.workspacePath)
  };
}

export function wslUncCandidates(distro: string | null): string[] {
  const names = distro?.trim() ? [distro.trim()] : [];
  const paths: string[] = [];
  for (const name of names) {
    paths.push(`\\\\wsl.localhost\\${name}`);
    paths.push(`\\\\wsl$\\${name}`);
  }
  paths.push("\\\\wsl.localhost\\", "\\\\wsl$\\");
  return paths;
}

export function firstExistingWslUnc(distro: string | null): string {
  return wslUncCandidates(distro).find((path) => existsSync(path)) ?? "\\\\wsl$\\";
}

function emptyStatus(partial: Partial<WslStatus>): WslStatus {
  return {
    platform: process.platform,
    supported: false,
    available: false,
    insideWsl: detectInsideWsl(),
    distros: [],
    defaultDistro: null,
    linuxWorkspace: null,
    ...partial
  };
}

async function runWslExe(args: string[], timeoutMs = 8_000): Promise<Buffer> {
  const { stdout } = await execFileAsync("wsl.exe", args, {
    timeout: timeoutMs,
    encoding: "buffer",
    windowsHide: true,
    env: { ...process.env, WSL_UTF8: "1" }
  });
  return stdout;
}

export async function probeWsl(
  settings?: Pick<AgentSettings, "wslEnabled" | "wslDistro" | "workspacePath">
): Promise<WslStatus> {
  const linuxWorkspace =
    settings?.workspacePath && process.platform === "win32"
      ? (() => {
          try {
            return windowsPathToWslPath(settings.workspacePath!);
          } catch {
            return null;
          }
        })()
      : settings?.workspacePath ?? null;

  if (process.platform !== "win32") {
    return emptyStatus({
      linuxWorkspace: process.platform === "linux" ? (settings?.workspacePath ?? null) : linuxWorkspace
    });
  }

  try {
    const stdout = await runWslExe(["-l", "-q"]);
    const distros = parseWslDistroList(decodeWslText(stdout));
    return {
      platform: "win32",
      supported: true,
      available: distros.length > 0,
      insideWsl: false,
      distros,
      defaultDistro: distros[0] ?? null,
      linuxWorkspace,
      ...(distros.length === 0 ? { error: "No WSL distros found." } : {})
    };
  } catch (error) {
    const err = error as { stderr?: Buffer; message?: string };
    const detail = err.stderr ? decodeWslText(err.stderr).trim() : "";
    return emptyStatus({
      platform: "win32",
      supported: true,
      linuxWorkspace,
      error: detail || err.message || "wsl.exe is not available."
    });
  }
}

export async function runCommandInWsl(
  target: WslExecTarget,
  command: string,
  options: { timeout: number; maxBuffer: number }
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync("wsl.exe", wslCommandArgs(target, command), {
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
    windowsHide: true,
    env: { ...process.env, WSL_UTF8: "1" }
  });
  return {
    stdout: Buffer.isBuffer(stdout) ? decodeWslText(stdout) : String(stdout),
    stderr: Buffer.isBuffer(stderr) ? decodeWslText(stderr) : String(stderr)
  };
}
