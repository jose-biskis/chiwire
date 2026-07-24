---
name: valenstonic-frontend
description: >-
  Design and build Valen's Tonic / Valenstonic Academy UI with the project design
  system (rose monochrome tokens, distinctive typography, shadcn primitives).
  Use when editing apps/valenstonic-academy-frontend client UI, landing pages,
  course pages, admin chrome, or adding shadcn components for Valenstonic.
---

# Valenstonic frontend design system

Build distinctive, production-grade UI for **Valen's Tonic** / Valenstonic Academy.
shadcn supplies accessible primitives; **our tokens and composition** supply the brand.
Never ship default shadcn/zinc/Inter aesthetics.

## Aesthetic direction

**Late-night cocktail atelier** — refined, sober, rose-ink monochrome.

- Purpose: Learn cocktails by making them in interactive 3D labs.
- Tone: Luxury/refined bar school, not playful edtech, not generic LMS dashboard.
- Signature memory: Script brand wordmark (**Great Vibes**) + thick accent ring around a circular hero media plane.
- Structure reference: UpStudy cooking-tutor layout (header / hero / features / course grid / categories / promo / footer) — adapt content, keep hierarchy.

## Stack recipe

| Layer | Choice |
|-------|--------|
| App shell | Vite + React + TypeScript under `client/` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Primitives | shadcn/ui (copied into `client/src/components/ui`) |
| Tokens | CSS variables in `client/src/styles/globals.css` (`--palette-*` + semantic) |
| Server | Existing Node server: API proxy, practice HTML, admin HTML; **SSR + hydrate** for `/` and `/courses/*` (`dist/ssr`) |

Practice labs (`static/practice-engine.js`) stay vanilla Three.js — do not force React into the 3D engine.

## Brand tokens (source of truth)

```css
--palette-1: #D01059; /* main accent */
--palette-2: #9E2C58;
--palette-3: #6B3349;
--palette-4: #38262D;
--palette-5: #332D2F; /* page bg */
```

Semantic mapping:

- `--bg` → palette-5 · `--accent` → palette-1 · `--ink` → `#e6d9de` · `--muted` → `#9a858c`
- Accent is for **CTAs, script brand, focus rings, hero circle border** — not large washes of pink.
- Surfaces stay flat charcoal with thin `rgba` lines; avoid purple gradients, cream/terracotta tropes, glow stacks.

## Typography

| Role | Face | Use |
|------|------|-----|
| Brand / script | Great Vibes | Logo, hero accent word only |
| Body / UI | Figtree | Nav, copy, buttons, cards |
| Display (sparing) | Fraunces | Optional editorial moments — never overpower the script brand |

Avoid Inter, Roboto, Arial, Space Grotesk as brand fonts.

## Layout rules (marketing)

1. **Brand first** — first viewport must still read as Valen's Tonic if nav is removed.
2. **Hero budget** — brand script, one headline, one lead, one CTA group, one circular media plane + organic blob.
3. **No hero cards / badges / stat strips** on the media.
4. **One job per section** — features, courses, categories, promo, footer.
5. **Full-bleed atmosphere** — grain/noise or soft blob behind hero; not a flat single slab with inset cards as the hero idea.

## shadcn usage

- Add components with `npx shadcn@latest add <name>` from `apps/valenstonic-academy-frontend` (see `components.json`).
- Theme via CSS variables only — do not leave default zinc/neutral skins.
- Prefer `Button`, `Card`, `Badge`, `Input` as primitives; compose site-specific pieces under `client/src/components/site/`.
- Buttons: use design-system radius (`rounded-md` / token), not candy `rounded-full` pills as the default.
- Cards: allowed for course grids and interactive containers; not in the hero.

## Motion

Ship 2–3 intentional motions on marketing surfaces:

1. Staggered hero reveal (script → headline → lead → actions / circle).
2. Soft hover on course cards / circular hero (scale or border intensity).
3. Optional scroll fade-in for section heads — keep subtle.

Prefer CSS/`motion` for React; no noisy perpetual particle systems on the landing page.

## Do / don't

**Do**

- Keep monochrome rose atelier look coherent across React and any leftover SSR pages.
- Link primary CTA to Negroni practice lab.
- Reuse tokens — never hardcode random pinks.

**Don't**

- Default to purple-on-white, cream+serif+terracotta, or broadsheet hairline newspaper layouts.
- Cover hero media with floating chips/badges.
- Turn the home page into an admin dashboard.
- Restyle the 3D practice HUD to look like shadcn chrome unless asked.

## When implementing

1. Read `client/src/styles/globals.css` for tokens.
2. Prefer existing `components/ui` + `components/site` before inventing new primitives.
3. Match UpStudy **structure** when touching the landing page; keep Valen's Tonic **voice and palette**.
4. After UI changes: `npm run build --workspace @chiwire/valenstonic-academy-frontend` and verify `http://localhost:3000/`.
