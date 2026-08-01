import {
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse
} from "node:http";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host"
]);

/** Stream an HTTP request to a local reverse-forward port. */
export function proxyToForwardPort(
  request: IncomingMessage,
  response: ServerResponse,
  forwardPort: number,
  pathWithQuery: string
): void {
  const headers: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) {
      continue;
    }
    headers[key] = value;
  }

  headers.host = `127.0.0.1:${forwardPort}`;

  const proxyRequest = httpRequest(
    {
      hostname: "127.0.0.1",
      port: forwardPort,
      path: pathWithQuery,
      method: request.method,
      headers
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
