import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";
import { filePage, homePage, notFoundPage, textPage } from "./pages.js";
import { ShareStore } from "./store.js";

const DEFAULT_PORT = 3000;
const DEFAULT_DATA_DIR = path.resolve(process.cwd(), "data");
const MAX_JSON_BYTES = 1_000_000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const PURGE_INTERVAL_MS = 5 * 60 * 1000;

function readPort(): number {
  const configuredPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configuredPort, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }

  return port;
}

function readDataDir(): string {
  return process.env.DATA_DIR?.trim() || DEFAULT_DATA_DIR;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function html(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(body);
}

async function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > limit) {
      throw new BodyLimitError(`Body exceeds ${limit} bytes`);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

class BodyLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BodyLimitError";
  }
}

function publicBaseUrl(request: IncomingMessage): string {
  const proto = headerValue(request.headers["x-forwarded-proto"]) ?? "http";
  const host =
    headerValue(request.headers["x-forwarded-host"]) ??
    headerValue(request.headers.host) ??
    "localhost";
  return `${proto}://${host}`;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function matchPath(pathname: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(pathname);
  return match?.[1];
}

const store = new ShareStore(readDataDir());
const port = readPort();

await store.init();

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");
  const { pathname } = url;

  try {
    if (method === "GET" && pathname === "/health") {
      json(response, 200, { ok: true });
      return;
    }

    if (method === "GET" && pathname === "/") {
      html(response, 200, homePage());
      return;
    }

    if (method === "POST" && pathname === "/api/texts") {
      const raw = await readBody(request, MAX_JSON_BYTES);
      const payload = parseJsonObject(raw);
      const content = payload.content;
      if (typeof content !== "string") {
        json(response, 400, { error: "content must be a string" });
        return;
      }

      const share = await store.createText(content);
      json(response, 201, {
        id: share.id,
        expiresAt: share.expiresAt,
        url: `${publicBaseUrl(request)}/t/${share.id}`
      });
      return;
    }

    const textId = matchPath(pathname, /^\/api\/texts\/([^/]+)$/);
    if (textId) {
      if (method === "GET") {
        const share = await store.getText(textId);
        if (!share) {
          json(response, 404, { error: "Not found" });
          return;
        }
        json(response, 200, share);
        return;
      }

      if (method === "PUT") {
        const raw = await readBody(request, MAX_JSON_BYTES);
        const payload = parseJsonObject(raw);
        const content = payload.content;
        if (typeof content !== "string") {
          json(response, 400, { error: "content must be a string" });
          return;
        }

        const share = await store.updateText(textId, content);
        if (!share) {
          json(response, 404, { error: "Not found" });
          return;
        }
        json(response, 200, share);
        return;
      }

      json(response, 405, { error: "Method not allowed" });
      return;
    }

    if (method === "POST" && pathname === "/api/files") {
      const filename = headerValue(request.headers["x-filename"]) ?? "file";
      const contentType =
        headerValue(request.headers["content-type"]) ?? "application/octet-stream";
      const body = await readBody(request, MAX_FILE_BYTES);
      if (body.byteLength === 0) {
        json(response, 400, { error: "empty file" });
        return;
      }

      const meta = await store.createFile(filename, contentType, body);
      json(response, 201, {
        id: meta.id,
        filename: meta.filename,
        size: meta.size,
        contentType: meta.contentType,
        expiresAt: meta.expiresAt,
        url: `${publicBaseUrl(request)}/f/${meta.id}`
      });
      return;
    }

    const fileId = matchPath(pathname, /^\/api\/files\/([^/]+)$/);
    if (fileId) {
      if (method === "GET") {
        const meta = await store.getFileMeta(fileId);
        const blob = meta ? await store.readFileBlob(fileId) : undefined;
        if (!meta || !blob) {
          json(response, 404, { error: "Not found" });
          return;
        }

        response.writeHead(200, {
          "content-type": meta.contentType,
          "content-length": String(meta.size),
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.filename)}`,
          "cache-control": "no-store"
        });
        response.end(blob);
        return;
      }

      if (method === "DELETE") {
        const meta = await store.getFileMeta(fileId);
        if (!meta) {
          json(response, 404, { error: "Not found" });
          return;
        }
        await store.deleteFile(fileId);
        json(response, 200, { ok: true });
        return;
      }

      json(response, 405, { error: "Method not allowed" });
      return;
    }

    const viewTextId = matchPath(pathname, /^\/t\/([^/]+)$/);
    if (method === "GET" && viewTextId) {
      const share = await store.getText(viewTextId);
      if (!share) {
        html(response, 404, notFoundPage());
        return;
      }
      html(response, 200, textPage(share));
      return;
    }

    const viewFileId = matchPath(pathname, /^\/f\/([^/]+)$/);
    if (method === "GET" && viewFileId) {
      const meta = await store.getFileMeta(viewFileId);
      if (!meta) {
        html(response, 404, notFoundPage());
        return;
      }
      html(response, 200, filePage(meta));
      return;
    }

    if (pathname.startsWith("/api/")) {
      json(response, 404, { error: "Not found" });
      return;
    }

    html(response, 404, notFoundPage("Page not found."));
  } catch (error) {
    if (error instanceof BodyLimitError) {
      json(response, 413, { error: error.message });
      return;
    }

    if (error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid JSON" });
      return;
    }

    console.error(error);
    json(response, 500, { error: "Internal server error" });
  }
}

function parseJsonObject(raw: Buffer): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw.toString("utf8") || "{}");
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("Expected JSON object");
  }
  return parsed as Record<string, unknown>;
}

const purgeTimer = setInterval(() => {
  void store.purgeExpired().then((result) => {
    if (result.texts > 0 || result.files > 0) {
      console.log(`purged expired shares: texts=${result.texts} files=${result.files}`);
    }
  });
}, PURGE_INTERVAL_MS);
purgeTimer.unref();

server.listen(port, "0.0.0.0", () => {
  console.log(`contimiti listening on port ${port}`);
  console.log(`data directory: ${store.dataDir}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; closing server`);
  clearInterval(purgeTimer);
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
