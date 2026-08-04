# Contimiti

Contimiti is a short-lived share app: paste a note or upload a file, get a
link that lasts **one day**.

UI is **React + Vite + Tailwind** on `@chiwire/ui`. Default appearance is
**Internal + light**. Use **View** (top right) to switch archetype
(Internal / Valenstonic) and theme (light / dark); the choice is saved in
`localStorage`.

- **Texts** — open in the browser, copy, and update until expiry
- **Files** — upload, download, and delete (no in-place update)

v1 stores shares on the local filesystem (`DATA_DIR`). Expired shares are
cleaned by a BullMQ repeatable job every 5 minutes (plus lazy delete on read).

## Run locally

Redis must be available (`REDIS_HOST` / `REDIS_PORT`, optional `REDIS_PASSWORD`):

```sh
npm install
npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/contimiti
npm run start:contimiti
```

Open [http://localhost:3000/](http://localhost:3000/).

Optional client HMR (API still on :3000):

```sh
npm run start:contimiti
npm run dev:client --workspace @chiwire/contimiti
```

Open [http://localhost:5173/](http://localhost:5173/) (proxies `/api` to the server).

Inspect the purge queue via Bull Board (`npm run start:bull-board` or
`npm run tunnel:bull-board` after deploy).

## API sketch

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/texts` | JSON `{ "content": "…" }` |
| `GET` | `/api/texts/:id` | JSON |
| `PUT` | `/api/texts/:id` | JSON `{ "content": "…" }` |
| `GET` | `/t/:id` | SPA text page |
| `POST` | `/api/files` | Raw body + `x-filename` header |
| `GET` | `/api/files/:id/meta` | JSON metadata |
| `GET` | `/api/files/:id` | Download |
| `DELETE` | `/api/files/:id` | Delete |
| `GET` | `/f/:id` | SPA file page |

## Deploy

Subdomain: `contimiti.avilalabs.dev`. Joins Docker network `chiwire` and talks
to `redis-cache`.

No local build required — the Dockerfile builds core + Contimiti (server + Vite
client) inside the image:

```sh
npm run deploy:contimiti
```
