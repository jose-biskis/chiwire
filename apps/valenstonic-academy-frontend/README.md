# Valenstonic Academy frontend

Learner UI, backoffice, and 3D practice labs. Talks to `@chiwire/valenstonic-academy-backend`.

## Stack

- **Marketing / courses**: Vite + React + Tailwind v4 + `@chiwire/ui/valenstonic` (rose atelier), **SSR + hydrate** for `/` and `/courses/*`
- **Admin**: server-rendered HTML (for now)
- **Practice labs**: static Three.js (`static/`)

Build produces `dist/client` (browser) and `dist/ssr` (Node `render()`). The server fetches course data, renders HTML, and the client hydrates.

## Local

```sh
export API_BASE_URL=http://localhost:3001
export PORT=3000

npm run build --workspace @chiwire/valenstonic-academy-shared
npm run build --workspace @chiwire/valenstonic-academy-frontend
npm run start:vtacademy
```

Vite-only client HMR (proxies API through the Node server on :3000):

```sh
npm run dev:client --workspace @chiwire/valenstonic-academy-frontend
```

- Site: http://localhost:3000/
- Theme: `?theme=dark|light` (default dark atelier)
- Language: `?lang=en|es`
- Practice: http://localhost:3000/practice/negroni?mode=procedural
- Admin: http://localhost:3000/admin (`admin` / `1234`)

Domain: `vtacademy.avilalabs.dev` (hostPort `8030`).

Browser API calls go to same-origin `/api/*`, which the frontend proxies to
`API_BASE_URL` (avoids CORS).

In Docker/deploy, containers share the `chiwire` network:
- Frontend → `http://valenstonic-academy-backend:3000`
- Backend → `postgres-pgbouncer:6432` / `redis-cache:6379`
