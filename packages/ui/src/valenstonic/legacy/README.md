# Valenstonic legacy — sharp atelier shape

Not imported by `@chiwire/ui/valenstonic`. Kept so we can restore the pre–Internal-shape
geometry (sharp radii + Figtree/Fraunces UI stack) if Valen wants it back.

## What lived here

| Piece | File |
|-------|------|
| Fonts + radii overrides | `tokens-shape-atelier-sharp.css` |
| Button size/weight feel | `button-atelier-sharp.tsx` (reference copy) |

## Restore

1. Copy the `:root`-scoped variables from `tokens-shape-atelier-sharp.css` into
   `packages/ui/src/styles/tokens-valenstonic.css` (both light and dark blocks).
2. Optionally align `valenstonic/button.tsx` with `button-atelier-sharp.tsx`
   (`font-semibold`, taller default/lg sizes).
3. Do **not** re-export this folder from `valenstonic/index.ts`.
