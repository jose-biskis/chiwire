import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";

import { serveSpaIndex, tryServeClientAsset } from "./static.js";

const DEFAULT_PORT = 3000;
const DEFAULT_API_BASE = "http://localhost:3001";
const MAX_BODY = 1_000_000;

function readPort(): number {
  const configuredPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configuredPort, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }
  return port;
}

function apiBase(): string {
  return (process.env.API_BASE_URL?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
}

async function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > limit) {
      throw new Error(`Body exceeds ${limit} bytes`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function proxyToApi(
  request: IncomingMessage,
  response: ServerResponse,
  targetPath: string,
): Promise<void> {
  const method = request.method ?? "GET";
  const headers = new Headers();
  const contentType = request.headers["content-type"];
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const authorization = request.headers.authorization;
  if (authorization) {
    headers.set("authorization", authorization);
  }
  const garitaAuth = request.headers["x-garita-auth"];
  if (typeof garitaAuth === "string") {
    headers.set("x-garita-auth", garitaAuth);
  }

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await readBody(request, MAX_BODY);
  }

  const targetUrl = `${apiBase()}${targetPath}`;
  try {
    const upstream = await fetch(targetUrl, init);
    const payload = Buffer.from(await upstream.arrayBuffer());
    const upstreamType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    response.writeHead(upstream.status, {
      "content-type": upstreamType,
      "cache-control": "no-store",
    });
    response.end(payload);
  } catch (error) {
    console.error(`API proxy failed for ${targetUrl}`, error);
    response.writeHead(502, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(
      `${JSON.stringify({
        error: "API upstream unavailable",
        target: targetUrl,
        detail: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

const port = readPort();

const server = createServer((request, response) => {
  void (async () => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (method === "GET" && pathname === "/health") {
      json(response, 200, { ok: true, apiBase: apiBase() });
      return;
    }

    if (pathname.startsWith("/api/")) {
      await proxyToApi(request, response, `${pathname}${url.search}`);
      return;
    }

    if (tryServeClientAsset(request, response, pathname)) {
      return;
    }

    if (method === "GET") {
      serveSpaIndex(response);
      return;
    }

    json(response, 404, { error: "Not found" });
  })();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`garita-frontend listening on port ${port}`);
  console.log(`proxying /api → ${apiBase()}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; closing garita-frontend`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
