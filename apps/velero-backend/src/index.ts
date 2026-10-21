import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadVeleroEnv } from "@chiwire/velero-shared/env";
import type { GateJob, GateResult } from "@chiwire/velero-shared";
import { Harbor, loopbackOnly } from "./harbor.js";
import {
  normalizeDraft,
  ProfileStore,
  type WatchProfile
} from "./profile.js";
import { WatchRunner } from "./runner.js";

const DEFAULT_PORT = 3001;
const MAX_BODY = 200_000;

function readPort(): number {
  const configured = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configured, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${configured}`);
  }
  return port;
}

function profilesPath(): string {
  const fromEnv = process.env.VELERO_PROFILES_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../data/profiles.json");
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY) {
      throw new Error("Body too large");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("JSON object required");
  }
  return parsed as Record<string, unknown>;
}

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
loadVeleroEnv([path.resolve(backendRoot, "../../velero-cli/.env")]);
const store = new ProfileStore(profilesPath());
const harbor = new Harbor();
const port = readPort();
const runner = new WatchRunner(harbor, port);
harbor.onDisconnect = () => {
  if (runner.status().running) {
    void runner.stop();
  }
};

const server = createServer((request, response) => {
  void (async () => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type"
      });
      response.end();
      return;
    }

    if (method === "GET" && pathname === "/health") {
      json(response, 200, { ok: true, ...runner.status() });
      return;
    }

    if (method === "GET" && pathname === "/api/gate/jobs") {
      if (!harbor.authorize(request, url)) {
        json(response, 401, { error: "Harbor token rejected." });
        return;
      }
      harbor.attach(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/gate/result") {
      if (!harbor.authorize(request, url)) {
        json(response, 401, { error: "Harbor token rejected." });
        return;
      }
      const body = await readJson(request);
      const result: GateResult = {
        id: typeof body.id === "string" ? body.id : "",
        ok: body.ok === true,
        status: typeof body.status === "number" ? body.status : 0,
        body: typeof body.body === "string" ? body.body : ""
      };
      if (!result.id || !harbor.complete(result)) {
        json(response, 404, { error: "Unknown harbor job." });
        return;
      }
      json(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/internal/binance") {
      if (!loopbackOnly(request)) {
        json(response, 403, { error: "Loopback only." });
        return;
      }
      const body = await readJson(request);
      const job = body as unknown as GateJob;
      if (!job.path || !job.method || !job.baseUrl) {
        json(response, 400, { error: "Invalid Binance job." });
        return;
      }
      const result = await harbor.submit(job);
      json(response, 200, result);
      return;
    }

    if (method === "GET" && pathname === "/api/status") {
      json(response, 200, runner.status());
      return;
    }

    if (method === "GET" && pathname === "/api/profiles") {
      json(response, 200, { profiles: store.load() });
      return;
    }

    if (method === "POST" && pathname === "/api/profiles") {
      const body = await readJson(request);
      const profile = store.upsert(normalizeDraft(body));
      json(response, 201, { profile });
      return;
    }

    const profileMatch = /^\/api\/profiles\/([^/]+)$/.exec(pathname);
    if (profileMatch) {
      const id = decodeURIComponent(profileMatch[1] ?? "");
      if (method === "GET") {
        const profile = store.get(id);
        if (!profile) {
          json(response, 404, { error: "Profile not found" });
          return;
        }
        json(response, 200, { profile });
        return;
      }
      if (method === "PUT") {
        const body = await readJson(request);
        const profile = store.upsert(normalizeDraft({ ...body, id }));
        json(response, 200, { profile });
        return;
      }
      if (method === "DELETE") {
        if (runner.status().profileId === id && runner.status().running) {
          json(response, 409, { error: "Stop the watch before deleting this profile." });
          return;
        }
        const ok = store.remove(id);
        json(response, ok ? 200 : 404, ok ? { ok: true } : { error: "Profile not found" });
        return;
      }
    }

    if (method === "POST" && pathname === "/api/watch/start") {
      const body = await readJson(request);
      const profileId = typeof body.profileId === "string" ? body.profileId : "";
      const profile: WatchProfile | undefined = store.get(profileId);
      if (!profile) {
        json(response, 404, { error: "Profile not found" });
        return;
      }
      const status = await runner.start(profile);
      json(response, 200, { status });
      return;
    }

    if (method === "POST" && pathname === "/api/watch/stop") {
      const status = await runner.stop();
      json(response, 200, { status });
      return;
    }

    if (method === "GET" && pathname === "/api/logs") {
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "400", 10);
      json(response, 200, { lines: runner.recent(Number.isFinite(limit) ? limit : 400) });
      return;
    }

    if (method === "GET" && pathname === "/api/logs/stream") {
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "access-control-allow-origin": "*"
      });
      response.write(":\n\n");
      for (const line of runner.recent(200)) {
        response.write(`data: ${JSON.stringify(line)}\n\n`);
      }
      const unsubscribe = runner.onLog((line) => {
        response.write(`data: ${JSON.stringify(line)}\n\n`);
      });
      const heartbeat = setInterval(() => {
        response.write(":\n\n");
      }, 15000);
      request.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
      return;
    }

    json(response, 404, { error: "Not found" });
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    json(response, 400, { error: message });
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`velero-backend listening on ${port}`);
  console.log(`profiles ${profilesPath()}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; stopping watch`);
  void runner.stop().finally(() => {
    server.close(() => {
      process.exit();
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
