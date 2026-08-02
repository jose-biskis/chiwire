import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import type { Duplex } from "node:stream";
import process from "node:process";
import { slugFromHost } from "@chiwire/radiobemba-shared";
import { loadConfig } from "./config.js";
import { getDb, migrate } from "./db.js";
import { loadOrCreateHostKey } from "./host-key.js";
import {
  proxyToForwardPort,
  proxyUpgradeToForwardPort
} from "./http-proxy.js";
import {
  MemoryReservationStore,
  PostgresReservationStore,
  type ReservationStore
} from "./reservations.js";
import { startSshServer } from "./ssh-server.js";
import { TunnelRegistry } from "./tunnel-registry.js";

const config = loadConfig();

function writeJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>
): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body) + "\n");
}

function handleOfflineOrMissing(
  response: ServerResponse,
  slug: string,
  reserved: boolean
): void {
  if (reserved) {
    writeJson(response, 503, {
      error: "Tunnel offline",
      slug,
      kind: "permanent"
    });
    return;
  }

  writeJson(response, 404, { error: "Tunnel not found", slug });
}

async function main(): Promise<void> {
  let reservations: ReservationStore = new MemoryReservationStore();
  let db = null as ReturnType<typeof getDb> | null;

  if (config.usePostgres) {
    db = getDb();
    await migrate(db);
    reservations = new PostgresReservationStore(db);
    console.log("permanent reservations: postgres");
  } else {
    console.log("permanent reservations: memory (set PGHOST or RADIOBEMBA_PERSISTENCE=postgres)");
  }

  const registry = new TunnelRegistry(reservations);
  const hostKey = await loadOrCreateHostKey(config.dataDir);
  const sshServer = startSshServer(config, registry, hostKey);

  async function handlePublicProxy(
    request: IncomingMessage,
    response: ServerResponse,
    slug: string,
    pathWithQuery: string
  ): Promise<void> {
    const live = registry.get(slug);
    if (live) {
      proxyToForwardPort(
        request,
        response,
        live.forwardPort,
        pathWithQuery,
        live.localTls
      );
      return;
    }

    const reserved = await reservations.get(slug);
    handleOfflineOrMissing(response, slug, Boolean(reserved));
  }

  function resolveTunnelTarget(
    request: IncomingMessage
  ): { forwardPort: number; localTls: boolean; pathWithQuery: string } | null {
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "/", `http://${host}`);
    const pathWithQuery = `${url.pathname}${url.search}`;

    const hostSlug = slugFromHost(host, config.baseDomain);
    if (hostSlug) {
      const live = registry.get(hostSlug);
      if (!live) {
        return null;
      }
      return {
        forwardPort: live.forwardPort,
        localTls: live.localTls,
        pathWithQuery
      };
    }

    const pathMatch = url.pathname.match(/^\/t\/([a-z0-9-]+)(\/.*)?$/);
    if (!pathMatch) {
      return null;
    }

    const live = registry.get(pathMatch[1]!);
    if (!live) {
      return null;
    }

    const rest = pathMatch[2] ?? "/";
    return {
      forwardPort: live.forwardPort,
      localTls: live.localTls,
      pathWithQuery: `${rest}${url.search}`
    };
  }

  function handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): void {
    const target = resolveTunnelTarget(request);
    if (!target) {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    proxyUpgradeToForwardPort(
      request,
      socket,
      head,
      target.forwardPort,
      target.pathWithQuery,
      target.localTls
    );
  }

  async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const method = request.method ?? "GET";
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "/", `http://${host}`);

    if (method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        ok: true,
        tunnels: registry.list().length,
        sshPort: config.sshPort,
        persistence: config.usePostgres ? "postgres" : "memory"
      });
      return;
    }

    // Caddy on-demand TLS ask endpoint: 200 = allow cert for this hostname.
    if (method === "GET" && url.pathname === "/v1/tls-ask") {
      const domain = (url.searchParams.get("domain") ?? "").toLowerCase();
      const allowed =
        domain === config.baseDomain ||
        domain === `www.${config.baseDomain}` ||
        slugFromHost(domain, config.baseDomain) !== null;

      response.writeHead(allowed ? 200 : 404, {
        "content-type": "text/plain; charset=utf-8"
      });
      response.end(allowed ? "ok\n" : "deny\n");
      return;
    }

    const hostSlug = slugFromHost(host, config.baseDomain);
    if (hostSlug) {
      await handlePublicProxy(
        request,
        response,
        hostSlug,
        `${url.pathname}${url.search}`
      );
      return;
    }

    const pathMatch = url.pathname.match(/^\/t\/([a-z0-9-]+)(\/.*)?$/);
    if (pathMatch) {
      const slug = pathMatch[1]!;
      const rest = pathMatch[2] ?? "/";
      await handlePublicProxy(request, response, slug, `${rest}${url.search}`);
      return;
    }

    if (method === "GET" && url.pathname === "/") {
      writeJson(response, 200, {
        name: "radiobemba",
        tagline: "la radio bemba del localhost",
        transport: "ssh-reverse",
        baseDomain: config.baseDomain,
        ssh: {
          host: config.sshHost,
          port: config.sshPort
        },
        usage: "bemba http <port>",
        tunnels: registry.list().length
      });
      return;
    }

    if (method === "GET" && url.pathname === "/v1/tunnels") {
      writeJson(response, 200, { tunnels: registry.list() });
      return;
    }

    writeJson(response, 404, { error: "Not found" });
  }

  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      console.error(error);
      if (!response.headersSent) {
        writeJson(response, 500, { error: "Internal server error" });
      }
    });
  });

  server.on("upgrade", (request, socket, head) => {
    try {
      handleUpgrade(request, socket, head);
    } catch (error) {
      console.error(error);
      socket.destroy();
    }
  });

  server.listen(config.port, "0.0.0.0", () => {
    console.log(
      `radiobemba http listening on :${config.port} (base ${config.baseDomain})`
    );
  });

  function shutdown(signal: NodeJS.Signals): void {
    console.log(`received ${signal}; closing server`);
    sshServer.close();
    server.close(async (error) => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
      if (db) {
        await db.destroy();
      }
      process.exit();
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
