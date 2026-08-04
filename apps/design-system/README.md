# Design system

Storybook for Chiwire UI archetypes. Stories are grouped by archetype:

| Archetype | Default for | Look |
|-----------|-------------|------|
| **Internal** | New / internal tools (default) | Plain shadcn neutral (zinc) |
| **Valenstonic** | Valen's Tonic Academy | Late-night rose atelier |

### Internal components

Button, Badge, Card, Input, Textarea, Label, Tabs, Alert (+ Colors).  
See **Examples → Share panel** for a Contimiti-shaped composition.

### Valenstonic components

Same set in rose atelier style.  
See **Examples → Course panel** for a Valen's Tonic composition.

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

1. Add `src/archetypes/<name>/tokens.css` and map it in `src/styles/globals.css`.
2. Add components under `src/archetypes/<name>/components/`.
3. Add stories under `src/archetypes/<name>/stories/` with titles like `Archetypes/<Name>/Button`.
4. Register the id in `src/lib/archetypes.ts` (`DEFAULT_ARCHETYPE` stays `internal`).
