import { dsDocumentStyles, FONT_HREF } from "./ds-styles.js";
import {
  DEFAULT_APPEARANCE,
  withAppearance,
  type ServerAppearance
} from "./appearance.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function siteHeader(appearance: ServerAppearance, options?: { admin?: boolean }): string {
  const adminLabel = options?.admin ? "Backoffice" : "Admin";
  const p = (path: string) => withAppearance(path, appearance);
  return `<header class="atelier-header site-header">
    <a class="atelier-mark" href="${p("/")}">
      <span class="atelier-crest">VT</span>
      <span>
        <strong>VALEN'S TONIC</strong>
        <small>Cocktail School</small>
      </span>
    </a>
    <nav class="site-nav" aria-label="Primary">
      <a href="${p("/")}">Home</a>
      <a href="${p("/#courses")}">Courses</a>
      <a href="${p("/practice/negroni?mode=procedural")}">Labs</a>
      <a href="${p("/admin")}">${adminLabel}</a>
    </nav>
    <div class="header-actions">
      <a class="login" href="${p("/admin/login")}">Login</a>
      <a class="btn" href="${p("/practice/negroni?mode=procedural")}">Book a class →</a>
    </div>
  </header>`;
}

function siteFooter(appearance: ServerAppearance): string {
  const p = (path: string) => withAppearance(path, appearance);
  return `<footer class="site-footer">
    <div class="footer-grid">
      <div>
        <a class="atelier-mark" href="${p("/")}">
          <span class="atelier-crest">VT</span>
          <span><strong>VALEN'S TONIC</strong><small>Cocktail School</small></span>
        </a>
        <p style="margin:0.75rem 0 0;max-width:22rem">Interactive cocktail labs where process, measure, and technique matter.</p>
      </div>
      <div>
        <h3>Academy</h3>
        <a href="${p("/")}">Courses</a>
        <a href="${p("/practice/negroni?mode=procedural")}">Negroni lab</a>
        <a href="${p("/admin")}">Admin</a>
      </div>
      <div>
        <h3>Practice</h3>
        <a href="${p("/practice/negroni?mode=procedural")}">Procedural mode</a>
        <a href="${p("/practice/negroni?mode=glb")}">GLB mode</a>
        <a href="${p("/practice/negroni?debug=1")}">Debug collisions</a>
      </div>
    </div>
    <p class="footer-copy">Valenstonic Academy · Valen's Tonic</p>
  </footer>`;
}

export function layout(options: {
  title: string;
  body: string;
  admin?: boolean | undefined;
  bare?: boolean | undefined;
  appearance?: ServerAppearance | undefined;
}): string {
  const appearance = options.appearance ?? DEFAULT_APPEARANCE;
  const main = options.bare
    ? options.body
    : `<div class="wrap">
        <h1 class="page-title">${escapeHtml(options.title)}</h1>
        ${options.body}
      </div>`;

  return `<!DOCTYPE html>
<html lang="${appearance.lang}" data-archetype="${appearance.archetype}" data-theme="${appearance.theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)} · Valen's Tonic</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONT_HREF}" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <style>${dsDocumentStyles}</style>
</head>
<body data-archetype="${appearance.archetype}" data-theme="${appearance.theme}">
  ${siteHeader(appearance, options.admin ? { admin: true } : undefined)}
  ${main}
  ${siteFooter(appearance)}
</body>
</html>`;
}

export function loginPage(error?: string, appearance?: ServerAppearance): string {
  return layout({
    title: "Admin login",
    ...(appearance ? { appearance } : {}),
    body: `${error ? `<div class="flash error">${escapeHtml(error)}</div>` : ""}
      <form class="card" method="post" action="/admin/login" style="max-width:420px">
        <label>Username</label>
        <input name="username" autocomplete="username" required />
        <label>Password</label>
        <input name="password" type="password" autocomplete="current-password" required />
        <p style="margin-top:1rem"><button class="btn" type="submit">Sign in</button></p>
      </form>`
  });
}

export function adminPage(options: {
  section: string;
  flash?: string;
  appearance?: ServerAppearance;
  assets: Array<{ slug: string; name: string; kind: string; model_type: string; procedural_key: string | null }>;
  actions: Array<{ slug: string; name: string; kind: string; ui_hint: string | null }>;
  tools: Array<{ slug: string; name: string; enabled_actions: string[] }>;
  recipes: Array<{ slug: string; name: string; category: string; step_count: number }>;
  scenes: Array<{ slug: string; name: string; recipe_id: string }>;
  courses: Array<{ slug: string; name: string; category: string }>;
}): string {
  const tabs = ["overview", "assets", "actions", "tools", "recipes", "scenes", "courses"]
    .map((tab) => {
      const href = withAppearance(`/admin?section=${tab}`, options.appearance ?? DEFAULT_APPEARANCE);
      return `<a class="${tab === options.section ? "active" : ""}" href="${href}">${tab}</a>`;
    })
    .join("");

  let panel = "";
  if (options.section === "assets") {
    panel = `
      <div class="grid">
        <form class="card" method="post" action="/admin/assets">
          <h3>Upsert 3D asset</h3>
          <label>Slug</label><input name="slug" required placeholder="gin-bottle" />
          <label>Name</label><input name="name" required />
          <label>Kind</label>
          <select name="kind">
            <option>ingredient</option><option>tool</option><option>vessel</option>
            <option>garnish</option><option>surface</option><option>other</option>
          </select>
          <label>Model type</label>
          <select name="model_type"><option>procedural</option><option>glb</option></select>
          <label>Procedural key</label><input name="procedural_key" placeholder="bottle_gin" />
          <label>GLB URL (optional)</label><input name="glb_url" placeholder="/models/foo.glb" />
          <label>Collider JSON</label><textarea name="collider">{"type":"cylinder","radius":0.12,"height":0.55}</textarea>
          <label>Spawn JSON</label><textarea name="spawn">{"x":0,"y":0.05,"z":0,"rotY":0}</textarea>
          <label>Meta JSON</label><textarea name="meta">{}</textarea>
          <p style="margin-top:1rem"><button class="btn" type="submit">Save asset</button></p>
        </form>
        <div class="card">
          <h3>Assets</h3>
          <table><thead><tr><th>Slug</th><th>Name</th><th>Kind</th><th>Model</th></tr></thead>
          <tbody>${options.assets
            .map(
              (a) =>
                `<tr><td>${escapeHtml(a.slug)}</td><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.kind)}</td><td>${escapeHtml(a.model_type)}${a.procedural_key ? ` / ${escapeHtml(a.procedural_key)}` : ""}</td></tr>`
            )
            .join("")}</tbody></table>
        </div>
      </div>`;
  } else if (options.section === "actions") {
    panel = `
      <div class="grid">
        <form class="card" method="post" action="/admin/actions">
          <h3>Upsert action</h3>
          <label>Slug</label><input name="slug" required placeholder="stir" />
          <label>Name</label><input name="name" required />
          <label>Kind</label>
          <select name="kind">
            <option>pour</option><option>stir</option><option>shake</option><option>strain</option>
            <option>place</option><option>measure</option><option>custom</option>
          </select>
          <label>Params schema JSON</label><textarea name="params_schema">{"durationMs":4000}</textarea>
          <label>UI hint</label><input name="ui_hint" />
          <p style="margin-top:1rem"><button class="btn" type="submit">Save action</button></p>
        </form>
        <div class="card">
          <h3>Actions</h3>
          <table><thead><tr><th>Slug</th><th>Name</th><th>Kind</th><th>Hint</th></tr></thead>
          <tbody>${options.actions
            .map(
              (a) =>
                `<tr><td>${escapeHtml(a.slug)}</td><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.kind)}</td><td>${escapeHtml(a.ui_hint ?? "")}</td></tr>`
            )
            .join("")}</tbody></table>
        </div>
      </div>`;
  } else if (options.section === "tools") {
    panel = `
      <div class="grid">
        <form class="card" method="post" action="/admin/tools">
          <h3>Upsert tool</h3>
          <label>Slug</label><input name="slug" required />
          <label>Name</label><input name="name" required />
          <label>Asset slug (optional link)</label><input name="asset_slug" placeholder="barspoon" />
          <label>Enabled actions (comma-separated slugs)</label><input name="enabled_actions" placeholder="stir" />
          <p style="margin-top:1rem"><button class="btn" type="submit">Save tool</button></p>
        </form>
        <div class="card">
          <h3>Tools</h3>
          <table><thead><tr><th>Slug</th><th>Name</th><th>Actions</th></tr></thead>
          <tbody>${options.tools
            .map(
              (t) =>
                `<tr><td>${escapeHtml(t.slug)}</td><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.enabled_actions.join(", "))}</td></tr>`
            )
            .join("")}</tbody></table>
        </div>
      </div>`;
  } else if (options.section === "recipes") {
    panel = `
      <div class="grid">
        <form class="card" method="post" action="/admin/recipes">
          <h3>Upsert recipe + steps</h3>
          <label>Slug</label><input name="slug" required />
          <label>Name</label><input name="name" required />
          <label>Category</label><input name="category" value="cocktail" />
          <label>Description</label><textarea name="description"></textarea>
          <label>Steps JSON array</label>
          <textarea name="steps">[
  {"step_order":1,"title":"Place ice in mixing glass","action_slug":"place","required_asset_slugs":["ice-bucket"],"target_vessel_slug":"mixing-glass","params":{"minCount":3}}
]</textarea>
          <p style="margin-top:1rem"><button class="btn" type="submit">Save recipe</button></p>
        </form>
        <div class="card">
          <h3>Recipes</h3>
          <table><thead><tr><th>Slug</th><th>Name</th><th>Category</th><th>Steps</th></tr></thead>
          <tbody>${options.recipes
            .map(
              (r) =>
                `<tr><td>${escapeHtml(r.slug)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.category)}</td><td>${r.step_count}</td></tr>`
            )
            .join("")}</tbody></table>
        </div>
      </div>`;
  } else if (options.section === "scenes") {
    panel = `
      <div class="grid">
        <form class="card" method="post" action="/admin/scenes">
          <h3>Upsert interactive scene</h3>
          <label>Slug</label><input name="slug" required placeholder="negroni" />
          <label>Name</label><input name="name" required />
          <label>Recipe slug</label><input name="recipe_slug" required />
          <label>Environment key</label><input name="environment_key" value="bar_counter" />
          <label>Available asset slugs (comma)</label><input name="available_asset_slugs" />
          <label>Available tool slugs (comma)</label><input name="available_tool_slugs" />
          <p style="margin-top:1rem"><button class="btn" type="submit">Save scene</button></p>
        </form>
        <div class="card">
          <h3>Scenes</h3>
          <table><thead><tr><th>Slug</th><th>Name</th><th>Open</th></tr></thead>
          <tbody>${options.scenes
            .map((s) => {
              const practiceHref = withAppearance(
                `/practice/${escapeHtml(s.slug)}`,
                options.appearance ?? DEFAULT_APPEARANCE
              );
              return `<tr><td>${escapeHtml(s.slug)}</td><td>${escapeHtml(s.name)}</td><td><a href="${practiceHref}">Practice</a></td></tr>`;
            })
            .join("")}</tbody></table>
        </div>
      </div>`;
  } else if (options.section === "courses") {
    panel = `
      <div class="grid">
        <form class="card" method="post" action="/admin/courses">
          <h3>Upsert course + lessons</h3>
          <label>Slug</label><input name="slug" required />
          <label>Name</label><input name="name" required />
          <label>Category</label><input name="category" value="cocktails" />
          <label>Description</label><textarea name="description"></textarea>
          <label>Lessons JSON</label>
          <textarea name="lessons">[
  {"lesson_order":1,"title":"Intro","kind":"text","body":"..."},
  {"lesson_order":2,"title":"Lab","kind":"interactive","scene_slug":"negroni"}
]</textarea>
          <p style="margin-top:1rem"><button class="btn" type="submit">Save course</button></p>
        </form>
        <div class="card">
          <h3>Courses</h3>
          <table><thead><tr><th>Slug</th><th>Name</th><th>Category</th></tr></thead>
          <tbody>${options.courses
            .map(
              (c) =>
                `<tr><td>${escapeHtml(c.slug)}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.category)}</td></tr>`
            )
            .join("")}</tbody></table>
        </div>
      </div>`;
  } else {
    panel = `<div class="grid">
      <div class="card"><h3>Assets</h3><p>${options.assets.length} models / colliders</p></div>
      <div class="card"><h3>Actions</h3><p>${options.actions.length} process verbs</p></div>
      <div class="card"><h3>Tools</h3><p>${options.tools.length} tools</p></div>
      <div class="card"><h3>Recipes</h3><p>${options.recipes.length} process recipes</p></div>
      <div class="card"><h3>Scenes</h3><p>${options.scenes.length} interactive labs</p></div>
      <div class="card"><h3>Courses</h3><p>${options.courses.length} course shells</p></div>
    </div>
    <p style="margin-top:1.5rem"><a class="btn" href="${withAppearance("/practice/negroni", options.appearance ?? DEFAULT_APPEARANCE)}">Open Negroni practice</a>
    <a class="btn secondary" href="/admin/logout" style="margin-left:0.5rem">Log out</a></p>`;
  }

  return layout({
    title: "Backoffice",
    admin: true,
    ...(options.appearance ? { appearance: options.appearance } : {}),
    body: `${options.flash ? `<div class="flash">${escapeHtml(options.flash)}</div>` : ""}
      <div class="tabs">${tabs}</div>
      ${panel}`
  });
}

export function practicePage(
  slug: string,
  mode: "procedural" | "glb",
  apiBase: string,
  debug = false,
  appearance: ServerAppearance = DEFAULT_APPEARANCE
): string {
  const p = (path: string) => withAppearance(path, appearance);
  const debugQuery = debug ? "&debug=1" : "";
  const proceduralHref = p(`/practice/${encodeURIComponent(slug)}?mode=procedural${debugQuery}`);
  const glbHref = p(`/practice/${encodeURIComponent(slug)}?mode=glb${debugQuery}`);
  const debugOnHref = p(`/practice/${encodeURIComponent(slug)}?mode=${mode}&debug=1`);
  const debugOffHref = p(`/practice/${encodeURIComponent(slug)}?mode=${mode}`);
  return `<!DOCTYPE html>
<html lang="${appearance.lang}" data-archetype="${appearance.archetype}" data-theme="${appearance.theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Practice · Valenstonic Academy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONT_HREF}" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <style>
    ${dsDocumentStyles}
    body { margin:0; overflow:hidden; user-select:none; font-family:var(--font-body); color:var(--ink); background:var(--bg); }
    #canvas-container { width:100vw; height:100vh; display:block; }
    .glass {
      background: var(--panel-strong);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: none;
    }
    #loading {
      position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center;
      background: var(--bg);
      transition: opacity .45s ease;
    }
    #loading h1 { font-family:var(--font-display); font-weight:500; font-size:clamp(1.6rem,3.5vw,2.2rem); margin:0.35rem 0; color:var(--ink); }
    #loading p { color:var(--muted); }
    #loading button {
      margin-top:1.2rem; border:0; border-radius:var(--radius); padding:0.7rem 1.15rem; font-weight:600;
      background:var(--accent); color:var(--ink-on-accent); cursor:pointer;
    }
    #loading.hidden { display: none !important; }
    #canvas-container canvas { display:block; width:100%; height:100%; touch-action:none; cursor:grab; }
    #canvas-container canvas:active { cursor:grabbing; }
    #hud-left { position:absolute; top:1rem; left:1rem; z-index:10; width:min(20rem, calc(100vw - 2rem)); padding:0.9rem 1rem; }
    #hud-right { position:absolute; top:1rem; right:1rem; z-index:10; display:flex; flex-direction:column; gap:0.45rem; }
    #hud-bottom {
      position:absolute; bottom:1rem; left:50%; transform:translateX(-50%); z-index:10;
      width:min(40rem, calc(100vw - 2rem)); padding:0.8rem 1rem; display:flex; gap:0.75rem; align-items:center; justify-content:space-between; flex-wrap:wrap;
    }
    .eyebrow { font-size:0.68rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--muted); font-weight:600; }
    h2 { font-family:var(--font-display); font-weight:500; font-size:1.05rem; margin:0.2rem 0 0.65rem; color:var(--ink); }
    #step-list { list-style:none; padding:0; margin:0; display:grid; gap:0.35rem; font-size:0.86rem; }
    #step-list li { display:flex; gap:0.5rem; align-items:flex-start; color:var(--muted); }
    #step-list li.done { color:var(--muted); text-decoration:line-through; opacity:0.65; }
    #step-list li.current { color:var(--ink); font-weight:600; }
    #step-list li.fail { color:var(--accent-2); }
    button.action {
      border:0; border-radius:var(--radius); padding:0.55rem 0.8rem; font-weight:600; font-size:0.85rem; cursor:pointer; font-family:var(--font-body);
    }
    button.action.primary { background:var(--accent); color:var(--ink-on-accent); }
    button.action.ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
    button.action.warn { background:transparent; color:var(--muted); border:1px solid var(--line); }
    button.action.pulse-reset {
      border-color: var(--accent-3);
      color: var(--ink);
    }
    #fail-banner {
      display:none; position:absolute; top:4.25rem; left:50%; transform:translateX(-50%); z-index:20;
      width:min(26rem, calc(100vw - 2rem)); padding:0.75rem 0.9rem; border-radius:var(--radius);
      background: var(--panel-strong); border:1px solid var(--line); color:var(--ink);
      text-align:center; gap:0.5rem;
    }
    #fail-banner.visible { display:grid; }
    #fail-banner strong { color:var(--ink); font-size:0.9rem; font-weight:600; }
    #fail-banner p { margin:0; font-size:0.82rem; color:var(--muted); }
    #jigger-side-bar {
      display:none; position:absolute; bottom:5.8rem; left:50%; transform:translateX(-50%); z-index:15;
      width:min(26rem, calc(100vw - 2rem)); padding:0.7rem 0.9rem; border-radius:var(--radius);
      background:var(--panel-strong); border:1px solid var(--line); text-align:center;
    }
    #jigger-side-bar.visible { display:block; }
    #jigger-side-bar .eyebrow { margin-bottom:0.3rem; }
    #jigger-side-bar .sides { display:flex; gap:0.4rem; justify-content:center; margin:0.35rem 0; }
    #jigger-side-bar .sides button {
      border:1px solid var(--line); background:transparent; color:var(--ink);
      border-radius:var(--radius); padding:0.5rem 0.9rem; font-weight:600; cursor:pointer; min-width:5.5rem;
    }
    #jigger-side-bar .sides button.active { background:var(--palette-4); border-color:var(--accent-3); color:var(--ink); }
    #jigger-side-bar .soft { margin:0; font-size:0.75rem; color:var(--muted); }
    #toast {
      position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:60; display:none;
      padding:0.85rem 1.15rem; border-radius:var(--radius); font-weight:600; border:1px solid var(--line);
    }
    #toast.ok { display:block; background:var(--panel-strong); color:var(--ink); }
    #toast.bad { display:block; background:var(--palette-4); color:var(--ink); border-color:var(--accent-3); }
    .top-link { position:absolute; top:1rem; left:50%; transform:translateX(-50%); z-index:10; display:flex; gap:0.75rem; align-items:center; }
    .top-link a { color:var(--muted); font-size:0.82rem; text-decoration:none; }
    .mode-switch { display:flex; gap:0.2rem; padding:0.15rem; border-radius:var(--radius); border:1px solid var(--line); background:var(--panel-strong); }
    .mode-switch a { padding:0.3rem 0.6rem; border-radius:6px; font-size:0.7rem; font-weight:600; color:var(--muted); text-decoration:none; }
    .mode-switch a.active { background:var(--palette-4); color:var(--ink); }
    #debug-panel {
      display:${debug ? "block" : "none"};
      position:absolute; bottom:6rem; left:1rem; z-index:12; width:min(22rem, calc(100vw - 2rem));
      padding:0.7rem 0.85rem; font:12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space:pre-wrap; color:var(--muted); background:var(--panel-strong); border:1px solid var(--line); border-radius:var(--radius);
    }
  </style>
</head>
<body data-archetype="${appearance.archetype}" data-theme="${appearance.theme}">
  <div id="loading">
    <div style="text-align:center;padding:1.5rem">
      <h1>Valenstonic Bar Lab</h1>
      <p>Loading recipe, tools, and station…</p>
      <p style="font-size:0.82rem;color:var(--muted)">Render mode: ${mode}${debug ? " · debug" : ""}</p>
      <button type="button" id="enter-btn">Enter the bar</button>
    </div>
  </div>

  <div class="top-link">
    <a href="${p("/")}">← Academy</a>
    <div class="mode-switch" title="Switch 3D render source">
      <a class="${mode === "procedural" ? "active" : ""}" href="${proceduralHref}">Procedural</a>
      <a class="${mode === "glb" ? "active" : ""}" href="${glbHref}">GLB</a>
      <a class="${debug ? "active" : ""}" href="${debug ? debugOffHref : debugOnHref}">Debug</a>
    </div>
  </div>

  <aside id="hud-left" class="glass">
    <div class="eyebrow">Active process · ${mode}${debug ? " · debug" : ""}</div>
    <h2 id="recipe-name">…</h2>
    <ol id="step-list"></ol>
    <div style="margin-top:0.9rem;padding-top:0.8rem;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:0.85rem;color:var(--muted)">
      <span>Score</span><strong id="score-text" style="color:var(--accent)">0</strong>
    </div>
  </aside>

  <div id="hud-right">
    <button class="action warn" type="button" id="reset-btn"><i class="fa-solid fa-rotate-left"></i> Reset station</button>
  </div>

  <div id="fail-banner" role="alert">
    <strong>You're failing this pour</strong>
    <p id="fail-reason">Quantities or technique went wrong.</p>
    <button class="action warn" type="button" id="fail-reset-btn"><i class="fa-solid fa-rotate-left"></i> Reset and try again</button>
  </div>

  <div id="jigger-side-bar" class="glass">
    <div class="eyebrow">Jigger cup · no rush</div>
    <div class="sides">
      <button type="button" data-jigger-side="short">30 ml</button>
      <button type="button" data-jigger-side="long">45 ml</button>
    </div>
    <p class="soft">Classic Negroni uses <strong style="color:var(--ink)">30 ml</strong>. 45 ml is a heavier pour — still allowed.</p>
  </div>

  <div id="hud-bottom" class="glass">
    <div>
      <div class="eyebrow">Active tool</div>
      <strong id="control-hint">Hand: drag ice &amp; bottles. Fill the jigger, then pour the jigger into the glass.</strong>
    </div>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
      <button class="action ghost" type="button" data-tool="hand"><i class="fa-solid fa-hand"></i> Hand</button>
      <button class="action ghost" type="button" data-tool="jigger">Jigger</button>
      <button class="action ghost" type="button" data-tool="barspoon">Barspoon</button>
      <button class="action ghost" type="button" data-tool="strainer">Strainer</button>
      <button class="action ghost" type="button" data-tool="shaker">Shaker</button>
    </div>
  </div>

  <pre id="debug-panel"></pre>
  <div id="toast"></div>
  <div id="canvas-container"></div>

  <script>
    window.__PRACTICE_SLUG__ = ${JSON.stringify(slug)};
    window.__PRACTICE_MODE__ = ${JSON.stringify(mode)};
    window.__PRACTICE_DEBUG__ = ${debug ? "true" : "false"};
    window.__API_BASE__ = ${JSON.stringify(apiBase)};
  </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <script src="/static/practice-engine.js"></script>
</body>
</html>`;
}

export function notFoundPage(appearance?: ServerAppearance): string {
  const appearanceSafe = appearance ?? DEFAULT_APPEARANCE;
  return layout({
    title: "Not found",
    appearance: appearanceSafe,
    body: `<div class="card"><p>That page does not exist.</p><p><a href="${withAppearance("/", appearanceSafe)}">Back home</a></p></div>`
  });
}

export { escapeHtml };
