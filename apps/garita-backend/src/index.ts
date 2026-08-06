import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  closeRedis,
  connectRedis,
  databaseConfigured,
  deleteWorkspace,
  getDb,
  listWorkspacesFromDb,
  maskWorkspace,
  migrateMcpsSchema,
  readSettingsFromDb,
  readWorkspaceFromDb,
  redisConfigured,
  upsertSettings,
  upsertWorkspace,
  type McpGlobalSettings,
  type TrelloWorkspaceCredentials,
} from "@chiwire/mcps-config";
import type { Knex } from "knex";

import { isGaritaAuthorized, readAdminSecret } from "./auth.js";

const DEFAULT_PORT = 3000;
const MAX_JSON_BYTES = 1_000_000;

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
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_JSON_BYTES) {
      throw new Error(`Body exceeds ${MAX_JSON_BYTES} bytes`);
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

function normalizeWorkspaceId(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function publicSettings(settings: McpGlobalSettings) {
  return {
    authSecretConfigured: Boolean(settings.authSecret),
    allowedOrigin: settings.allowedOrigin,
  };
}

function cryptoRandomSecret(): string {
  return randomBytes(32).toString("base64url");
}

async function bootstrap(): Promise<void> {
  if (!databaseConfigured()) {
    throw new Error("Garita backend requires Postgres (set PGHOST / PGDATABASE).");
  }

  const db = getDb();
  const schemasRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../mcps/schemas",
  );
  await migrateMcpsSchema(db, schemasRoot);

  if (redisConfigured()) {
    try {
      await connectRedis();
      console.log("garita-backend connected to Redis for MCP config cache updates");
    } catch (error) {
      console.warn("garita-backend Redis unavailable; writes will still persist to Postgres", error);
    }
  }

  const port = readPort();
  const server = createServer((request, response) => {
    void handleRequest(request, response, db);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`garita-backend listening on port ${port}`);
    console.log(
      `admin auth: ${readAdminSecret() ? "required (GARITA_ADMIN_SECRET)" : "disabled (local)"}`,
    );
  });

  function shutdown(signal: NodeJS.Signals): void {
    console.log(`received ${signal}; closing garita-backend`);
    server.close((error) => {
      void (async () => {
        if (error) {
          console.error(error);
          process.exitCode = 1;
        }
        await closeRedis().catch(() => undefined);
        await db.destroy().catch(() => undefined);
        process.exit();
      })();
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  db: Knex,
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");
  const { pathname } = url;

  try {
    if (method === "GET" && pathname === "/health") {
      json(response, 200, { ok: true });
      return;
    }

    // Public: UI needs this to decide whether to show the unlock form.
    if (method === "GET" && pathname === "/api/session") {
      json(response, 200, {
        ok: true,
        authRequired: Boolean(readAdminSecret()),
      });
      return;
    }

    if (pathname.startsWith("/api/")) {
      if (!isGaritaAuthorized(request)) {
        json(response, 401, {
          error: "Unauthorized",
          message: "Send Authorization: Bearer <GARITA_ADMIN_SECRET>",
        });
        return;
      }

      await handleApi(request, response, db, method, pathname);
      return;
    }

    json(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(error);
    json(response, 500, { error: message });
  }
}

async function handleApi(
  request: IncomingMessage,
  response: ServerResponse,
  db: Knex,
  method: string,
  pathname: string,
): Promise<void> {
  if (method === "GET" && pathname === "/api/mcps/settings") {
    json(response, 200, { settings: publicSettings(await readSettingsFromDb(db)) });
    return;
  }

  if (method === "PUT" && pathname === "/api/mcps/settings") {
    const body = (await readJsonBody(request)) as {
      authSecret?: string | null;
      allowedOrigin?: string | null;
      rotateAuthSecret?: boolean;
    };
    const current = await readSettingsFromDb(db);
    let authSecret = current.authSecret;
    if (body.rotateAuthSecret) {
      authSecret = cryptoRandomSecret();
    } else if (body.authSecret !== undefined) {
      authSecret = body.authSecret?.trim() ? body.authSecret.trim() : null;
    }

    const saved = await upsertSettings(db, {
      authSecret,
      allowedOrigin:
        body.allowedOrigin !== undefined
          ? body.allowedOrigin?.trim() || null
          : current.allowedOrigin,
    });

    json(response, 200, {
      settings: publicSettings(saved),
      authSecret: body.rotateAuthSecret || body.authSecret ? saved.authSecret : undefined,
    });
    return;
  }

  if (method === "GET" && pathname === "/api/mcps/workspaces") {
    const workspaces = await listWorkspacesFromDb(db);
    json(response, 200, { workspaces: workspaces.map(maskWorkspace) });
    return;
  }

  const workspaceMatch = /^\/api\/mcps\/workspaces\/([^/]+)$/.exec(pathname);
  if (workspaceMatch) {
    const workspaceId = normalizeWorkspaceId(decodeURIComponent(workspaceMatch[1] ?? ""));

    if (method === "GET") {
      const workspace = await readWorkspaceFromDb(db, workspaceId);
      if (!workspace) {
        json(response, 404, { error: "Workspace not found" });
        return;
      }
      json(response, 200, { workspace: maskWorkspace(workspace) });
      return;
    }

    if (method === "DELETE") {
      await deleteWorkspace(db, workspaceId);
      json(response, 200, { ok: true });
      return;
    }

    if (method === "PUT") {
      const body = (await readJsonBody(request)) as Partial<TrelloWorkspaceCredentials> & {
        apiKey?: string;
        token?: string;
      };
      const existing = await readWorkspaceFromDb(db, workspaceId);
      if (!existing && (!body.apiKey?.trim() || !body.token?.trim())) {
        json(response, 400, { error: "apiKey and token are required when creating a workspace" });
        return;
      }

      const saved = await upsertWorkspace(db, {
        id: workspaceId,
        displayName:
          body.displayName !== undefined
            ? body.displayName?.trim() || null
            : (existing?.displayName ?? null),
        apiKey: body.apiKey?.trim() || existing?.apiKey || "",
        token: body.token?.trim() || existing?.token || "",
        enabled: body.enabled ?? existing?.enabled ?? true,
      });

      json(response, 200, { workspace: maskWorkspace(saved) });
      return;
    }
  }

  if (method === "POST" && pathname === "/api/mcps/workspaces") {
    const body = (await readJsonBody(request)) as {
      id?: string;
      displayName?: string | null;
      apiKey?: string;
      token?: string;
      enabled?: boolean;
    };
    const id = body.id ? normalizeWorkspaceId(body.id) : "";
    if (!id || !body.apiKey?.trim() || !body.token?.trim()) {
      json(response, 400, { error: "id, apiKey, and token are required" });
      return;
    }

    const saved = await upsertWorkspace(db, {
      id,
      displayName: body.displayName?.trim() || null,
      apiKey: body.apiKey.trim(),
      token: body.token.trim(),
      enabled: body.enabled ?? true,
    });
    json(response, 201, { workspace: maskWorkspace(saved) });
    return;
  }

  json(response, 404, { error: "Not found" });
}

await bootstrap();
