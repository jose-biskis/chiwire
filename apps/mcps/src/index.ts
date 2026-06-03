import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { registerTrelloMcp, type TrelloMcpConfig } from "./trello.js";

const DEFAULT_PORT = 3000;
const MCP_PATH = "/mcp";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function readPort(): number {
  const configuredPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configuredPort, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }

  return port;
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-headers":
      "accept, authorization, content-type, mcp-protocol-version, x-trello-api-key, x-trello-token, x-trello-api-base-url",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": process.env.MCP_ALLOWED_ORIGIN ?? "*",
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

function readTrelloMcpConfig(request: IncomingMessage): TrelloMcpConfig {
  const config: TrelloMcpConfig = {};
  const apiKey = readHeader(request, "x-trello-api-key");
  const token = readHeader(request, "x-trello-token");
  const baseUrl = readHeader(request, "x-trello-api-base-url");

  if (apiKey !== undefined) {
    config.apiKey = apiKey;
  }

  if (token !== undefined) {
    config.token = token;
  }

  if (baseUrl !== undefined) {
    config.baseUrl = baseUrl;
  }

  return config;
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    "content-type": JSON_CONTENT_TYPE,
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function createMcpServer(trelloConfig: TrelloMcpConfig): McpServer {
  const server = new McpServer({
    name: "chiwire-mcps",
    version: "0.1.0",
  });

  server.registerTool(
    "server-info",
    {
      title: "Server info",
      description: "Describe this self-hosted Chiwire MCP server.",
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: [
            "Chiwire MCPs is a deployable workspace for self-hosted Model Context Protocol servers.",
            "This server includes Trello tools for listing boards, lists, and cards; creating cards; updating cards; and adding comments.",
            "Send x-trello-api-key and x-trello-token headers with MCP requests, or set TRELLO_API_KEY and TRELLO_TOKEN in the server environment before using Trello tools.",
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
            "This workspace exposes MCP servers over Streamable HTTP at `/mcp`.",
            "Use `PORT` to choose the listen port and `MCP_ALLOWED_ORIGIN` to restrict browser clients.",
            "Trello tools accept `x-trello-api-key` and `x-trello-token` request headers, then fall back to `TRELLO_API_KEY` and `TRELLO_TOKEN` environment variables.",
            "Deploy with `npm run deploy:mcps` after configuring your SSH deployment environment.",
          ].join("\n"),
        },
      ],
    }),
  );

  return server;
}

async function handleMcpRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  Object.entries(corsHeaders()).forEach(([header, value]) => response.setHeader(header, value));

  const server = createMcpServer(readTrelloMcpConfig(request));
  // The SDK documents `undefined` as stateless mode, but its published option
  // type is narrower when `exactOptionalPropertyTypes` is enabled.
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
      writeJson(response, 500, {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
}

const port = readPort();

const server = createServer((request, response) => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (method === "GET" && url.pathname === "/") {
    writeJson(response, 200, {
      name: "chiwire-mcps",
      description: "Self-hosted Model Context Protocol servers.",
      endpoints: {
        health: "/health",
        mcp: MCP_PATH,
      },
    });
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    writeJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === MCP_PATH && (method === "GET" || method === "POST")) {
    void handleMcpRequest(request, response);
    return;
  }

  writeJson(response, 404, { error: "Not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`chiwire-mcps listening on port ${port}`);
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
