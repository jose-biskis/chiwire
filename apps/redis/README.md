# Redis cache

Deploys a simple Redis cache container with persistence disabled and an LRU
eviction policy.

## Deploy

From the repository root:

```sh
npm run deploy:redis
```

To require a Redis password without committing it:

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
