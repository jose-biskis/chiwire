# Redis

Deploys Redis on the internal `chiwire` Docker network for cache **and** BullMQ
job keys.

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
- Eviction: `noeviction` (required so BullMQ keys are not LRU-evicted)

Change `REDIS_MAXMEMORY` or `REDIS_MAXMEMORY_POLICY` in `deploy.json` if you
split cache and queues onto separate Redis instances later.
