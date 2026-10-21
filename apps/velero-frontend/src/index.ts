import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";
import { serveSpaIndex, tryServeClientAsset } from "./static.js";

const DEFAULT_PORT = 3000;
const DEFAULT_API_BASE = "http://localhost:3001";
const MAX_BODY = 1_000_000;

function readPort(): number {
  const configured = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configured, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${configured}`);
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

function pipeSse(
  request: IncomingMessage,
  response: ServerResponse,
  targetPath: string
): void {
  const target = new URL(targetPath, `${apiBase()}/`);
  const raw = request;
  fetch(target, {
    method: "GET",
    headers: { accept: "text/event-stream" }
  })
    .then(async (up) => {
      response.writeHead(up.status, {
        "content-type": up.headers.get("content-type") || "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      });
      if (!up.body) {
        response.end();
        return;
      }
      const reader = up.body.getReader();
      raw.on("close", () => {
        void reader.cancel();
      });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          response.write(Buffer.from(value));
        }
      }
      response.end();
    })
    .catch((error: unknown) => {
      if (response.headersSent) {
        response.end();
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "SSE upstream unavailable", detail: message }));
    });
}

async function proxyToApi(
  request: IncomingMessage,
  response: ServerResponse,
  targetPath: string
): Promise<void> {
  const method = request.method ?? "GET";
  const headers = new Headers();
  const contentType = request.headers["content-type"];
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await readBody(request, MAX_BODY);
  }
  const targetUrl = `${apiBase()}${targetPath}`;
  try {
    const upstream = await fetch(targetUrl, init);
    const payload = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "content-type":
        upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(payload);
  } catch (error) {
    response.writeHead(502, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(
      JSON.stringify({
        error: "API upstream unavailable",
        target: targetUrl,
        detail: error instanceof Error ? error.message : String(error)
      })
    );
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
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

    if (method === "GET" && pathname === "/api/logs/stream") {
      pipeSse(request, response, `${pathname}${url.search}`);
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
  console.log(`velero-frontend listening on ${port}`);
  console.log(`proxying /api → ${apiBase()}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; closing velero-frontend`);
  server.close(() => {
    process.exit();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
