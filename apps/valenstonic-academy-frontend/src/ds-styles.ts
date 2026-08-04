import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

function loadCssPackage(exportPath: string, fallbackRelative: string): string {
  try {
    return readFileSync(require.resolve(exportPath), "utf8");
  } catch {
    const fallback = join(dirname(fileURLToPath(import.meta.url)), fallbackRelative);
    return readFileSync(fallback, "utf8");
  }
}

function loadTokenSheets(): string {
  const internal = loadCssPackage(
    "@chiwire/ui/internal/tokens.css",
    "../../../packages/ui/src/styles/tokens-internal.css"
  );
  const valenstonic = loadCssPackage(
    "@chiwire/ui/valenstonic/tokens.css",
    "../../../packages/ui/src/styles/tokens-valenstonic.css"
  );
  return `${internal}\n${valenstonic}`;
}

/** Map legacy server CSS vars onto archetype tokens (admin / practice / login). */
const legacyBridge = `
:root,
[data-archetype="valenstonic"],
[data-archetype="internal"] {
  --palette-1: var(--archetype-palette-1);
  --palette-2: var(--archetype-palette-2);
  --palette-3: var(--archetype-palette-3);
  --palette-4: var(--archetype-palette-4);
  --palette-5: var(--archetype-palette-5);

  --color-primary: var(--archetype-primary);
  --color-primary-deep: var(--archetype-palette-2);
  --color-primary-mid: var(--archetype-palette-3);
  --color-surface: var(--archetype-secondary);
  --color-surface-deep: var(--archetype-background);

  --bg: var(--archetype-background);
  --bg-2: var(--archetype-secondary);
  --accent: var(--archetype-primary);
  --accent-2: var(--archetype-primary-hover);
  --accent-3: var(--archetype-palette-3);
  --ink: var(--archetype-foreground);
  --ink-on-accent: var(--archetype-primary-foreground);
  --muted: var(--archetype-muted-foreground);
  --panel: var(--archetype-muted);
  --panel-strong: var(--archetype-card);
  --line: var(--archetype-border);
  --danger: var(--archetype-destructive);
  --bad: var(--archetype-destructive);
  --ok: var(--archetype-palette-3);
  --glow: color-mix(in srgb, var(--archetype-primary) 12%, transparent);
  --radius: var(--archetype-radius-md);
  --font-display: var(--archetype-font-display);
  --font-body: var(--archetype-font-sans);
  --font-editorial: var(--archetype-font-editorial, var(--archetype-font-display));
}
`;

/** Shared chrome for server-rendered admin / login / 404 (atelier geometry). */
const chromeStyles = `
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

.site-header, .atelier-header {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1.15rem clamp(1rem, 4vw, 2.75rem);
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(10px);
}
.atelier-mark {
  display: flex; align-items: center; gap: 0.7rem; color: var(--ink);
}
.atelier-crest {
  width: 2.6rem; height: 2.6rem;
  border: 1.5px solid var(--accent);
  border-radius: 50%;
  display: grid; place-items: center;
  font-size: 0.82rem; font-weight: 700;
}
.atelier-mark strong {
  display: block; font-size: 0.84rem; letter-spacing: 0.14em;
}
.atelier-mark small {
  display: block; color: var(--muted);
  font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase;
}
.site-nav, .atelier-header nav {
  display: none; gap: 1.2rem;
}
.site-nav a, .atelier-header nav a {
  color: var(--muted); font-size: 0.7rem;
  letter-spacing: 0.16em; text-transform: uppercase;
}
.site-nav a:hover, .atelier-header nav a:hover { color: var(--ink); }
.header-actions { display: flex; align-items: center; gap: 0.85rem; }
.header-actions .login { color: var(--muted); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; }

.wrap { width: min(1100px, calc(100% - 2.5rem)); margin: 0 auto; padding: 2rem 0 3rem; }
.page-title {
  font-family: var(--font-body);
  font-weight: 800;
  font-size: clamp(1.5rem, 3vw, 2rem);
  margin: 0 0 1rem;
  letter-spacing: -0.02em;
  text-transform: uppercase;
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
h1,h2,h3,h4 { font-family: var(--font-body); font-weight: 700; color: var(--ink); }
p, li { color: var(--muted); line-height: 1.6; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  border: 0; border-radius: var(--radius); padding: 0.7rem 1rem; cursor: pointer;
  font-weight: 600; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase;
  font-family: var(--font-body);
  background: var(--accent); color: var(--ink-on-accent);
}
.btn:hover { background: var(--accent-2); color: var(--ink-on-accent); }
.btn.secondary {
  background: transparent; color: var(--ink); border: 1px solid var(--line);
}
.btn.secondary:hover { border-color: var(--accent); color: var(--ink); }
.btn.danger { background: var(--danger); color: var(--ink-on-accent); }
label { display: block; font-size: 0.8rem; color: var(--muted); margin: 0.7rem 0 0.3rem; }
input, select, textarea {
  width: 100%; border-radius: var(--radius); border: 1px solid var(--line);
  background: var(--color-surface-deep); color: var(--ink); padding: 0.6rem 0.7rem; font: inherit;
}
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
textarea { min-height: 110px; font-family: ui-monospace, monospace; font-size: 0.85rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { text-align: left; padding: 0.55rem 0.35rem; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
.flash {
  padding: 0.7rem 0.9rem; border-radius: var(--radius); margin-bottom: 1rem;
  background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--ink); border: 1px solid var(--line);
}
.flash.error {
  background: color-mix(in srgb, var(--danger) 28%, transparent);
  color: var(--ink);
  border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
}
.tabs { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 1rem; }
.tabs a {
  padding: 0.4rem 0.75rem; border-radius: var(--radius); border: 1px solid var(--line);
  color: var(--muted); font-size: 0.85rem;
}
.tabs a:hover { color: var(--ink); }
.tabs a.active {
  background: var(--bg-2); color: var(--ink); border-color: var(--accent);
}

.site-footer {
  margin-top: 2rem;
  padding: 2.25rem clamp(1rem, 4vw, 2.5rem) 1.5rem;
  border-top: 1px solid var(--line);
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
@media (min-width: 860px) {
  .site-nav, .atelier-header nav { display: flex; }
}
@media (max-width: 860px) {
  .footer-grid { grid-template-columns: 1fr; }
}
`;

export const dsDocumentStyles = `${loadTokenSheets()}\n${legacyBridge}\n${chromeStyles}`;

export const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Figtree:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Great+Vibes&display=swap";
