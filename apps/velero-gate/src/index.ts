#!/usr/bin/env node
import { exec } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  executeGateJob,
  type GateJob
} from "@chiwire/velero-shared";
import { page } from "./page.js";

type Saved = {
  apiBase: string;
  token: string;
  apiKey: string;
  apiSecret: string;
};

const DEFAULT_API = "https://api.velero.avilalabs.dev";
const DEFAULT_PORT = 17890;

function configPath(): string {
  return path.join(os.homedir(), ".config", "velero-gate", "credentials.json");
}

function loadSaved(): Saved {
  const file = configPath();
  if (!existsSync(file)) {
    return {
      apiBase: process.env.VELERO_GATE_API?.trim() || DEFAULT_API,
      token: process.env.VELERO_GATE_TOKEN?.trim() || "",
      apiKey: process.env.BINANCE_API_KEY?.trim() || "",
      apiSecret: process.env.BINANCE_API_SECRET?.trim() || ""
    };
  }
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<Saved>;
  return {
    apiBase: parsed.apiBase?.trim() || DEFAULT_API,
    token: parsed.token ?? "",
    apiKey: parsed.apiKey ?? "",
    apiSecret: parsed.apiSecret ?? ""
  };
}

function save(next: Saved): void {
  const file = configPath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

function readPort(): number {
  const configured = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configured, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${configured}`);
  }
  return port;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(command);
}

let saved = loadSaved();
let connected = false;
let lastError: string | null = null;
let jobs = 0;
let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function apiUrl(pathname: string): string {
  const base = saved.apiBase.replace(/\/$/, "");
  const url = new URL(pathname, `${base}/`);
  url.searchParams.set("token", saved.token);
  return url.toString();
}

async function handleJob(job: GateJob): Promise<void> {
  jobs += 1;
  const result = await executeGateJob(job, {
    apiKey: saved.apiKey,
    apiSecret: saved.apiSecret
  });
  const response = await fetch(apiUrl("/api/gate/result"), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(result)
  });
  if (!response.ok) {
    lastError = `Result POST ${response.status}`;
  }
}

function disconnect(): void {
  source?.close();
  source = null;
  connected = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function connect(): void {
  disconnect();
  lastError = null;
  if (!saved.token.trim()) {
    lastError = "Harbor token is empty.";
    return;
  }
  const url = apiUrl("/api/gate/jobs");
  const next = new EventSource(url);
  source = next;
  next.addEventListener("job", (event) => {
    const job = JSON.parse((event as MessageEvent).data) as GateJob;
    void handleJob(job).catch((error: unknown) => {
      lastError = error instanceof Error ? error.message : String(error);
    });
  });
  next.onopen = () => {
    connected = true;
    lastError = null;
  };
  next.onerror = () => {
    connected = next.readyState === EventSource.OPEN;
    if (next.readyState === EventSource.CLOSED) {
      lastError = "Desk API unreachable or token rejected.";
      source = null;
      reconnectTimer = setTimeout(connect, 4000);
    }
  };
}

const port = readPort();
const server = createServer((request, response) => {
  void (async () => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");

    if (method === "GET" && url.pathname === "/health") {
      json(response, 200, {
        ok: true,
        connected,
        jobs,
        error: lastError,
        apiBase: saved.apiBase,
        hasKey: Boolean(saved.apiKey),
        hasToken: Boolean(saved.token)
      });
      return;
    }

    if (method === "POST" && url.pathname === "/save") {
      const body = await readJson(request);
      saved = {
        apiBase:
          typeof body.apiBase === "string" && body.apiBase.trim()
            ? body.apiBase.trim().replace(/\/$/, "")
            : saved.apiBase,
        token: typeof body.token === "string" ? body.token.trim() : saved.token,
        apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : saved.apiKey,
        apiSecret:
          typeof body.apiSecret === "string"
            ? body.apiSecret.trim()
            : saved.apiSecret
      };
      save(saved);
      connect();
      json(response, 200, { ok: true, connected, error: lastError });
      return;
    }

    if (method === "GET") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(page(saved, { connected, lastError, jobs }));
      return;
    }

    json(response, 404, { error: "Not found" });
  })().catch((error: unknown) => {
    json(response, 400, {
      error: error instanceof Error ? error.message : String(error)
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`velero harbor  ${url}`);
  console.log(`desk API       ${saved.apiBase}`);
  console.log(`keys file      ${configPath()}`);
  if (saved.token) {
    connect();
  }
  openBrowser(url);
});

process.on("SIGINT", () => {
  disconnect();
  server.close(() => process.exit());
});
process.on("SIGTERM", () => {
  disconnect();
  server.close(() => process.exit());
});
