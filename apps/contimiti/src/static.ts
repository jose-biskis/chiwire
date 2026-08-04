import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CLIENT_DIST = path.resolve(__dirname, "../client-dist");

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

export function spaIndexPath(): string | null {
  const indexPath = path.join(CLIENT_DIST, "index.html");
  return existsSync(indexPath) ? indexPath : null;
}

export function serveSpaIndex(response: ServerResponse): boolean {
  const indexPath = spaIndexPath();
  if (!indexPath) {
    sendJson(response, 503, {
      error: "Client UI not built. Run npm run build --workspace @chiwire/contimiti"
    });
    return false;
  }

  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  createReadStream(indexPath).pipe(response);
  return true;
}

/** Serve a built Vite asset when the path maps to a file under client-dist. */
export function tryServeClientAsset(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string
): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const relative = pathname.replace(/^\/+/, "");
  if (!relative || relative.includes("..")) {
    return false;
  }

  const candidate = path.resolve(CLIENT_DIST, relative);
  if (!candidate.startsWith(CLIENT_DIST) || !existsSync(candidate) || !statSync(candidate).isFile()) {
    return false;
  }

  const ext = path.extname(candidate).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  response.writeHead(200, {
    "content-type": contentType,
    "cache-control": "public, max-age=31536000, immutable"
  });
  if (request.method === "HEAD") {
    response.end();
    return true;
  }
  createReadStream(candidate).pipe(response);
  return true;
}
