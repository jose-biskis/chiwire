import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
  type RequestOptions,
  type ServerResponse
} from "node:http";
import { request as httpsRequest } from "node:https";
import type { Duplex } from "node:stream";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding"
]);

function headerString(
  value: string | string[] | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function buildUpstreamHeaders(
  request: IncomingMessage
): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) {
      continue;
    }
    headers[key] = value;
  }

  const originalHost = headerString(request.headers.host);
  if (originalHost) {
    headers.host = originalHost;
    if (!headerString(request.headers["x-forwarded-host"])) {
      headers["x-forwarded-host"] = originalHost;
    }
  }

  if (!headerString(request.headers["x-forwarded-proto"])) {
    headers["x-forwarded-proto"] = "https";
  }

  const remote = request.socket.remoteAddress;
  if (remote) {
    const prior = headerString(request.headers["x-forwarded-for"]);
    headers["x-forwarded-for"] = prior ? `${prior}, ${remote}` : remote;
  }

  return headers;
}

function upstreamRequest(
  localTls: boolean,
  options: RequestOptions,
  callback: (response: IncomingMessage) => void
): ClientRequest {
  if (localTls) {
    return httpsRequest(
      {
        ...options,
        rejectUnauthorized: false
      },
      callback
    );
  }

  return httpRequest(options, callback);
}

/** Stream an HTTP request to a local reverse-forward port. */
export function proxyToForwardPort(
  request: IncomingMessage,
  response: ServerResponse,
  forwardPort: number,
  pathWithQuery: string,
  localTls = false
): void {
  const proxyRequest = upstreamRequest(
    localTls,
    {
      hostname: "127.0.0.1",
      port: forwardPort,
      path: pathWithQuery,
      method: request.method,
      headers: buildUpstreamHeaders(request)
    },
    (proxyResponse) => {
      const responseHeaders = { ...proxyResponse.headers };
      delete responseHeaders["transfer-encoding"];
      response.writeHead(proxyResponse.statusCode ?? 502, responseHeaders);
      proxyResponse.pipe(response);
    }
  );

  proxyRequest.on("error", (error) => {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({ error: "Tunnel upstream failed", detail: error.message }) + "\n"
      );
    } else {
      response.destroy(error);
    }
  });

  request.pipe(proxyRequest);
}

/** Proxy an HTTP Upgrade (WebSocket) to the local reverse-forward port. */
export function proxyUpgradeToForwardPort(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  forwardPort: number,
  pathWithQuery: string,
  localTls = false
): void {
  const headers = buildUpstreamHeaders(request);
  headers.connection = "upgrade";
  if (request.headers.upgrade) {
    headers.upgrade = request.headers.upgrade;
  }

  const proxyRequest = upstreamRequest(localTls, {
    hostname: "127.0.0.1",
    port: forwardPort,
    path: pathWithQuery,
    method: request.method,
    headers
  }, () => {
    // Non-upgrade response — close.
    socket.destroy();
  });

  proxyRequest.on("upgrade", (proxyResponse, proxySocket, proxyHead) => {
    const lines = [
      `HTTP/1.1 ${proxyResponse.statusCode ?? 101} Switching Protocols`
    ];
    for (const [key, value] of Object.entries(proxyResponse.headers)) {
      if (value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          lines.push(`${key}: ${item}`);
        }
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push("", "");
    socket.write(lines.join("\r\n"));
    if (proxyHead.length > 0) {
      socket.write(proxyHead);
    }
    if (head.length > 0) {
      proxySocket.write(head);
    }
    proxySocket.pipe(socket).pipe(proxySocket);
  });

  proxyRequest.on("error", () => {
    socket.destroy();
  });

  proxyRequest.end();
}
