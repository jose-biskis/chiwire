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

One atelier composition; two palettes:

| Mode | Palette | Notes |
|------|---------|-------|
| **Light** | Warm paper `#f7f4f0`, wine `#6d1d2a` | Valen's chosen daylight |
| **Dark** | Charcoal `#332d2f`, rose `#d01059` | Same layout (crest, photo circle, torn strip, Cormorant lead) |

**Shape** matches Internal (radii 6/8/10/14, system UI sans, medium buttons). Brand script
(Great Vibes) + Cormorant editorial stay. Sharp Figtree atelier archived in
`packages/ui/src/valenstonic/legacy/` (not imported).

- Purpose: Learn cocktails by making them in interactive 3D labs.
- Tone: Luxury/refined bar school, not playful edtech, not generic LMS dashboard.
- Do not reintroduce a separate UpStudy/night home for dark.

## Stack recipe

| Layer | Choice |
|-------|--------|
| App shell | Vite + React + TypeScript under `client/` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Primitives | `@chiwire/ui/valenstonic` (+ exclusive `ScriptMark`) |
| Tokens | `@chiwire/ui/valenstonic/theme.css` (`data-archetype="valenstonic"` + light/dark) |
| Server | Existing Node server: API proxy, practice HTML, admin HTML; **SSR + hydrate** for `/` and `/courses/*` (`dist/ssr`) |

Practice labs (`static/practice-engine.js`) stay vanilla Three.js — do not force React into the 3D engine.

## Brand tokens (source of truth)

Dark brand ladder:

```css
--palette-1: #D01059; /* main accent */
--palette-2: #9E2C58;
--palette-3: #6B3349;
--palette-4: #38262D;
--palette-5: #332D2F; /* page bg */
```

Light (Daylight atelier): primary/wine `#6d1d2a`, paper `#f7f4f0`, muted taupe `#6b5f58`, shell `#ebe4da`.

- Dark: accent for CTAs, script brand, focus rings, hero circle — not large pink washes; charcoal surfaces.
- Light: wine CTAs on warm paper; sharp geometry; grain overlay.

## Typography

| Role | Face | Use |
|------|------|-----|
| Brand / script | Great Vibes | ScriptMark, hero accent word only |
| Body / UI | System UI (Internal shape) | Nav, copy, buttons, cards |
| Editorial | Cormorant Garamond | Atelier lead copy |

Avoid Inter, Roboto, Arial, Space Grotesk as brand fonts. Figtree/Fraunces sharp stack is in
`valenstonic/legacy/` if restoring.

## Layout rules (marketing)

1. **Brand first** — first viewport must still read as Valen's Tonic if nav is removed.
2. **Hero budget** — crest brand + uppercase headline + Cormorant lead + CTAs + photo circle + seal (torn strip below).
3. **No hero cards / badges** on the media (seal is part of the circular composition).
4. **One job per section** — feature strip, courses, footer.
5. **Full-bleed atmosphere** — grain overlay; not a flat single slab with inset cards as the hero idea.

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

- Keep atelier look coherent across React marketing and server HTML (admin/practice/login use DS tokens via `src/ds-styles.ts`).
- Link primary CTA to Negroni practice lab.
- Reuse tokens — never hardcode random pinks.

**Don't**

- Default to purple-on-white, cream+serif+terracotta, or broadsheet hairline newspaper layouts.
- Cover hero media with floating chips/badges.
- Turn the home page into an admin dashboard.
- Restyle the 3D practice HUD to look like shadcn chrome unless asked.

## When implementing

1. Import primitives from `@chiwire/ui/valenstonic`; brand-only bits from `…/exclusive`.
2. Prefer `components/site` compositions before inventing new chrome.
3. Match the shared atelier home composition (crest / photo circle / torn strip); keep Valen's Tonic voice and palettes.
4. PrefsBar keeps ArchetypeSelect (Internal / Valenstonic) for now — default Valenstonic; product will lock later. Theme is dark/light only (no noir/brutalist style pickers).
5. After UI changes: `npm run build --workspace @chiwire/valenstonic-academy-frontend` and verify `http://localhost:3000/`.
