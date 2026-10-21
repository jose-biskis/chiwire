import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { Harbor, HarborStatus } from "./harbor.js";
import { cliLine, profileToArgv, type WatchProfile } from "./profile.js";

export type LogLine = {
  seq: number;
  at: string;
  stream: "stdout" | "stderr" | "desk";
  text: string;
};

export type WatchStatus = {
  running: boolean;
  profileId: string | null;
  profileName: string | null;
  pid: number | null;
  startedAt: string | null;
  cli: string | null;
  gate: HarborStatus;
};

const MAX_LOGS = 2500;

function veleroBin(): string {
  const fromEnv = process.env.VELERO_BIN?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../velero-cli/dist/index.js");
}

function veleroCwd(): string {
  const fromEnv = process.env.VELERO_CWD?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return path.resolve(path.dirname(veleroBin()), "..");
}

export class WatchRunner {
  private child: ChildProcess | null = null;
  private profile: WatchProfile | null = null;
  private startedAt: string | null = null;
  private seq = 0;
  private readonly logs: LogLine[] = [];
  private readonly listeners = new Set<(line: LogLine) => void>();

  constructor(
    private readonly harbor: Harbor,
    private readonly listenPort: number
  ) {}

  onLog(listener: (line: LogLine) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  recent(limit = 400): LogLine[] {
    return this.logs.slice(-Math.max(1, limit));
  }

  status(): WatchStatus {
    return {
      running: this.child !== null && this.child.exitCode === null,
      profileId: this.profile?.id ?? null,
      profileName: this.profile?.name ?? null,
      pid: this.child?.pid ?? null,
      startedAt: this.startedAt,
      cli: this.profile ? cliLine(this.profile) : null,
      gate: this.harbor.status()
    };
  }

  private push(stream: LogLine["stream"], text: string): void {
    const line: LogLine = {
      seq: (this.seq += 1),
      at: new Date().toISOString(),
      stream,
      text
    };
    this.logs.push(line);
    if (this.logs.length > MAX_LOGS) {
      this.logs.splice(0, this.logs.length - MAX_LOGS);
    }
    for (const listener of this.listeners) {
      listener(line);
    }
  }

  async start(profile: WatchProfile): Promise<WatchStatus> {
    if (this.status().running) {
      throw new Error(
        `Watch already running (${this.profile?.name ?? "unknown"}). Stop it first.`
      );
    }

    const gate = this.harbor.status();
    if (gate.requireGate && !this.harbor.expectedToken()) {
      throw new Error("Set VELERO_GATE_TOKEN on the desk API before going live from a VPS.");
    }
    if (gate.requireGate && !gate.connected) {
      throw new Error(
        "Harbor is not connected. Run Velero Harbor on your laptop so Binance sees your home IP."
      );
    }

    const bin = veleroBin();
    const argv = profileToArgv(profile);
    const childEnv = { ...process.env };
    if (gate.connected) {
      childEnv.VELERO_GATE_FETCH = `http://127.0.0.1:${this.listenPort}/internal/binance`;
      delete childEnv.BINANCE_API_KEY;
      delete childEnv.BINANCE_API_SECRET;
      delete childEnv.VELERO_PROXY;
      this.push("desk", "harbor on — Binance leaves from the laptop");
    }
    this.push("desk", `starting ${cliLine(profile)}`);
    const child = spawn(process.execPath, [bin, ...argv], {
      cwd: veleroCwd(),
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.child = child;
    this.profile = profile;
    this.startedAt = new Date().toISOString();

    if (child.stdout) {
      const out = createInterface({ input: child.stdout });
      out.on("line", (text) => {
        this.push("stdout", text);
      });
    }
    if (child.stderr) {
      const err = createInterface({ input: child.stderr });
      err.on("line", (text) => {
        this.push("stderr", text);
      });
    }

    child.on("exit", (code, signal) => {
      this.push(
        "desk",
        `watch stopped  code ${code ?? "n/a"}  signal ${signal ?? "n/a"}`
      );
      this.child = null;
    });

    child.on("error", (error) => {
      this.push("desk", `watch error  ${error.message}`);
      this.child = null;
    });

    return this.status();
  }

  async stop(): Promise<WatchStatus> {
    const child = this.child;
    if (!child || child.exitCode !== null) {
      this.child = null;
      return this.status();
    }

    this.push("desk", "stopping watch (SIGINT)");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }, 4000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill("SIGINT");
    });
    this.child = null;
    return this.status();
  }
}
