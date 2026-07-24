function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Brand palette + semantic tokens. Change --palette-* to retheme the whole site. */
const paletteStyles = `
  :root {
    /* Raw palette (monochromatic rose) */
    --palette-1: #D01059;
    --palette-2: #9E2C58;
    --palette-3: #6B3349;
    --palette-4: #38262D;
    --palette-5: #332D2F;

    /* Named aliases */
    --color-primary: var(--palette-1);
    --color-primary-deep: var(--palette-2);
    --color-primary-mid: var(--palette-3);
    --color-surface: var(--palette-4);
    --color-surface-deep: var(--palette-5);

    /* Semantic UI — sober defaults; accent reserved for CTAs / focus */
    --bg: var(--palette-5);
    --bg-2: var(--palette-4);
    --accent: var(--palette-1);
    --accent-2: var(--palette-2);
    --accent-3: var(--palette-3);
    --ink: #e6d9de;
    --ink-on-accent: #faf6f7;
    --muted: #9a858c;
    --panel: rgba(56, 38, 45, 0.72);
    --panel-strong: rgba(51, 45, 47, 0.92);
    --line: rgba(230, 217, 222, 0.1);
    --danger: var(--palette-2);
    --bad: var(--palette-2);
    --ok: var(--palette-3);
    --glow: rgba(208, 16, 89, 0.08);
    --radius: 8px;
    --font-display: "Fraunces", Georgia, serif;
    --font-body: "Figtree", system-ui, sans-serif;
  }
`;

const baseStyles = `
  ${paletteStyles}
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: var(--font-body);
    color: var(--ink);
    background: var(--bg);
  }
  a { color: var(--ink); text-decoration: none; }
  a:hover { color: var(--accent); }
  .site-header {
    position: sticky; top: 0; z-index: 40;
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 0.85rem clamp(1rem, 4vw, 2.5rem);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(10px);
  }
  .logo {
    font-family: "Great Vibes", cursive;
    font-size: 1.65rem;
    color: var(--accent);
    line-height: 1;
    white-space: nowrap;
  }
  .logo:hover { color: var(--accent-2); }
  .site-nav { display: flex; gap: 1.35rem; flex-wrap: wrap; justify-content: center; }
  .site-nav a { color: var(--muted); font-size: 0.92rem; font-weight: 500; }
  .site-nav a:hover { color: var(--ink); }
  .header-actions { display: flex; align-items: center; gap: 0.85rem; }
  .header-actions .login { color: var(--muted); font-size: 0.9rem; font-weight: 500; }
  .wrap { width: min(1100px, calc(100% - 2.5rem)); margin: 0 auto; padding: 2rem 0 3rem; }
  .page-title {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: clamp(1.5rem, 3vw, 2rem);
    margin: 0 0 1rem;
    color: var(--ink);
  }
  .eyebrow {
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 0.68rem;
    font-weight: 600;
  }
  .card {
    background: var(--panel-strong);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.15rem 1.25rem;
  }
  .grid { display: grid; gap: 0.85rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  h1,h2,h3,h4 { font-family: var(--font-display); font-weight: 500; color: var(--ink); }
  p, li { color: var(--muted); line-height: 1.6; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    border: 0; border-radius: 999px; padding: 0.65rem 1.15rem; cursor: pointer;
    font-weight: 600; font-size: 0.9rem; font-family: var(--font-body);
    background: var(--accent); color: var(--ink-on-accent);
  }
  .btn:hover { background: var(--accent-2); color: var(--ink-on-accent); }
  .btn.secondary {
    background: transparent; color: var(--ink); border: 1px solid var(--line);
  }
  .btn.secondary:hover { border-color: var(--accent-3); color: var(--ink); }
  .btn.danger { background: var(--accent-2); color: var(--ink-on-accent); }
  label { display: block; font-size: 0.8rem; color: var(--muted); margin: 0.7rem 0 0.3rem; }
  input, select, textarea {
    width: 100%; border-radius: var(--radius); border: 1px solid var(--line);
    background: var(--color-surface-deep); color: var(--ink); padding: 0.6rem 0.7rem; font: inherit;
  }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent-3); }
  textarea { min-height: 110px; font-family: ui-monospace, monospace; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.55rem 0.35rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .flash {
    padding: 0.7rem 0.9rem; border-radius: var(--radius); margin-bottom: 1rem;
    background: rgba(107, 51, 73, 0.35); color: var(--ink); border: 1px solid var(--line);
  }
  .tabs { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .tabs a {
    padding: 0.4rem 0.75rem; border-radius: var(--radius); border: 1px solid var(--line);
    color: var(--muted); font-size: 0.85rem;
  }
  .tabs a:hover { color: var(--ink); }
  .tabs a.active {
    background: var(--palette-4); color: var(--ink); border-color: var(--accent-3);
  }

  /* Landing structure (UpStudy-like) */
  .hero {
    position: relative;
    overflow: hidden;
    padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 4vw, 2.5rem) clamp(2.5rem, 6vw, 4.5rem);
  }
  .hero-blob {
    position: absolute;
    right: -8%;
    top: -10%;
    width: min(58vw, 640px);
    height: min(58vw, 640px);
    border-radius: 46% 54% 42% 58% / 52% 38% 62% 48%;
    background: var(--palette-4);
    opacity: 0.85;
    z-index: 0;
    pointer-events: none;
  }
  .hero-inner {
    position: relative; z-index: 1;
    width: min(1100px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: clamp(1.5rem, 4vw, 3rem);
    align-items: center;
  }
  .hero-script {
    margin: 0 0 0.35rem;
    font-family: "Great Vibes", cursive;
    font-size: clamp(2.4rem, 5vw, 3.4rem);
    color: var(--accent);
    line-height: 1;
  }
  .hero h1 {
    margin: 0;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: clamp(2rem, 4.5vw, 3.35rem);
    line-height: 1.12;
    letter-spacing: -0.03em;
    color: var(--ink);
  }
  .hero .lead {
    margin: 1rem 0 1.4rem;
    max-width: 34rem;
    color: var(--muted);
    font-size: 1.02rem;
  }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 0.65rem; }
  .hero-visual { display: flex; justify-content: center; }
  .hero-circle {
    position: relative;
    width: min(100%, 380px);
    aspect-ratio: 1;
    border-radius: 50%;
    border: 8px solid var(--accent);
    background:
      radial-gradient(circle at 35% 30%, var(--palette-3), var(--palette-5) 70%);
    display: grid;
    place-items: center;
    box-shadow: 0 0 0 14px rgba(208, 16, 89, 0.08);
    overflow: hidden;
  }
  .hero-circle span {
    font-family: "Great Vibes", cursive;
    font-size: clamp(2rem, 4vw, 2.8rem);
    color: var(--ink);
    text-align: center;
    padding: 1rem;
  }
  .hero-circle .play {
    position: absolute;
    width: 4rem; height: 4rem; border-radius: 50%;
    background: var(--accent); color: var(--ink-on-accent);
    display: grid; place-items: center;
    font-size: 1.1rem;
    bottom: 18%;
  }
  .section {
    width: min(1100px, calc(100% - 2.5rem));
    margin: 0 auto;
    padding: clamp(2rem, 4vw, 3.25rem) 0;
  }
  .section-head {
    text-align: center;
    max-width: 36rem;
    margin: 0 auto 1.75rem;
  }
  .section-head h2 {
    margin: 0.35rem 0 0.5rem;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: clamp(1.45rem, 2.6vw, 1.9rem);
    letter-spacing: -0.02em;
  }
  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  .feature {
    text-align: center;
    padding: 1.35rem 1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel-strong);
  }
  .feature-icon {
    width: 3rem; height: 3rem; margin: 0 auto 0.85rem;
    border-radius: 50%;
    display: grid; place-items: center;
    background: rgba(208, 16, 89, 0.12);
    color: var(--accent);
    font-size: 1.15rem;
  }
  .feature h3 {
    margin: 0 0 0.4rem;
    font-family: var(--font-body);
    font-weight: 650;
    font-size: 1.05rem;
  }
  .feature p { margin: 0; font-size: 0.92rem; }
  .course-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }
  .course-card {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel-strong);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .course-card-media {
    aspect-ratio: 16 / 10;
    background:
      linear-gradient(145deg, var(--palette-3), var(--palette-5));
    border-bottom: 1px solid var(--line);
  }
  .course-card-body { padding: 1rem 1.05rem 1.15rem; flex: 1; display: flex; flex-direction: column; }
  .course-card h3 {
    margin: 0.35rem 0 0.45rem;
    font-family: var(--font-body);
    font-weight: 650;
    font-size: 1.05rem;
  }
  .course-card p { margin: 0 0 1rem; font-size: 0.9rem; flex: 1; }
  .categories {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  .category {
    text-align: center;
    padding: 1.1rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--palette-4);
  }
  .category strong {
    display: block;
    font-family: var(--font-body);
    font-size: 0.92rem;
    color: var(--ink);
    font-weight: 600;
  }
  .split-promo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    align-items: center;
    padding: 1.5rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel-strong);
  }
  .split-promo h2 {
    margin: 0 0 0.6rem;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: clamp(1.35rem, 2.4vw, 1.75rem);
  }
  .site-footer {
    margin-top: 2rem;
    border-top: 1px solid var(--line);
    background: var(--palette-4);
    padding: 2.25rem clamp(1rem, 4vw, 2.5rem) 1.5rem;
  }
  .footer-grid {
    width: min(1100px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 1.5rem;
  }
  .site-footer h3 {
    margin: 0 0 0.7rem;
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 650;
  }
  .site-footer a { color: var(--muted); font-size: 0.9rem; display: block; margin: 0.35rem 0; }
  .site-footer a:hover { color: var(--ink); }
  .footer-copy {
    width: min(1100px, 100%);
    margin: 1.5rem auto 0;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.82rem;
  }
  @media (max-width: 860px) {
    .site-nav { display: none; }
    .hero-inner, .features, .split-promo, .footer-grid { grid-template-columns: 1fr; }
    .hero-blob { width: 120%; right: -30%; top: -5%; opacity: 0.55; }
  }
`;

function siteHeader(options?: { admin?: boolean }): string {
  return `<header class="site-header">
    <a class="logo" href="/">Valen's Tonic</a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/">Home</a>
      <a href="/#courses">Courses</a>
      <a href="/practice/negroni?mode=procedural">Labs</a>
      <a href="/admin">${options?.admin ? "Backoffice" : "Admin"}</a>
    </nav>
    <div class="header-actions">
      <a class="login" href="/admin/login">Login</a>
      <a class="btn" href="/practice/negroni?mode=procedural">Get Started</a>
    </div>
  </header>`;
}

function siteFooter(): string {
  return `<footer class="site-footer">
    <div class="footer-grid">
      <div>
        <a class="logo" href="/">Valen's Tonic</a>
        <p style="margin:0.75rem 0 0;max-width:22rem">Interactive cocktail labs where process, measure, and technique matter.</p>
      </div>
      <div>
        <h3>Academy</h3>
        <a href="/">Courses</a>
        <a href="/practice/negroni?mode=procedural">Negroni lab</a>
        <a href="/admin">Admin</a>
      </div>
      <div>
        <h3>Practice</h3>
        <a href="/practice/negroni?mode=procedural">Procedural mode</a>
        <a href="/practice/negroni?mode=glb">GLB mode</a>
        <a href="/practice/negroni?debug=1">Debug collisions</a>
      </div>
    </div>
    <p class="footer-copy">Valenstonic Academy · Valen's Tonic</p>
  </footer>`;
}

export function layout(options: {
  title: string;
  body: string;
  admin?: boolean;
  bare?: boolean;
}): string {
  const main = options.bare
    ? options.body
    : `<div class="wrap">
        <h1 class="page-title">${escapeHtml(options.title)}</h1>
        ${options.body}
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)} · Valen's Tonic</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Great+Vibes&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <style>${baseStyles}</style>
</head>
<body>
  ${siteHeader(options.admin ? { admin: true } : undefined)}
  ${main}
  ${siteFooter()}
</body>
</html>`;
}

export function homePage(courses: Array<{
  slug: string;
  name: string;
  description: string | null;
  category: string;
}>): string {
  const courseCards =
    courses.length === 0
      ? `<article class="course-card"><div class="course-card-body"><p class="eyebrow">Coming soon</p><h3>Classic Cocktails Lab</h3><p>Seed will create the first course on API boot.</p></div></article>`
      : courses
          .map(
            (course) => `<article class="course-card">
          <div class="course-card-media" aria-hidden="true"></div>
          <div class="course-card-body">
            <p class="eyebrow">${escapeHtml(course.category)}</p>
            <h3>${escapeHtml(course.name)}</h3>
            <p>${escapeHtml(course.description ?? "Interactive practice with process and technique.")}</p>
            <a class="btn secondary" href="/courses/${escapeHtml(course.slug)}">Explore now</a>
          </div>
        </article>`
          )
          .join("");

  const body = `
  <section class="hero">
    <div class="hero-blob" aria-hidden="true"></div>
    <div class="hero-inner">
      <div>
        <p class="hero-script">Valen's Tonic</p>
        <h1>Cocktail &amp; Recipe Online Labs</h1>
        <p class="lead">Learn by making — interactive 3D stations where order, measure, and technique decide the pour.</p>
        <div class="hero-actions">
          <a class="btn" href="/practice/negroni?mode=procedural">Start Negroni lab</a>
          <a class="btn secondary" href="#courses">Browse courses</a>
        </div>
      </div>
      <div class="hero-visual">
        <a class="hero-circle" href="/practice/negroni?mode=procedural" aria-label="Open Negroni practice lab">
          <span>Enter the bar</span>
          <div class="play"><i class="fa-solid fa-play"></i></div>
        </a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="features">
      <article class="feature">
        <div class="feature-icon"><i class="fa-solid fa-flask"></i></div>
        <h3>Interactive labs</h3>
        <p>Practice builds in 3D — ice, jigger, stir, and strain with real process rules.</p>
      </article>
      <article class="feature">
        <div class="feature-icon"><i class="fa-solid fa-user-graduate"></i></div>
        <h3>Technique first</h3>
        <p>Wrong order still runs, but the station tells you when the pour is compromised.</p>
      </article>
      <article class="feature">
        <div class="feature-icon"><i class="fa-solid fa-certificate"></i></div>
        <h3>Measure &amp; finish</h3>
        <p>Two-sided jigger pours, overflow, and garnish — finish the drink cleanly.</p>
      </article>
    </div>
  </section>

  <section class="section" id="courses">
    <div class="section-head">
      <p class="eyebrow">Curriculum</p>
      <h2>Our expert cocktail courses</h2>
      <p>Start with Classic Cocktails Lab, then open the Negroni practice station.</p>
    </div>
    <div class="course-grid">${courseCards}</div>
  </section>

  <section class="section">
    <div class="section-head">
      <p class="eyebrow">Topics</p>
      <h2>Our top categories</h2>
    </div>
    <div class="categories">
      <div class="category"><strong>Stirred classics</strong></div>
      <div class="category"><strong>Measured pours</strong></div>
      <div class="category"><strong>Garnish &amp; serve</strong></div>
      <div class="category"><strong>Bar tools</strong></div>
    </div>
  </section>

  <section class="section">
    <div class="split-promo">
      <div>
        <p class="eyebrow">Practice</p>
        <h2>Take your skills to the next level at the bar</h2>
        <p>Whether you are learning your first Negroni or refining technique, the lab tracks process from ice to peel.</p>
        <p style="margin-top:1rem"><a class="btn" href="/practice/negroni?mode=procedural">Open the lab</a></p>
      </div>
      <div class="hero-circle" style="width:min(100%,320px);margin:0 auto;border-width:6px" aria-hidden="true">
        <span style="font-size:2rem">Negroni</span>
      </div>
    </div>
  </section>`;

  return layout({
    title: "Home",
    bare: true,
    body
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
        return `<article class="course-card">
          <div class="course-card-media" aria-hidden="true"></div>
          <div class="course-card-body">
            <p class="eyebrow">Lesson ${lesson.lesson_order} · Interactive</p>
            <h3>${escapeHtml(lesson.title)}</h3>
            <p>Hands-on 3D practice for this recipe.</p>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <a class="btn" href="/practice/${escapeHtml(lesson.scene_slug)}?mode=procedural">Start practice</a>
              <a class="btn secondary" href="/practice/${escapeHtml(lesson.scene_slug)}?mode=glb">GLB mode</a>
            </div>
          </div>
        </article>`;
      }
      return `<article class="card">
        <p class="eyebrow">Lesson ${lesson.lesson_order} · Reading</p>
        <h2 style="font-family:var(--font-body);font-size:1.1rem;margin:0.3rem 0">${escapeHtml(lesson.title)}</h2>
        <p>${escapeHtml(lesson.body ?? "")}</p>
      </article>`;
    })
    .join("");

  return layout({
    title: options.course.name,
    body: `<p class="eyebrow">${escapeHtml(options.course.category)}</p>
      <p>${escapeHtml(options.course.description ?? "")}</p>
      <div class="course-grid" style="margin-top:1.5rem">${lessons}</div>`
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
  apiBase: string,
  debug = false
): string {
  const debugQuery = debug ? "&debug=1" : "";
  const proceduralHref = `/practice/${encodeURIComponent(slug)}?mode=procedural${debugQuery}`;
  const glbHref = `/practice/${encodeURIComponent(slug)}?mode=glb${debugQuery}`;
  const debugOnHref = `/practice/${encodeURIComponent(slug)}?mode=${mode}&debug=1`;
  const debugOffHref = `/practice/${encodeURIComponent(slug)}?mode=${mode}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Practice · Valenstonic Academy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Fraunces:opsz,wght@9..144,600&family=Great+Vibes&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <style>
    ${paletteStyles}
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
<body>
  <div id="loading">
    <div style="text-align:center;padding:1.5rem">
      <h1>Valenstonic Bar Lab</h1>
      <p>Loading recipe, tools, and station…</p>
      <p style="font-size:0.82rem;color:var(--muted)">Render mode: ${mode}${debug ? " · debug" : ""}</p>
      <button type="button" id="enter-btn">Enter the bar</button>
    </div>
  </div>

  <div class="top-link">
    <a href="/">← Academy</a>
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

export function notFoundPage(): string {
  return layout({
    title: "Not found",
    body: `<div class="card"><p>That page does not exist.</p><p><a href="/">Back home</a></p></div>`
  });
}

export { escapeHtml };
