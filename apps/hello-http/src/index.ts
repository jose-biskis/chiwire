import { createServer } from "node:http";
import process from "node:process";

const DEFAULT_PORT = 3000;

function readPort(): number {
  const configuredPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configuredPort, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }

  return port;
}

const port = readPort();

const server = createServer((request, response) => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "GET" && url.pathname === "/") {
    response.writeHead(200, {
      "content-type": "text/plain; charset=utf-8"
    });
    response.end("Hello, world!\n");
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ ok: true }) + "\n");
    return;
  }

  response.writeHead(404, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify({ error: "Not found" }) + "\n");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`hello-http listening on port ${port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; closing server`);
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
