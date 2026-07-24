function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const baseStyles = `
  :root {
    --bg: #14110f;
    --bg-2: #1c1814;
    --panel: rgba(28, 24, 20, 0.88);
    --ink: #f4efe6;
    --muted: #b8a99a;
    --accent: #c45c26;
    --accent-2: #2f6f5e;
    --line: rgba(244, 239, 230, 0.12);
    --danger: #b42318;
    --ok: #2f6f5e;
    --font-display: "Fraunces", Georgia, serif;
    --font-body: "Figtree", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: var(--font-body);
    color: var(--ink);
    background:
      radial-gradient(1200px 600px at 10% -10%, rgba(196, 92, 38, 0.22), transparent 55%),
      radial-gradient(900px 500px at 90% 0%, rgba(47, 111, 94, 0.18), transparent 50%),
      linear-gradient(180deg, #1a1612 0%, var(--bg) 40%, #0f0d0b 100%);
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .wrap { width: min(1100px, calc(100% - 2rem)); margin: 0 auto; padding: 2rem 0 4rem; }
  .brand {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    letter-spacing: -0.02em;
    margin: 0;
  }
  .eyebrow { color: var(--muted); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.75rem; }
  .nav { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0 2rem; }
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 1.25rem 1.4rem;
    backdrop-filter: blur(10px);
  }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  h1,h2,h3 { font-family: var(--font-display); font-weight: 600; }
  p, li { color: var(--muted); line-height: 1.55; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    border: 0; border-radius: 999px; padding: 0.7rem 1.15rem; cursor: pointer;
    font-weight: 700; font-family: var(--font-body); background: var(--accent); color: #1a100c;
  }
  .btn.secondary { background: transparent; color: var(--ink); border: 1px solid var(--line); }
  .btn.danger { background: var(--danger); color: white; }
  label { display: block; font-size: 0.85rem; color: var(--muted); margin: 0.7rem 0 0.3rem; }
  input, select, textarea {
    width: 100%; border-radius: 10px; border: 1px solid var(--line);
    background: #100e0c; color: var(--ink); padding: 0.65rem 0.75rem; font: inherit;
  }
  textarea { min-height: 110px; font-family: ui-monospace, monospace; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
  th, td { text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; }
  .flash { padding: 0.75rem 1rem; border-radius: 12px; margin-bottom: 1rem; background: rgba(47,111,94,0.2); color: #d7efe6; }
  .tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .tabs a { padding: 0.45rem 0.8rem; border-radius: 999px; border: 1px solid var(--line); color: var(--ink); }
  .tabs a.active { background: var(--accent); color: #1a100c; border-color: transparent; text-decoration: none; }
`;

export function layout(options: {
  title: string;
  body: string;
  admin?: boolean;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)} · Valenstonic Academy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap" rel="stylesheet" />
  <style>${baseStyles}</style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">Valenstonic Academy</p>
    <h1 class="brand">${escapeHtml(options.title)}</h1>
    <nav class="nav">
      <a href="/">Courses</a>
      <a href="/practice/negroni?mode=procedural">Negroni lab</a>
      <a href="/admin">${options.admin ? "Backoffice" : "Admin"}</a>
    </nav>
    ${options.body}
  </div>
</body>
</html>`;
}

export function homePage(courses: Array<{
  slug: string;
  name: string;
  description: string | null;
  category: string;
}>): string {
  const cards =
    courses.length === 0
      ? `<div class="card"><p>No courses yet. Seed will create Classic Cocktails Lab on first boot.</p></div>`
      : `<div class="grid">${courses
          .map(
            (course) => `<article class="card">
          <p class="eyebrow">${escapeHtml(course.category)}</p>
          <h2>${escapeHtml(course.name)}</h2>
          <p>${escapeHtml(course.description ?? "")}</p>
          <p><a class="btn" href="/courses/${escapeHtml(course.slug)}">Open course</a></p>
        </article>`
          )
          .join("")}</div>`;

  return layout({
    title: "Learn by making",
    body: `<p>Interactive labs for cocktails, cooking, and brewing. Order and technique matter.</p>${cards}`
  });
}

export function coursePage(options: {
  course: { name: string; description: string | null; category: string };
  lessons: Array<{
    lesson_order: number;
    title: string;
    kind: string;
    body: string | null;
    scene_slug: string | null;
  }>;
}): string {
  const lessons = options.lessons
    .map((lesson) => {
      if (lesson.kind === "interactive" && lesson.scene_slug) {
        return `<article class="card">
          <p class="eyebrow">Lesson ${lesson.lesson_order} · Interactive</p>
          <h2>${escapeHtml(lesson.title)}</h2>
          <p><a class="btn" href="/practice/${escapeHtml(lesson.scene_slug)}?mode=procedural">Start practice</a>
          <a class="btn secondary" href="/practice/${escapeHtml(lesson.scene_slug)}?mode=glb" style="margin-left:0.4rem">GLB mode</a></p>
        </article>`;
      }
      return `<article class="card">
        <p class="eyebrow">Lesson ${lesson.lesson_order} · Reading</p>
        <h2>${escapeHtml(lesson.title)}</h2>
        <p>${escapeHtml(lesson.body ?? "")}</p>
      </article>`;
    })
    .join("");

  return layout({
    title: options.course.name,
    body: `<p class="eyebrow">${escapeHtml(options.course.category)}</p>
      <p>${escapeHtml(options.course.description ?? "")}</p>
      <div class="grid" style="margin-top:1.5rem">${lessons}</div>`
  });
}

export function loginPage(error?: string): string {
  return layout({
    title: "Admin login",
    body: `${error ? `<div class="flash" style="background:rgba(180,35,24,0.25);color:#ffd7d3">${escapeHtml(error)}</div>` : ""}
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
  assets: Array<{ slug: string; name: string; kind: string; model_type: string; procedural_key: string | null }>;
  actions: Array<{ slug: string; name: string; kind: string; ui_hint: string | null }>;
  tools: Array<{ slug: string; name: string; enabled_actions: string[] }>;
  recipes: Array<{ slug: string; name: string; category: string; step_count: number }>;
  scenes: Array<{ slug: string; name: string; recipe_id: string }>;
  courses: Array<{ slug: string; name: string; category: string }>;
}): string {
  const tabs = ["overview", "assets", "actions", "tools", "recipes", "scenes", "courses"]
    .map(
      (tab) =>
        `<a class="${tab === options.section ? "active" : ""}" href="/admin?section=${tab}">${tab}</a>`
    )
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
            <option>add_ice</option><option>garnish</option><option>measure</option><option>place</option><option>custom</option>
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
  {"step_order":1,"title":"Add ice","action_slug":"add-ice","required_asset_slugs":["ice-bucket"],"target_vessel_slug":"mixing-glass","params":{}}
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
            .map(
              (s) =>
                `<tr><td>${escapeHtml(s.slug)}</td><td>${escapeHtml(s.name)}</td><td><a href="/practice/${escapeHtml(s.slug)}">Practice</a></td></tr>`
            )
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
    <p style="margin-top:1.5rem"><a class="btn" href="/practice/negroni">Open Negroni practice</a>
    <a class="btn secondary" href="/admin/logout" style="margin-left:0.5rem">Log out</a></p>`;
  }

  return layout({
    title: "Backoffice",
    admin: true,
    body: `${options.flash ? `<div class="flash">${escapeHtml(options.flash)}</div>` : ""}
      <div class="tabs">${tabs}</div>
      ${panel}`
  });
}

export function practicePage(
  slug: string,
  mode: "procedural" | "glb",
  apiBase: string
): string {
  const proceduralHref = `/practice/${encodeURIComponent(slug)}?mode=procedural`;
  const glbHref = `/practice/${encodeURIComponent(slug)}?mode=glb`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Practice · Valenstonic Academy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <style>
    :root {
      --panel: rgba(20, 16, 12, 0.82);
      --ink: #f6f1e8;
      --muted: #c4b5a5;
      --accent: #d97706;
      --ok: #059669;
      --bad: #dc2626;
      --line: rgba(246,241,232,0.12);
      --font-display: "Fraunces", Georgia, serif;
      --font-body: "Figtree", system-ui, sans-serif;
    }
    body { margin:0; overflow:hidden; user-select:none; font-family:var(--font-body); color:var(--ink); background:#0c0a09; }
    #canvas-container { width:100vw; height:100vh; display:block; }
    .glass {
      background: var(--panel); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 18px 50px rgba(0,0,0,0.35);
    }
    #loading {
      position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center;
      background: radial-gradient(circle at 30% 20%, #3f2a1d, #0c0a09 60%);
      transition: opacity .45s ease;
    }
    #loading h1 { font-family:var(--font-display); font-size:clamp(2rem,5vw,3.2rem); margin:0.4rem 0; color:var(--accent); }
    #loading p { color:var(--muted); }
    #loading button {
      margin-top:1.2rem; border:0; border-radius:999px; padding:0.85rem 1.4rem; font-weight:800;
      background:var(--accent); color:#1c1208; cursor:pointer;
    }
    #hud-left { position:absolute; top:1rem; left:1rem; z-index:10; width:min(22rem, calc(100vw - 2rem)); padding:1rem; }
    #hud-right { position:absolute; top:1rem; right:1rem; z-index:10; display:flex; flex-direction:column; gap:0.55rem; }
    #hud-bottom {
      position:absolute; bottom:1.2rem; left:50%; transform:translateX(-50%); z-index:10;
      width:min(42rem, calc(100vw - 2rem)); padding:0.95rem 1.1rem; display:flex; gap:0.8rem; align-items:center; justify-content:space-between; flex-wrap:wrap;
    }
    .eyebrow { font-size:0.72rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); }
    h2 { font-family:var(--font-display); font-size:1.15rem; margin:0.2rem 0 0.7rem; }
    #step-list { list-style:none; padding:0; margin:0; display:grid; gap:0.4rem; font-size:0.9rem; }
    #step-list li { display:flex; gap:0.5rem; align-items:flex-start; color:var(--muted); }
    #step-list li.done { color:#a7f3d0; text-decoration:line-through; opacity:0.75; }
    #step-list li.current { color:var(--ink); font-weight:700; }
    #step-list li.fail { color:#fecaca; }
    button.action {
      border:0; border-radius:14px; padding:0.7rem 0.95rem; font-weight:800; cursor:pointer; font-family:var(--font-body);
    }
    button.action.primary { background:var(--ok); color:#042f2e; }
    button.action.ghost { background:rgba(255,255,255,0.06); color:var(--ink); border:1px solid var(--line); }
    button.action.warn { background:rgba(220,38,38,0.15); color:#fecaca; border:1px solid rgba(220,38,38,0.25); }
    #toast {
      position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:60; display:none;
      padding:1rem 1.4rem; border-radius:16px; font-weight:800; border:2px solid rgba(255,255,255,0.25);
    }
    #toast.ok { display:block; background:var(--ok); color:#042f2e; }
    #toast.bad { display:block; background:var(--bad); color:white; }
    .top-link { position:absolute; top:1rem; left:50%; transform:translateX(-50%); z-index:10; display:flex; gap:0.75rem; align-items:center; }
    .top-link a { color:var(--muted); font-size:0.85rem; text-decoration:none; }
    .mode-switch { display:inline-flex; gap:0.25rem; padding:0.2rem; border-radius:999px; border:1px solid var(--line); background:rgba(0,0,0,0.25); }
    .mode-switch a {
      padding:0.35rem 0.7rem; border-radius:999px; font-size:0.75rem; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;
      color:var(--muted); text-decoration:none;
    }
    .mode-switch a.active { background:var(--accent); color:#1c1208; }
  </style>
</head>
<body>
  <div id="loading">
    <div style="text-align:center;padding:1.5rem">
      <div style="font-size:3rem">🍸</div>
      <h1>Valenstonic Bar Lab</h1>
      <p>Loading recipe, tools, and station…</p>
      <p style="font-size:0.85rem">Render mode: <strong style="color:var(--accent)">${mode}</strong></p>
      <button type="button" id="enter-btn">Enter the bar</button>
    </div>
  </div>

  <div class="top-link">
    <a href="/">← Academy</a>
    <div class="mode-switch" title="Switch 3D render source">
      <a class="${mode === "procedural" ? "active" : ""}" href="${proceduralHref}">Procedural</a>
      <a class="${mode === "glb" ? "active" : ""}" href="${glbHref}">GLB</a>
    </div>
  </div>

  <aside id="hud-left" class="glass">
    <div class="eyebrow">Active process · ${mode}</div>
    <h2 id="recipe-name">…</h2>
    <ol id="step-list"></ol>
    <div style="margin-top:0.9rem;padding-top:0.8rem;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:0.85rem;color:var(--muted)">
      <span>Score</span><strong id="score-text" style="color:var(--accent)">0</strong>
    </div>
  </aside>

  <div id="hud-right">
    <button class="action warn" type="button" id="reset-btn"><i class="fa-solid fa-rotate-left"></i> Reset station</button>
    <button class="action primary" type="button" id="perform-btn"><i class="fa-solid fa-hand"></i> Perform action</button>
  </div>

  <div id="hud-bottom" class="glass">
    <div>
      <div class="eyebrow">Control mode</div>
      <strong id="control-hint">Drag ingredients/tools. Select a tool, then Perform for stir/shake/strain.</strong>
    </div>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
      <button class="action ghost" type="button" data-tool="barspoon">Barspoon</button>
      <button class="action ghost" type="button" data-tool="jigger">Jigger</button>
      <button class="action ghost" type="button" data-tool="strainer">Strainer</button>
      <button class="action ghost" type="button" data-tool="shaker">Shaker</button>
    </div>
  </div>

  <div id="toast"></div>
  <div id="canvas-container"></div>

  <script>
    window.__PRACTICE_SLUG__ = ${JSON.stringify(slug)};
    window.__PRACTICE_MODE__ = ${JSON.stringify(mode)};
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

export function notFoundPage(): string {
  return layout({
    title: "Not found",
    body: `<div class="card"><p>That page does not exist.</p><p><a href="/">Back home</a></p></div>`
  });
}

export { escapeHtml };
