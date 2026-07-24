# Contimiti

Contimiti is a short-lived share app: paste a note or upload a file, get a
link that lasts **one day**.

- **Texts** — open in the browser, copy, and update until expiry
- **Files** — upload, download, and delete (no in-place update)

v1 stores shares on the local filesystem (`DATA_DIR`). Shared `@chiwire/core`
already exposes Knex + Postgres helpers for later persistence work.

## Run locally

```sh
npm install
npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/contimiti
npm run start:contimiti
```

Open [http://localhost:3000/](http://localhost:3000/).

## API sketch

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/texts` | JSON `{ "content": "…" }` |
| `GET` | `/api/texts/:id` | JSON |
| `PUT` | `/api/texts/:id` | JSON `{ "content": "…" }` |
| `GET` | `/t/:id` | Editable text page |
| `POST` | `/api/files` | Raw body + `x-filename` header |
| `GET` | `/api/files/:id` | Download |
| `DELETE` | `/api/files/:id` | Delete |
| `GET` | `/f/:id` | File page |

## Deploy

Subdomain: `contimiti.avilalabs.dev`

```sh
npm run deploy:contimiti
```
