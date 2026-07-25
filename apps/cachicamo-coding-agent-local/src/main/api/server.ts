import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AgentSettings, AgentStreamEvent } from "../../shared/types.js";
import { runAgent } from "../agent/loop.js";
import { listRules } from "../agent/rules.js";
import { listSkills } from "../agent/skills.js";

export type ApiServerHandle = {
  port: number;
  url: string;
  close: () => Promise<void>;
};

type RunBody = {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  workspacePath?: string;
  stream?: boolean;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS"
  });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

function unauthorized(res: ServerResponse): void {
  writeJson(res, 401, { error: "Unauthorized. Send Authorization: Bearer <apiToken>." });
}

function checkAuth(req: IncomingMessage, token: string): boolean {
  if (!token) return false;
  const header = req.headers.authorization;
  if (!header) return false;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value === token;
}

export async function startApiServer(
  getSettings: () => AgentSettings,
  options?: { onEvent?: (event: AgentStreamEvent) => void }
): Promise<ApiServerHandle | null> {
  const settings = getSettings();
  if (!settings.apiEnabled) {
    return null;
  }
  if (!settings.apiToken.trim()) {
    console.warn("[cachicamo] API enabled but apiToken is empty; refusing to listen.");
    return null;
  }

  const port = settings.apiPort > 0 ? settings.apiPort : 3847;
  let activeAbort: AbortController | null = null;

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "GET, POST, OPTIONS"
      });
      res.end();
      return;
    }

    if (url.pathname === "/health") {
      writeJson(res, 200, { ok: true, service: "cachicamo-coding-agent-local" });
      return;
    }

    if (!checkAuth(req, getSettings().apiToken)) {
      unauthorized(res);
      return;
    }

    const current = getSettings();

    if (method === "GET" && url.pathname === "/v1/capabilities") {
      writeJson(res, 200, {
        model: current.model,
        mode: current.mode,
        workspacePath: current.workspacePath,
        rules: listRules(current.workspacePath),
        skills: listSkills(current.workspacePath),
        mcpServers: current.mcpServers.filter((s) => s.enabled).map((s) => ({
          id: s.id,
          name: s.name,
          url: s.url
        })),
        subagents: ["explore", "shell", "general"],
        endpoints: {
          health: "GET /health",
          capabilities: "GET /v1/capabilities",
          run: "POST /v1/agent/run"
        }
      });
      return;
    }

    if (method === "POST" && url.pathname === "/v1/agent/run") {
      let body: RunBody;
      try {
        body = JSON.parse((await readBody(req)) || "{}") as RunBody;
      } catch {
        writeJson(res, 400, { error: "Invalid JSON body" });
        return;
      }

      const message = body.message?.trim();
      if (!message) {
        writeJson(res, 400, { error: "message is required" });
        return;
      }

      const runSettings: AgentSettings = {
        ...current,
        workspacePath: body.workspacePath?.trim() || current.workspacePath
      };

      if (!runSettings.workspacePath) {
        writeJson(res, 400, { error: "workspacePath missing (set in app or pass in body)" });
        return;
      }

      if (activeAbort) {
        activeAbort.abort();
      }
      activeAbort = new AbortController();

      const wantStream = body.stream === true;
      const events: AgentStreamEvent[] = [];
      let reply = "";

      const onEvent = (event: AgentStreamEvent): void => {
        events.push(event);
        options?.onEvent?.(event);
        if (event.type === "text") {
          reply += event.text;
        }
        if (wantStream && !res.writableEnded) {
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
      };

      if (wantStream) {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*"
        });
      }

      try {
        await runAgent({
          settings: runSettings,
          history: body.history ?? [],
          userMessage: message,
          signal: activeAbort.signal,
          onEvent
        });
        activeAbort = null;
        if (wantStream) {
          res.end();
        } else {
          writeJson(res, 200, {
            ok: true,
            reply: reply.trim(),
            events
          });
        }
      } catch (error) {
        activeAbort = null;
        const errMsg = error instanceof Error ? error.message : String(error);
        if (wantStream) {
          res.write(`event: error\ndata: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`);
          res.end();
        } else {
          writeJson(res, 500, { error: errMsg });
        }
      }
      return;
    }

    writeJson(res, 404, { error: "Not found" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  const url = `http://127.0.0.1:${port}`;
  console.log(`[cachicamo] External API listening on ${url}`);

  return {
    port,
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      })
  };
}
