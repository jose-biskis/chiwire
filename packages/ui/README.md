# `@chiwire/ui`

Shared React UI for Chiwire apps, organized by **archetype**.

## Layers

| Entry | Role |
|-------|------|
| `@chiwire/ui/base` | Contract + shared primitives (`Separator`, `ScrollArea`) + appearance chrome (`ArchetypeSelect`, `ThemeSelect`). Chrome may be imported by apps; other base APIs are for archetype authors. |
| `@chiwire/ui/internal` | Default for new / internal tools (zinc light + VS Code dark). |
| `@chiwire/ui/valenstonic` | Valen's Tonic / Academy — rose atelier (dark + daylight light). Exclusive: `ScriptMark`. |

Each product archetype may add brand-only UI under `exclusive/` (exported from the archetype entry).

## Usage

```ts
import { Button, Card } from "@chiwire/ui/internal";
// or
import { Button, ScriptMark } from "@chiwire/ui/valenstonic";
```

Set `data-archetype` and `data-theme` on `html`/`body`, and import the matching tokens + theme CSS:

```css
@import "@chiwire/ui/styles/theme.css"; /* Internal tokens + Tailwind theme */
```

Valenstonic / Academy:

```css
@import "@chiwire/ui/valenstonic/theme.css";
```

## Adding a component

1. Prefer adding to the shared catalog in `src/base/catalog.ts` if every archetype needs it.
2. Implement per archetype (or in `base/` if markup/classes are identical).
3. Brand-only → `src/<archetype>/exclusive/`.
