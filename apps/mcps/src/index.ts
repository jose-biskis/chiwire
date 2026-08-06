import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Knex } from "knex";

import {
  closeRedis,
  connectRedis,
  databaseConfigured,
  getDb,
  migrateMcpsSchema,
  redisConfigured,
  warmConfigCache,
} from "@chiwire/mcps-config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isMcpAuthorized } from "./auth.js";
import { registerTrelloMcp, type TrelloMcpConfig } from "./trello.js";
import {
  listConfiguredWorkspaceIds,
  loadTrelloWorkspaceRegistry,
  type TrelloWorkspaceRegistry,
} from "./workspaces.js";

const DEFAULT_PORT = 3000;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

type McpEndpoint = {
  name: string;
  path: string;
  description: string;
  createServer(request: IncomingMessage, registry: TrelloWorkspaceRegistry): McpServer;
};

let db: Knex | null = null;

function readPort(): number {
  const configuredPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configuredPort, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }

  return port;
}

function corsHeaders(allowedOrigin: string | undefined): Record<string, string> {
  return {
    "access-control-allow-headers":
      "accept, authorization, content-type, mcp-protocol-version, x-mcp-auth, x-trello-api-key, x-trello-token, x-trello-api-base-url",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": allowedOrigin ?? process.env.MCP_ALLOWED_ORIGIN ?? "*",
  };
}

function readHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === undefined || rawValue.trim() === "") {
    return undefined;
  }

  return rawValue;
}

function readTrelloMcpConfig(
  request: IncomingMessage,
  registry: TrelloWorkspaceRegistry,
): TrelloMcpConfig {
  const authRequired = Boolean(registry.authSecret);
  const allowClientCredentials = !authRequired;

  const config: TrelloMcpConfig = {
    registry,
    allowClientCredentials,
  };

  const baseUrl = readHeader(request, "x-trello-api-base-url");
  if (baseUrl !== undefined) {
    config.baseUrl = baseUrl;
  }

  if (allowClientCredentials) {
    const apiKey = readHeader(request, "x-trello-api-key");
    const token = readHeader(request, "x-trello-token");

    if (apiKey !== undefined) {
      config.apiKey = apiKey;
    }

    if (token !== undefined) {
      config.token = token;
    }
  }

  return config;
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  allowedOrigin?: string,
): void {
  response.writeHead(statusCode, {
    ...corsHeaders(allowedOrigin),
    "content-type": JSON_CONTENT_TYPE,
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function createTrelloMcpServer(trelloConfig: TrelloMcpConfig): McpServer {
  const server = new McpServer({
    name: "chiwire-trello-mcp",
    version: "0.3.0",
  });
  const workspaces = listConfiguredWorkspaceIds(trelloConfig.registry);

  server.registerTool(
    "server-info",
    {
      title: "Trello server info",
      description: "Describe this self-hosted Trello MCP server.",
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: [
            "Chiwire Trello MCP is available at `/trello`.",
            "Trello credentials stay on the server (Garita → Postgres → Redis cache).",
            "Callers authenticate with `Authorization: Bearer <MCP_AUTH_SECRET>` when configured.",
            "Pass `workspace` on Trello tools (e.g. `avilalabs`, `valenstonic`).",
            workspaces.length > 0
              ? `Configured workspaces: ${workspaces.join(", ")}.`
              : "No workspaces configured yet.",
          ].join("\n"),
        },
      ],
    }),
  );

  registerTrelloMcp(server, trelloConfig);

  server.registerResource(
    "deployment-guide",
    "chiwire://mcps/deployment-guide",
    {
      title: "Deployment guide",
      description: "How to deploy and extend the self-hosted MCP server workspace.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: [
            "# Chiwire MCPs",
            "",
            "Manage Trello workspaces and MCP auth via Garita (internal).",
            "Config is stored in Postgres schema `mcps` and cached in Redis.",
            "Deploy with `npm run deploy:mcps` after Postgres/Redis are available.",
          ].join("\n"),
        },
      ],
    }),
  );

  return server;
}

const mcpEndpoints: Record<string, McpEndpoint> = {
  trello: {
    name: "trello",
    path: "/trello",
    description: "Trello boards, lists, cards, and comments (multi-workspace).",
    createServer: (request, registry) =>
      createTrelloMcpServer(readTrelloMcpConfig(request, registry)),
  },
};

function listMcpEndpoints(): Array<Omit<McpEndpoint, "createServer">> {
  return Object.values(mcpEndpoints).map(({ name, path, description }) => ({
    name,
    path,
    description,
  }));
}

function readMcpEndpoint(pathname: string): McpEndpoint | undefined {
  const pathSegments = pathname.split("/").filter(Boolean);
  const endpointName = pathSegments[0];

  if (pathSegments.length !== 1 || endpointName === undefined) {
    return undefined;
  }

  return mcpEndpoints[endpointName];
}

async function handleMcpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  endpoint: McpEndpoint,
  registry: TrelloWorkspaceRegistry,
): Promise<void> {
  Object.entries(corsHeaders(registry.allowedOrigin)).forEach(([header, value]) =>
    response.setHeader(header, value),
  );

  const server = endpoint.createServer(request, registry);
  const statelessOptions = {
    sessionIdGenerator: undefined,
  } as unknown as StreamableHTTPServerTransportOptions;
  const transport = new StreamableHTTPServerTransport(statelessOptions);

  response.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport as unknown as Transport);
    await transport.handleRequest(request, response);
  } catch (error) {
    console.error("Error handling MCP request", error);
    if (!response.headersSent) {
      writeJson(
        response,
        500,
        {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        },
        registry.allowedOrigin,
      );
    }
  }
}

async function bootstrap(): Promise<void> {
  const schemasRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schemas");

  if (databaseConfigured()) {
    db = getDb();
    await migrateMcpsSchema(db, schemasRoot);
    if (redisConfigured()) {
      try {
        await connectRedis();
        await warmConfigCache(db);
        console.log("mcps config cache warmed from Postgres into Redis");
      } catch (error) {
        console.warn("mcps Redis warm failed; will fall back to Postgres/env", error);
      }
    }
  } else {
    console.log("mcps database not configured; using environment credentials only");
  }

  const port = readPort();
  const initialRegistry = await loadTrelloWorkspaceRegistry(db);

  const server = createServer((request, response) => {
    void (async () => {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", "http://localhost");
      const registry = await loadTrelloWorkspaceRegistry(db);

      if (method === "OPTIONS") {
        response.writeHead(204, corsHeaders(registry.allowedOrigin));
        response.end();
        return;
      }

      if (method === "GET" && url.pathname === "/") {
        writeJson(
          response,
          200,
          {
            name: "chiwire-mcps",
            description: "Self-hosted Model Context Protocol servers.",
            authRequired: Boolean(registry.authSecret),
            configSource: registry.source,
            workspaces: listConfiguredWorkspaceIds(registry),
            endpoints: {
              health: "/health",
              mcps: listMcpEndpoints(),
            },
          },
          registry.allowedOrigin,
        );
        return;
      }

      if (method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, { ok: true }, registry.allowedOrigin);
        return;
      }

      const endpoint = readMcpEndpoint(url.pathname);

      if (endpoint !== undefined && (method === "GET" || method === "POST")) {
        if (!isMcpAuthorized(request, registry.authSecret)) {
          writeJson(
            response,
            401,
            {
              error: "Unauthorized",
              message:
                "Send Authorization: Bearer <MCP_AUTH_SECRET> or x-mcp-auth: <MCP_AUTH_SECRET>.",
            },
            registry.allowedOrigin,
          );
          return;
        }

        await handleMcpRequest(request, response, endpoint, registry);
        return;
      }

      writeJson(response, 404, { error: "Not found" }, registry.allowedOrigin);
    })();
  });

  server.listen(port, "0.0.0.0", () => {
    const workspaces = listConfiguredWorkspaceIds(initialRegistry);
    console.log(`chiwire-mcps listening on port ${port}`);
    console.log(
      `mcp auth: ${initialRegistry.authSecret ? "required" : "disabled (local)"}`,
    );
    console.log(`config source: ${initialRegistry.source}`);
    console.log(
      `trello workspaces: ${workspaces.length > 0 ? workspaces.join(", ") : "(none configured)"}`,
    );
  });

  function shutdown(signal: NodeJS.Signals): void {
    console.log(`received ${signal}; closing server`);
    server.close((error) => {
      void (async () => {
        if (error) {
          console.error(error);
          process.exitCode = 1;
        }

        await closeRedis().catch(() => undefined);
        if (db) {
          await db.destroy().catch(() => undefined);
        }

        process.exit();
      })();
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

await bootstrap();
