import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";
import { ADMIN_TOKEN, isAdmin, verifyCredentials } from "./auth.js";
import { getDb, migrate } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { AcademyStore } from "./store.js";

const DEFAULT_PORT = 3001;
const MAX_BODY = 2_000_000;

function readPort(): number {
  const configured = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configured, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configured}`);
  }
  return port;
}

function allowedOrigins(): Set<string> {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return new Set(raw.split(",").map((part) => part.trim()).filter(Boolean));
  }
  return new Set([
    "http://localhost:3000",
    "https://vtacademy.avilalabs.dev"
  ]);
}

function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  if (origin && allowedOrigins().has(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("vary", "Origin");
  }
  response.setHeader(
    "access-control-allow-headers",
    "content-type, authorization"
  );
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > limit) {
      throw new Error(`Body exceeds ${limit} bytes`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(request, MAX_BODY);
  if (body.byteLength === 0) {
    return {};
  }
  const parsed: unknown = JSON.parse(body.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object body");
  }
  return parsed as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function requireAdminApi(request: IncomingMessage, response: ServerResponse): boolean {
  if (isAdmin(request)) {
    return true;
  }
  json(response, 401, { error: "Unauthorized" });
  return false;
}

const db = getDb();
await migrate(db);
const store = new AcademyStore(db);
await seedIfEmpty(store);

const port = readPort();
const server = createServer((request, response) => {
  void handleRequest(request, response);
});

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    applyCors(request, response);
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (method === "GET" && pathname === "/health") {
      json(response, 200, { ok: true, service: "valenstonic-academy-backend" });
      return;
    }

    if (method === "GET" && pathname === "/") {
      json(response, 200, {
        service: "valenstonic-academy-backend",
        docs: ["GET /health", "GET /api/courses", "GET /api/practices/:slug", "POST /api/admin/login"]
      });
      return;
    }

    if (method === "GET" && pathname === "/api/courses") {
      json(response, 200, await store.listCourses());
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/courses/")) {
      const slug = decodeURIComponent(pathname.slice("/api/courses/".length));
      const course = await store.getCourseBySlug(slug);
      if (!course) {
        json(response, 404, { error: "Course not found" });
        return;
      }
      const lessons = await store.listLessons(course.id);
      const scenes = await store.listScenes();
      const sceneById = Object.fromEntries(scenes.map((scene) => [scene.id, scene.slug]));
      json(response, 200, {
        course,
        lessons: lessons.map((lesson) => ({
          ...lesson,
          scene_slug: lesson.interactive_scene_id
            ? (sceneById[lesson.interactive_scene_id] ?? null)
            : null
        }))
      });
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/practices/")) {
      const slug = decodeURIComponent(pathname.slice("/api/practices/".length));
      const practice = await store.getPracticeBySceneSlug(slug);
      if (!practice) {
        json(response, 404, { error: "Practice not found" });
        return;
      }
      json(response, 200, practice);
      return;
    }

    if (method === "POST" && pathname === "/api/admin/login") {
      const body = await readJson(request);
      if (!verifyCredentials(asString(body.username), asString(body.password))) {
        json(response, 401, { error: "Invalid credentials" });
        return;
      }
      json(response, 200, { token: ADMIN_TOKEN });
      return;
    }

    if (method === "GET" && pathname === "/api/admin/bootstrap") {
      if (!requireAdminApi(request, response)) return;
      const [assets, actions, tools, recipes, scenes, courses] = await Promise.all([
        store.listAssets(),
        store.listActions(),
        store.listTools(),
        store.listRecipes(),
        store.listScenes(),
        store.listCourses()
      ]);
      const recipeViews = await Promise.all(
        recipes.map(async (recipe) => ({
          slug: recipe.slug,
          name: recipe.name,
          category: recipe.category,
          step_count: (await store.listSteps(recipe.id)).length
        }))
      );
      json(response, 200, {
        assets,
        actions,
        tools,
        recipes: recipeViews,
        scenes,
        courses
      });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/assets") {
      if (!requireAdminApi(request, response)) return;
      const body = await readJson(request);
      await store.upsertAsset({
        slug: asString(body.slug),
        name: asString(body.name),
        kind: asString(body.kind, "other"),
        model_type: asString(body.model_type, "procedural"),
        procedural_key: asString(body.procedural_key) || null,
        glb_url: asString(body.glb_url) || null,
        collider: body.collider ?? {},
        spawn: body.spawn ?? {},
        meta: body.meta ?? {}
      });
      json(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/actions") {
      if (!requireAdminApi(request, response)) return;
      const body = await readJson(request);
      await store.upsertAction({
        slug: asString(body.slug),
        name: asString(body.name),
        kind: asString(body.kind, "custom"),
        params_schema: body.params_schema ?? {},
        ui_hint: asString(body.ui_hint) || null
      });
      json(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/tools") {
      if (!requireAdminApi(request, response)) return;
      const body = await readJson(request);
      const assets = await store.listAssets();
      const asset = assets.find((item) => item.slug === asString(body.asset_slug));
      await store.upsertTool({
        slug: asString(body.slug),
        name: asString(body.name),
        asset_id: asset?.id ?? null,
        enabled_actions: asStringArray(body.enabled_actions)
      });
      json(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/recipes") {
      if (!requireAdminApi(request, response)) return;
      const body = await readJson(request);
      const recipeId = await store.upsertRecipe({
        slug: asString(body.slug),
        name: asString(body.name),
        description: asString(body.description) || null,
        category: asString(body.category, "cocktail")
      });
      const steps = Array.isArray(body.steps) ? body.steps : [];
      await store.replaceRecipeSteps(
        recipeId,
        steps as Array<{
          step_order: number;
          title: string;
          action_slug: string;
          required_tool_slug?: string | null;
          required_asset_slugs?: string[];
          target_vessel_slug?: string | null;
          params?: unknown;
          success_message?: string | null;
          failure_message?: string | null;
        }>
      );
      json(response, 200, { ok: true, id: recipeId });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/scenes") {
      if (!requireAdminApi(request, response)) return;
      const body = await readJson(request);
      const recipe = await store.getRecipeBySlug(asString(body.recipe_slug));
      if (!recipe) {
        json(response, 404, { error: "Recipe slug not found" });
        return;
      }
      const id = await store.upsertScene({
        slug: asString(body.slug),
        name: asString(body.name),
        recipe_id: recipe.id,
        environment_key: asString(body.environment_key, "bar_counter"),
        available_asset_slugs: asStringArray(body.available_asset_slugs),
        available_tool_slugs: asStringArray(body.available_tool_slugs)
      });
      json(response, 200, { ok: true, id });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/courses") {
      if (!requireAdminApi(request, response)) return;
      const body = await readJson(request);
      const courseId = await store.upsertCourse({
        slug: asString(body.slug),
        name: asString(body.name),
        description: asString(body.description) || null,
        category: asString(body.category, "cocktails")
      });
      const scenes = await store.listScenes();
      const sceneBySlug = Object.fromEntries(scenes.map((scene) => [scene.slug, scene.id]));
      const lessons = Array.isArray(body.lessons) ? body.lessons : [];
      await store.replaceCourseLessons(
        courseId,
        (
          lessons as Array<{
            lesson_order: number;
            title: string;
            kind: "text" | "interactive";
            body?: string | null;
            scene_slug?: string | null;
          }>
        ).map((lesson) => ({
          lesson_order: lesson.lesson_order,
          title: lesson.title,
          kind: lesson.kind,
          body: lesson.body ?? null,
          interactive_scene_id: lesson.scene_slug ? (sceneBySlug[lesson.scene_slug] ?? null) : null
        }))
      );
      json(response, 200, { ok: true, id: courseId });
      return;
    }

    json(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    json(response, 500, {
      error: error instanceof Error ? error.message : "Internal error"
    });
  }
}

server.listen(port, () => {
  console.log(`valenstonic-academy-backend listening on http://localhost:${port}`);
});
