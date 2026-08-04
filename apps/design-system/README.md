# Design system

Storybook for Chiwire UI archetypes. Implementation lives in `@chiwire/ui`:

| Layer | Package entry | Storybook |
|-------|---------------|-----------|
| **Base** (hidden) | `@chiwire/ui/base` | **Base → Overview** — catalog + variant contracts only |
| **Internal** | `@chiwire/ui/internal` | Archetypes → Internal (default for new tools) |
| **Valenstonic** | `@chiwire/ui/valenstonic` | Archetypes → Valenstonic |

Brand-only components go in each archetype’s `exclusive/` folder (e.g. Valenstonic `ScriptMark`).

| Archetype | Default for | Look |
|-----------|-------------|------|
| **Internal** | New / internal tools (default) | Light zinc + dark VS Code Modern (Auto → light) |
| **Valenstonic** | Valen's Tonic Academy | One atelier layout; light paper+wine / dark charcoal+rose (Auto → dark) |

### Internal components

Button, Badge, Card, Input, Textarea, Label, Tabs, Alert, Switch, ScrollArea, Separator (+ Colors).  
Toolbar **Color mode**: Auto / Light / Dark.  
See **Examples → Share panel** for a Contimiti-shaped composition.  
Contimiti consumes the same package (light by default).

### Valenstonic components

Same shared catalog in **atelier** style, plus **Exclusive → ScriptMark**.  
One composition: light = warm paper `#f7f4f0` + wine `#6d1d2a`; dark = charcoal `#332d2f` + rose `#d01059`.  
Shape borrows Internal (soft radii + system UI sans); brand script stays Great Vibes.  
Legacy sharp atelier shape: `packages/ui/src/valenstonic/legacy/` (not imported).  
See **Colors** and **Examples → Course panel**. Academy consumes `@chiwire/ui/valenstonic`.

## Run locally

```sh
npm run dev --workspace @chiwire/design-system
```

Open [http://localhost:6006](http://localhost:6006).

## Production build + static server

```sh
npm run build --workspace @chiwire/design-system
npm run start --workspace @chiwire/design-system
```

Open [http://localhost:3000](http://localhost:3000). Health: `/health`.

## Deploy + tunnel

Same internal pattern as Grafana / Bull Board (`127.0.0.1` on the host):

```sh
npm run deploy:design-system
npm run tunnel:design-system
```

Then open [http://localhost:3050](http://localhost:3050).

## Adding a new archetype

1. Add tokens under `packages/ui/src/styles/tokens-<name>.css` and export from `@chiwire/ui`.
2. Implement shared catalog components under `packages/ui/src/<name>/` (re-export identical ones from `base/`).
3. Put brand-only UI in `packages/ui/src/<name>/exclusive/`.
4. Add Storybook re-exports + stories under `src/archetypes/<name>/` with titles like `Archetypes/<Name>/Button`.
5. Register the id in `src/lib/archetypes.ts` (`DEFAULT_ARCHETYPE` stays `internal`).
6. Map tokens + `@source` in `src/styles/globals.css`.
