import process from "node:process";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  listConfiguredWorkspaceIds,
  type TrelloWorkspaceRegistry,
} from "./workspaces.js";

const DEFAULT_TRELLO_API_BASE_URL = "https://api.trello.com/1";

const trelloIdSchema = z.string().min(1, "Trello id is required");
const cardPositionSchema = z.union([z.enum(["top", "bottom"]), z.number()]);

type TrelloQueryValue = boolean | number | string | undefined;

type TrelloRequestOptions = {
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, TrelloQueryValue>;
};

export type TrelloMcpConfig = {
  apiKey?: string;
  token?: string;
  baseUrl?: string;
  /** When true, request-scoped apiKey/token headers may be used (local/dev only). */
  allowClientCredentials?: boolean;
  registry: TrelloWorkspaceRegistry;
};

class TrelloApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "TrelloApiError";
  }
}

function firstConfiguredValue(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== "");
}

function workspaceInputSchema(registry: TrelloWorkspaceRegistry) {
  const available = listConfiguredWorkspaceIds(registry);

  if (available.length === 0) {
    return z
      .string()
      .min(1)
      .optional()
      .describe(
        "Optional when using local header/env credentials; configure workspaces in Garita or via TRELLO_* env vars.",
      );
  }

  const description = `Trello workspace id. Available: ${available.join(", ")}.`;

  // Only auto-default when a single workspace exists — never a global setting.
  if (registry.soleWorkspaceId) {
    return z
      .string()
      .min(1)
      .default(registry.soleWorkspaceId)
      .describe(description);
  }

  return z.string().min(1, "workspace is required").describe(description);
}

function readTrelloCredentials(
  config: TrelloMcpConfig,
  workspace: string | undefined,
): { apiKey: string; token: string; baseUrl: string; workspaceId: string | undefined } {
  const baseUrl =
    firstConfiguredValue(config.baseUrl, process.env.TRELLO_API_BASE_URL) ??
    DEFAULT_TRELLO_API_BASE_URL;
  const registry = config.registry;

  if (config.allowClientCredentials) {
    const apiKey = firstConfiguredValue(config.apiKey, process.env.TRELLO_API_KEY);
    const token = firstConfiguredValue(config.token, process.env.TRELLO_TOKEN);
    if (apiKey && token && registry.workspaces.size === 0) {
      return { apiKey, token, baseUrl, workspaceId: undefined };
    }
  }

  if (registry.workspaces.size === 0) {
    throw new Error(
      "No Trello workspaces configured. Add them in Garita, or set TRELLO_<WS>_API_KEY and TRELLO_<WS>_TOKEN.",
    );
  }

  const workspaceId = (workspace ?? registry.soleWorkspaceId)?.toLowerCase().replace(/_/g, "-");
  if (!workspaceId) {
    throw new Error(
      `Provide a workspace id. Available: ${listConfiguredWorkspaceIds(registry).join(", ")}.`,
    );
  }

  const entry = registry.workspaces.get(workspaceId);
  if (!entry) {
    throw new Error(
      `Unknown workspace "${workspaceId}". Available: ${listConfiguredWorkspaceIds(registry).join(", ")}.`,
    );
  }

  if (!entry.apiKey) {
    throw new Error(`Workspace "${workspaceId}" is missing an API key.`);
  }

  return {
    apiKey: entry.apiKey,
    token: entry.token,
    baseUrl,
    workspaceId,
  };
}

function trelloUrl(baseUrl: string, path: string, query: Record<string, TrelloQueryValue>): URL {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function trelloRequest(
  config: TrelloMcpConfig,
  path: string,
  options: TrelloRequestOptions & { workspace?: string | undefined } = {},
): Promise<unknown> {
  const { apiKey, token, baseUrl } = readTrelloCredentials(config, options.workspace);
  const url = trelloUrl(baseUrl, path, {
    ...options.query,
    key: apiKey,
    token,
  });

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
    },
  });
  const responseText = await response.text();

  if (!response.ok) {
    const snippet = responseText.slice(0, 500);
    throw new TrelloApiError(
      response.status,
      `Trello API request failed with HTTP ${response.status}: ${snippet || response.statusText}`,
      responseText,
    );
  }

  if (!responseText.trim()) {
    return null;
  }

  return JSON.parse(responseText) as unknown;
}

function okResult(key: string, value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ [key]: value }, null, 2),
      },
    ],
    structuredContent: {
      [key]: value,
    },
  };
}

function errorResult(error: unknown): CallToolResult {
  const message =
    error instanceof Error ? error.message : "An unknown Trello MCP error occurred.";

  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  };
}

async function runTrelloTool(key: string, callback: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return okResult(key, await callback());
  } catch (error) {
    return errorResult(error);
  }
}

function cardFilter(includeClosed: boolean): "all" | "open" {
  return includeClosed ? "all" : "open";
}

function stringList(values: string[] | undefined): string | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return values.join(",");
}

export function registerTrelloMcp(server: McpServer, config: TrelloMcpConfig): void {
  const registry = config.registry;
  const workspaceSchema = workspaceInputSchema(registry);

  server.registerTool(
    "trello-list-workspaces",
    {
      title: "List Trello workspaces",
      description:
        "List workspace ids configured on this MCP server (credentials stay on the server).",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () =>
      okResult("workspaces", {
        available: listConfiguredWorkspaceIds(registry),
        source: registry.source,
      }),
  );

  server.registerTool(
    "trello-list-boards",
    {
      title: "List Trello boards",
      description: "List Trello boards visible to the configured workspace token.",
      inputSchema: z.object({
        workspace: workspaceSchema,
        includeClosed: z.boolean().default(false).describe("Include closed boards when true."),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ workspace, includeClosed }) =>
      runTrelloTool("boards", () =>
        trelloRequest(config, "members/me/boards", {
          workspace,
          query: {
            filter: includeClosed ? "all" : "open",
            fields: "id,name,url,closed,dateLastActivity",
          },
        }),
      ),
  );

  server.registerTool(
    "trello-list-lists",
    {
      title: "List Trello lists",
      description: "List lists on a Trello board.",
      inputSchema: z.object({
        workspace: workspaceSchema,
        boardId: trelloIdSchema.describe("The Trello board id."),
        includeClosed: z.boolean().default(false).describe("Include archived lists when true."),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ workspace, boardId, includeClosed }) =>
      runTrelloTool("lists", () =>
        trelloRequest(config, `boards/${encodeURIComponent(boardId)}/lists`, {
          workspace,
          query: {
            filter: includeClosed ? "all" : "open",
            fields: "id,name,closed,pos",
          },
        }),
      ),
  );

  server.registerTool(
    "trello-list-cards",
    {
      title: "List Trello cards",
      description: "List cards from exactly one Trello board or list.",
      inputSchema: z.object({
        workspace: workspaceSchema,
        boardId: trelloIdSchema.optional().describe("The Trello board id."),
        listId: trelloIdSchema.optional().describe("The Trello list id."),
        includeClosed: z.boolean().default(false).describe("Include archived cards when true."),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ workspace, boardId, listId, includeClosed }) => {
      if (Boolean(boardId) === Boolean(listId)) {
        return errorResult(new Error("Provide exactly one of boardId or listId."));
      }

      const containerPath = boardId
        ? `boards/${encodeURIComponent(boardId)}`
        : `lists/${encodeURIComponent(listId as string)}`;

      return runTrelloTool("cards", () =>
        trelloRequest(config, `${containerPath}/cards`, {
          workspace,
          query: {
            filter: cardFilter(includeClosed),
            fields: "id,name,desc,due,idList,labels,url,closed,pos,dateLastActivity",
          },
        }),
      );
    },
  );

  server.registerTool(
    "trello-get-card",
    {
      title: "Get Trello card",
      description: "Fetch details for a Trello card.",
      inputSchema: z.object({
        workspace: workspaceSchema,
        cardId: trelloIdSchema.describe("The Trello card id."),
        includeComments: z.boolean().default(false).describe("Include card comments when true."),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ workspace, cardId, includeComments }) =>
      runTrelloTool("card", () =>
        trelloRequest(config, `cards/${encodeURIComponent(cardId)}`, {
          workspace,
          query: {
            fields: "all",
            actions: includeComments ? "commentCard" : undefined,
          },
        }),
      ),
  );

  server.registerTool(
    "trello-create-card",
    {
      title: "Create Trello card",
      description: "Create a Trello card in a list.",
      inputSchema: z.object({
        workspace: workspaceSchema,
        listId: trelloIdSchema.describe("The Trello list id where the card should be created."),
        name: z.string().min(1, "Card name is required").describe("The new card name."),
        description: z.string().optional().describe("Optional card description."),
        due: z.string().optional().describe("Optional ISO 8601 due date."),
        labelIds: z.array(trelloIdSchema).optional().describe("Optional label ids to apply."),
        position: cardPositionSchema.default("bottom").describe("Card position: top, bottom, or a number."),
      }),
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ workspace, listId, name, description, due, labelIds, position }) =>
      runTrelloTool("card", () =>
        trelloRequest(config, "cards", {
          method: "POST",
          workspace,
          query: {
            idList: listId,
            name,
            desc: description,
            due,
            idLabels: stringList(labelIds),
            pos: position,
          },
        }),
      ),
  );

  server.registerTool(
    "trello-update-card",
    {
      title: "Update Trello card",
      description: "Update Trello card fields, including moving it to another list.",
      inputSchema: z.object({
        workspace: workspaceSchema,
        cardId: trelloIdSchema.describe("The Trello card id."),
        listId: trelloIdSchema.optional().describe("Move the card to this Trello list id."),
        name: z.string().min(1).optional().describe("Replace the card name."),
        description: z.string().optional().describe("Replace the card description."),
        due: z.string().optional().describe("Replace the card due date with an ISO 8601 value."),
        closed: z.boolean().optional().describe("Archive or unarchive the card."),
        position: cardPositionSchema.optional().describe("Card position: top, bottom, or a number."),
      }),
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ workspace, cardId, listId, name, description, due, closed, position }) => {
      const updates = {
        idList: listId,
        name,
        desc: description,
        due,
        closed,
        pos: position,
      };

      if (Object.values(updates).every((value) => value === undefined)) {
        return errorResult(new Error("Provide at least one field to update."));
      }

      return runTrelloTool("card", () =>
        trelloRequest(config, `cards/${encodeURIComponent(cardId)}`, {
          method: "PUT",
          workspace,
          query: updates,
        }),
      );
    },
  );

  server.registerTool(
    "trello-add-comment",
    {
      title: "Add Trello card comment",
      description: "Add a comment to a Trello card.",
      inputSchema: z.object({
        workspace: workspaceSchema,
        cardId: trelloIdSchema.describe("The Trello card id."),
        text: z.string().min(1, "Comment text is required").describe("The comment text."),
      }),
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ workspace, cardId, text }) =>
      runTrelloTool("comment", () =>
        trelloRequest(config, `cards/${encodeURIComponent(cardId)}/actions/comments`, {
          method: "POST",
          workspace,
          query: {
            text,
          },
        }),
      ),
  );

  server.registerResource(
    "trello-setup",
    "chiwire://mcps/trello-setup",
    {
      title: "Trello MCP setup",
      description: "Environment variables and capabilities for the Trello MCP tools.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: [
            "# Trello MCP",
            "",
            "Credentials are managed in Garita (Postgres + Redis cache) or via server env for local dev.",
            "",
            `Configured workspaces: ${listConfiguredWorkspaceIds(registry).join(", ") || "(none)"}`,
            `Config source: ${registry.source}`,
            "",
            "Clients authenticate with `Authorization: Bearer <MCP_AUTH_SECRET>` when configured.",
            "Pass `workspace` on each Trello tool call. Do not put Trello API keys in Cursor `mcp.json`.",
          ].join("\n"),
        },
      ],
    }),
  );
}
