import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import process from "node:process";

import { isFilterOp, MediaCatalog } from "./catalog.js";
import { serveSpaIndex, tryServeClientAsset } from "./static.js";
import type { FieldFilter } from "./types.js";

const DEFAULT_PORT = 3000;
const DEFAULT_MEDIAS_PATH = "/home/josebiskis/vane/MEDIAS.TXT";

function readPort(): number {
  const configuredPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configuredPort, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }
  return port;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function parseFilters(url: URL): FieldFilter[] {
  const filters: FieldFilter[] = [];
  for (const raw of url.searchParams.getAll("f")) {
    const first = raw.indexOf(":");
    const second = raw.indexOf(":", first + 1);
    if (first <= 0 || second < 0) {
      continue;
    }
    const field = raw.slice(0, first);
    const op = raw.slice(first + 1, second);
    const value = raw.slice(second + 1);
    if (!field || !isFilterOp(op)) {
      continue;
    }
    filters.push({ field, op, value });
  }
  return filters;
}

async function proxyAsset(
  request: IncomingMessage,
  response: ServerResponse,
  sourceUrl: string,
): Promise<void> {
  const headers = new Headers({
    accept: request.headers.accept ?? "*/*",
    referer: "https://www.instagram.com/",
    "user-agent":
      request.headers["user-agent"] ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const range = request.headers.range;
  if (range) {
    headers.set("range", range);
  }

  const upstream = await fetch(sourceUrl, { headers, redirect: "follow" });
  const outHeaders: Record<string, string> = {
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "private, max-age=3600",
  };
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    outHeaders["content-length"] = contentLength;
  }
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) {
    outHeaders["content-range"] = contentRange;
  }
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) {
    outHeaders["accept-ranges"] = acceptRanges;
  }

  response.writeHead(upstream.status, outHeaders);
  if (request.method === "HEAD" || !upstream.body) {
    response.end();
    return;
  }

  const nodeStream = Readable.fromWeb(upstream.body as never);
  nodeStream.on("error", () => {
    if (!response.writableEnded) {
      response.end();
    }
  });
  request.on("close", () => {
    nodeStream.destroy();
  });
  nodeStream.pipe(response);
}

function match(pathname: string, pattern: RegExp): string[] | null {
  const found = pattern.exec(pathname);
  return found ? found.slice(1) : null;
}

const mediasPath = process.env.VANE_MEDIAS_PATH?.trim() || DEFAULT_MEDIAS_PATH;
console.log(`Loading media dump from ${mediasPath}`);
const catalog = new MediaCatalog(mediasPath);
console.log(`Indexed ${catalog.meta.uniquePosts} unique posts (${catalog.meta.dumpRows} dump rows)`);

const port = readPort();
const server = createServer((request, response) => {
  void (async () => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (method === "GET" && pathname === "/health") {
      json(response, 200, {
        ok: true,
        uniquePosts: catalog.meta.uniquePosts,
        dumpRows: catalog.meta.dumpRows,
      });
      return;
    }

    if (method === "GET" && pathname === "/api/meta") {
      json(response, 200, catalog.meta);
      return;
    }

    if (method === "GET" && pathname === "/api/medias") {
      const sort = url.searchParams.get("sort")?.trim() || "taken_at_ts";
      const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
      json(
        response,
        200,
        catalog.query({
          q: url.searchParams.get("q") ?? "",
          filters: parseFilters(url),
          sort,
          dir,
          page: Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
          limit: Number.parseInt(url.searchParams.get("limit") ?? "36", 10) || 36,
        }),
      );
      return;
    }

    const detail = method === "GET" ? match(pathname, /^\/api\/medias\/([^/]+)$/) : null;
    if (detail?.[0]) {
      const payload = catalog.detail(decodeURIComponent(detail[0]));
      if (!payload) {
        json(response, 404, { error: "Media not found" });
        return;
      }
      json(response, 200, payload);
      return;
    }

    const resourceAsset =
      method === "GET" || method === "HEAD"
        ? match(pathname, /^\/api\/asset\/([^/]+)\/resource\/(\d+)\/(thumb|video|image)$/)
        : null;
    if (resourceAsset?.[0] && resourceAsset[1] && resourceAsset[2]) {
      const pk = decodeURIComponent(resourceAsset[0]);
      const index = Number.parseInt(resourceAsset[1], 10);
      const kind = resourceAsset[2] as "thumb" | "video" | "image";
      const sourceUrl = catalog.assetUrl(pk, kind, index);
      if (!sourceUrl) {
        json(response, 404, { error: "Asset not found" });
        return;
      }
      try {
        await proxyAsset(request, response, sourceUrl);
      } catch (error) {
        console.error("Asset proxy failed", error);
        if (!response.headersSent) {
          json(response, 502, { error: "Upstream media unavailable" });
        }
      }
      return;
    }

    const asset =
      method === "GET" || method === "HEAD"
        ? match(pathname, /^\/api\/asset\/([^/]+)\/(thumb|video|image)$/)
        : null;
    if (asset?.[0] && asset[1]) {
      const pk = decodeURIComponent(asset[0]);
      const kind = asset[1] as "thumb" | "video" | "image";
      const sourceUrl = catalog.assetUrl(pk, kind, null);
      if (!sourceUrl) {
        json(response, 404, { error: "Asset not found" });
        return;
      }
      try {
        await proxyAsset(request, response, sourceUrl);
      } catch (error) {
        console.error("Asset proxy failed", error);
        if (!response.headersSent) {
          json(response, 502, { error: "Upstream media unavailable" });
        }
      }
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
  })().catch((error: unknown) => {
    console.error(error);
    if (!response.headersSent) {
      json(response, 500, { error: "Internal error" });
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`vane listening on port ${port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; closing vane`);
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
