# Redis cache

Deploys a simple Redis cache container with persistence disabled and an LRU
eviction policy.

## Deploy

From the repository root:

```sh
npm run deploy:redis
```

To require a Redis password without committing it, set `REDIS_PASSWORD` in
`.env.deploy.local` (forwarded via `runtime.envFrom`):

```sh
# in .env.deploy.local
REDIS_PASSWORD=change-me

npm run deploy:redis
```

Or pass it once on the command line:

```sh
npm run deploy:redis -- --env REDIS_PASSWORD=change-me
```

The default deploy settings bind `127.0.0.1:6379` on the Docker host.

## Defaults

- Persistence: disabled (`save ""`, `appendonly no`)
- Max memory: `256mb`
- Eviction: `allkeys-lru`

Change `REDIS_MAXMEMORY` or `REDIS_MAXMEMORY_POLICY` in `deploy.json` for a
different cache size or eviction policy.
