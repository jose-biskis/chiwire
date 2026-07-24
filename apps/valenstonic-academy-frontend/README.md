# Valenstonic Academy frontend

Learner UI, backoffice, and 3D practice labs. Talks to `@chiwire/valenstonic-academy-backend`.

## Local

```sh
export API_BASE_URL=http://localhost:3001
export PORT=3000

npm run build --workspace @chiwire/valenstonic-academy-shared
npm run build --workspace @chiwire/valenstonic-academy-frontend
npm run start:vtacademy
```

- Site: http://localhost:3000/
- Practice: http://localhost:3000/practice/negroni?mode=procedural
- Admin: http://localhost:3000/admin (`admin` / `1234`)

Domain: `vtacademy.avilalabs.dev` (hostPort `8030`).

Browser API calls go to same-origin `/api/*`, which the frontend proxies to
`API_BASE_URL` (avoids CORS).

In Docker/deploy, containers share the `chiwire` network:
- Frontend → `http://valenstonic-academy-backend:3000`
- Backend → `postgres-pgbouncer:6432` / `redis-cache:6379`

