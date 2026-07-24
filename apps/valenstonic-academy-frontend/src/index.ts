import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  adminPage,
  loginPage,
  notFoundPage,
  practicePage
} from "./pages.js";

const DEFAULT_PORT = 3000;
const DEFAULT_API_BASE = "http://localhost:3001";
const SESSION_COOKIE = "vt_admin_session";
const MAX_BODY = 2_000_000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, "../static");
const CLIENT_DIR = path.resolve(__dirname, "client");
const SSR_ENTRY = path.resolve(__dirname, "ssr/entry-server.js");

type SsrData = {
  courses?: unknown[];
  course?: unknown;
  courseSlug?: string;
  courseMissing?: boolean;
};

type SsrRender = (url: string, data?: SsrData) => {
  html: string;
  title: string;
  description: string;
};

let clientTemplate: string | null = null;
let ssrRender: SsrRender | null = null;

function readPort(): number {
  const configured = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configured, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configured}`);
  }
  return port;
}

function apiBase(): string {
  return (process.env.API_BASE_URL?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
}

/** Browser-facing API base: same-origin via frontend proxy (avoids CORS). */
function browserApiBase(): string {
  return "";
}

async function proxyToApi(
  request: IncomingMessage,
  response: ServerResponse,
  targetPath: string
): Promise<void> {
  const method = request.method ?? "GET";
  const headers = new Headers();
  const contentType = request.headers["content-type"];
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const authorization = request.headers.authorization;
  if (authorization) {
    headers.set("authorization", authorization);
  }

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await readBody(request, MAX_BODY);
  }

  const targetUrl = `${apiBase()}${targetPath}`;
  try {
    const upstream = await fetch(targetUrl, init);
    const payload = Buffer.from(await upstream.arrayBuffer());
    const upstreamType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    response.writeHead(upstream.status, {
      "content-type": upstreamType,
      "cache-control": "no-store"
    });
    response.end(payload);
  } catch (error) {
    console.error(`API proxy failed for ${targetUrl}`, error);
    response.writeHead(502, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(
      `${JSON.stringify({
        error: "API upstream unavailable",
        target: targetUrl,
        detail: error instanceof Error ? error.message : String(error)
      })}\n`
    );
  }
}

function html(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(body);
}

function redirect(response: ServerResponse, location: string, extraHeaders?: Record<string, string>): void {
  response.writeHead(302, { location, ...extraHeaders });
  response.end();
}

function parseCookies(request: IncomingMessage): Record<string, string> {
  const header = request.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join("=").trim());
  }
  return out;
}

function adminToken(request: IncomingMessage): string | undefined {
  return parseCookies(request)[SESSION_COOKIE];
}

async function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > limit) throw new Error(`Body exceeds ${limit} bytes`);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseForm(body: Buffer): Record<string, string> {
  const params = new URLSearchParams(body.toString("utf8"));
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

function csv(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".map")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  if (filePath.endsWith(".glb")) return "model/gltf-binary";
  return "application/octet-stream";
}

function serveFile(response: ServerResponse, rootDir: string, relativePath: string, cache: string): boolean {
  const resolved = path.resolve(rootDir, relativePath);
  if (!resolved.startsWith(rootDir) || !existsSync(resolved) || !statSync(resolved).isFile()) {
    return false;
  }
  response.writeHead(200, {
    "content-type": contentTypeFor(resolved),
    "cache-control": cache
  });
  createReadStream(resolved).pipe(response);
  return true;
}

function serveStatic(response: ServerResponse, urlPath: string): boolean {
  const relative = urlPath.replace(/^\/static\//, "");
  return serveFile(response, STATIC_DIR, relative, "no-cache");
}

function serveClientAsset(response: ServerResponse, urlPath: string): boolean {
  const relative = urlPath.replace(/^\//, "");
  return serveFile(response, CLIENT_DIR, relative, "public, max-age=31536000, immutable");
}

function serveSpa(response: ServerResponse): boolean {
  return serveFile(response, CLIENT_DIR, "index.html", "no-store");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serializeSsrData(data: SsrData): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

function loadClientTemplate(): string | null {
  if (clientTemplate) return clientTemplate;
  const templatePath = path.join(CLIENT_DIR, "index.html");
  if (!existsSync(templatePath)) return null;
  clientTemplate = readFileSync(templatePath, "utf8");
  return clientTemplate;
}

async function loadSsrRender(): Promise<SsrRender | null> {
  if (ssrRender) return ssrRender;
  if (!existsSync(SSR_ENTRY)) return null;
  const mod = (await import(pathToFileURL(SSR_ENTRY).href)) as { render?: SsrRender };
  if (typeof mod.render !== "function") return null;
  ssrRender = mod.render;
  return ssrRender;
}

async function renderMarketingPage(
  pathname: string
): Promise<{ status: number; body: string } | null> {
  const template = loadClientTemplate();
  const render = await loadSsrRender();
  if (!template || !render) return null;

  const data: SsrData = {};
  let status = 200;

  if (pathname === "/") {
    const res = await apiFetch("/api/courses");
    data.courses = res.ok
      ? ((await res.json()) as unknown[])
      : [];
  } else if (pathname.startsWith("/courses/")) {
    const slug = decodeURIComponent(pathname.slice("/courses/".length)).replace(/\/$/, "");
    if (!slug) return null;
    data.courseSlug = slug;
    const res = await apiFetch(`/api/courses/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      data.course = null;
      data.courseMissing = true;
      status = 404;
    } else {
      data.course = await res.json();
      data.courseMissing = false;
    }
  } else {
    return null;
  }

  const { html, title, description } = render(pathname, data);
  const body = template
    .replaceAll("<!--app-title-->", escapeHtml(title))
    .replaceAll("<!--app-description-->", escapeHtml(description))
    .replace("<!--app-html-->", html)
    .replace("<!--app-data-->", serializeSsrData(data));

  return { status, body };
}

async function apiFetch(
  pathname: string,
  init: RequestInit & { token?: string } = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.token) {
    headers.set("authorization", `Bearer ${init.token}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`${apiBase()}${pathname}`, { ...init, headers });
}

async function adminContext(token: string, section: string, flash?: string) {
  const res = await apiFetch("/api/admin/bootstrap", { token });
  if (!res.ok) {
    throw new Error(`Admin bootstrap failed (${res.status})`);
  }
  const data = (await res.json()) as {
    assets: Array<{
      slug: string;
      name: string;
      kind: string;
      model_type: string;
      procedural_key: string | null;
    }>;
    actions: Array<{ slug: string; name: string; kind: string; ui_hint: string | null }>;
    tools: Array<{ slug: string; name: string; enabled_actions: string[] }>;
    recipes: Array<{ slug: string; name: string; category: string; step_count: number }>;
    scenes: Array<{ slug: string; name: string; recipe_id: string }>;
    courses: Array<{ slug: string; name: string; category: string }>;
  };

  const pageInput: Parameters<typeof adminPage>[0] = {
    section,
    assets: data.assets,
    actions: data.actions,
    tools: data.tools,
    recipes: data.recipes,
    scenes: data.scenes,
    courses: data.courses
  };
  if (flash !== undefined) pageInput.flash = flash;
  return adminPage(pageInput);
}

const port = readPort();
const server = createServer((request, response) => {
  void handleRequest(request, response);
});

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (method === "GET" && pathname.startsWith("/static/")) {
      if (!serveStatic(response, pathname)) html(response, 404, notFoundPage());
      return;
    }

    if (method === "GET" && pathname.startsWith("/assets/")) {
      if (!serveClientAsset(response, pathname)) html(response, 404, notFoundPage());
      return;
    }

    if (pathname.startsWith("/api/")) {
      await proxyToApi(request, response, `${pathname}${url.search}`);
      return;
    }

    if (method === "GET" && pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(`${JSON.stringify({ ok: true, service: "valenstonic-academy-frontend" })}\n`);
      return;
    }

    if (method === "GET" && (pathname === "/" || pathname.startsWith("/courses/"))) {
      const rendered = await renderMarketingPage(pathname);
      if (rendered) {
        html(response, rendered.status, rendered.body);
        return;
      }
      // Fallback: client-only shell if SSR bundle/template is missing.
      if (!serveSpa(response)) html(response, 503, notFoundPage());
      return;
    }

    if (method === "GET" && pathname.startsWith("/practice/")) {
      const slug = decodeURIComponent(pathname.slice("/practice/".length));
      const mode = url.searchParams.get("mode") === "glb" ? "glb" : "procedural";
      const debug = url.searchParams.get("debug") === "1";
      html(response, 200, practicePage(slug, mode, browserApiBase(), debug));
      return;
    }

    if (method === "GET" && pathname === "/admin/login") {
      html(response, 200, loginPage());
      return;
    }

    if (method === "POST" && pathname === "/admin/login") {
      const form = parseForm(await readBody(request, MAX_BODY));
      const res = await apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.username ?? "",
          password: form.password ?? ""
        })
      });
      if (!res.ok) {
        html(response, 401, loginPage("Invalid credentials"));
        return;
      }
      const data = (await res.json()) as { token: string };
      redirect(response, "/admin", {
        "set-cookie": `${SESSION_COOKIE}=${encodeURIComponent(data.token)}; Path=/; HttpOnly; SameSite=Lax`
      });
      return;
    }

    if (method === "GET" && pathname === "/admin/logout") {
      redirect(response, "/admin/login", {
        "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
      });
      return;
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const token = adminToken(request);
      if (!token) {
        redirect(response, "/admin/login");
        return;
      }

      if (method === "GET" && pathname === "/admin") {
        const section = url.searchParams.get("section") || "overview";
        const flash = url.searchParams.get("flash") || undefined;
        html(response, 200, await adminContext(token, section, flash));
        return;
      }

      if (method === "POST" && pathname === "/admin/assets") {
        const form = parseForm(await readBody(request, MAX_BODY));
        await apiFetch("/api/admin/assets", {
          method: "POST",
          token,
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            kind: form.kind,
            model_type: form.model_type,
            procedural_key: form.procedural_key || null,
            glb_url: form.glb_url || null,
            collider: JSON.parse(form.collider || "{}"),
            spawn: JSON.parse(form.spawn || "{}"),
            meta: JSON.parse(form.meta || "{}")
          })
        });
        redirect(response, "/admin?section=assets&flash=Asset+saved");
        return;
      }

      if (method === "POST" && pathname === "/admin/actions") {
        const form = parseForm(await readBody(request, MAX_BODY));
        await apiFetch("/api/admin/actions", {
          method: "POST",
          token,
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            kind: form.kind,
            params_schema: JSON.parse(form.params_schema || "{}"),
            ui_hint: form.ui_hint || null
          })
        });
        redirect(response, "/admin?section=actions&flash=Action+saved");
        return;
      }

      if (method === "POST" && pathname === "/admin/tools") {
        const form = parseForm(await readBody(request, MAX_BODY));
        await apiFetch("/api/admin/tools", {
          method: "POST",
          token,
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            asset_slug: form.asset_slug || "",
            enabled_actions: csv(form.enabled_actions)
          })
        });
        redirect(response, "/admin?section=tools&flash=Tool+saved");
        return;
      }

      if (method === "POST" && pathname === "/admin/recipes") {
        const form = parseForm(await readBody(request, MAX_BODY));
        await apiFetch("/api/admin/recipes", {
          method: "POST",
          token,
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            description: form.description || null,
            category: form.category || "cocktail",
            steps: JSON.parse(form.steps || "[]")
          })
        });
        redirect(response, "/admin?section=recipes&flash=Recipe+saved");
        return;
      }

      if (method === "POST" && pathname === "/admin/scenes") {
        const form = parseForm(await readBody(request, MAX_BODY));
        await apiFetch("/api/admin/scenes", {
          method: "POST",
          token,
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            recipe_slug: form.recipe_slug,
            environment_key: form.environment_key || "bar_counter",
            available_asset_slugs: csv(form.available_asset_slugs),
            available_tool_slugs: csv(form.available_tool_slugs)
          })
        });
        redirect(response, "/admin?section=scenes&flash=Scene+saved");
        return;
      }

      if (method === "POST" && pathname === "/admin/courses") {
        const form = parseForm(await readBody(request, MAX_BODY));
        await apiFetch("/api/admin/courses", {
          method: "POST",
          token,
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            description: form.description || null,
            category: form.category || "cocktails",
            lessons: JSON.parse(form.lessons || "[]")
          })
        });
        redirect(response, "/admin?section=courses&flash=Course+saved");
        return;
      }
    }

    html(response, 404, notFoundPage());
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(
      `${JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" })}\n`
    );
  }
}

server.listen(port, () => {
  console.log(
    `valenstonic-academy-frontend listening on http://localhost:${port} (API ${apiBase()})`
  );
});
