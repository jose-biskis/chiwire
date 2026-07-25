import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "ollama";
import type { McpServerConfig } from "../../shared/types.js";

export type McpRuntimeTool = {
  ollamaName: string;
  serverId: string;
  serverName: string;
  toolName: string;
  description: string;
  client: Client;
};

export type McpSession = {
  tools: McpRuntimeTool[];
  ollamaTools: Tool[];
  close: () => Promise<void>;
};

function sanitize(part: string): string {
  return part.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
}

function toOllamaTool(runtime: McpRuntimeTool, inputSchema: unknown): Tool {
  const schema =
    inputSchema && typeof inputSchema === "object"
      ? (inputSchema as Record<string, unknown>)
      : { type: "object", properties: {} };

  return {
    type: "function",
    function: {
      name: runtime.ollamaName,
      description: `[MCP:${runtime.serverName}] ${runtime.description}`,
      parameters: schema
    }
  };
}

export async function openMcpSession(servers: McpServerConfig[]): Promise<McpSession> {
  const clients: Client[] = [];
  const tools: McpRuntimeTool[] = [];
  const ollamaTools: Tool[] = [];

  for (const server of servers.filter((s) => s.enabled && s.url.trim())) {
    try {
      const headers: Record<string, string> = { ...(server.headers ?? {}) };
      if (server.bearerToken?.trim()) {
        headers.Authorization = `Bearer ${server.bearerToken.trim()}`;
      }

      const transport =
        Object.keys(headers).length > 0
          ? new StreamableHTTPClientTransport(new URL(server.url), {
              requestInit: { headers }
            })
          : new StreamableHTTPClientTransport(new URL(server.url));
      const client = new Client({ name: "cachicamo-coding-agent-local", version: "0.1.0" });
      await client.connect(transport as Parameters<Client["connect"]>[0]);
      clients.push(client);

      const listed = await client.listTools();
      for (const tool of listed.tools) {
        const ollamaName = `mcp__${sanitize(server.name)}__${sanitize(tool.name)}`;
        const runtime: McpRuntimeTool = {
          ollamaName,
          serverId: server.id,
          serverName: server.name,
          toolName: tool.name,
          description: tool.description ?? tool.name,
          client
        };
        tools.push(runtime);
        ollamaTools.push(toOllamaTool(runtime, tool.inputSchema));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[cachicamo] MCP connect failed for ${server.name}: ${message}`);
    }
  }

  return {
    tools,
    ollamaTools,
    close: async () => {
      await Promise.all(
        clients.map(async (client) => {
          try {
            await client.close();
          } catch {
            // ignore
          }
        })
      );
    }
  };
}

export async function callMcpTool(
  session: McpSession,
  ollamaName: string,
  args: Record<string, unknown>
): Promise<string> {
  const runtime = session.tools.find((t) => t.ollamaName === ollamaName);
  if (!runtime) {
    throw new Error(`Unknown MCP tool: ${ollamaName}`);
  }
  const result = await runtime.client.callTool({
    name: runtime.toolName,
    arguments: args
  });
  const content = result.content;
  if (!Array.isArray(content)) {
    return JSON.stringify(result);
  }
  const text = content
    .map((part) => {
      if (part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part) {
        return String(part.text);
      }
      return JSON.stringify(part);
    })
    .join("\n")
    .trim();
  if (result.isError) {
    throw new Error(text || "MCP tool returned an error");
  }
  return text || "(empty MCP result)";
}
