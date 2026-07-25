# Bull Board

Internal BullMQ dashboard for Chiwire queues. Deployed like Grafana: bound to
`127.0.0.1` on the host and reached over an SSH tunnel.

## Run locally

Redis must be reachable (`REDIS_HOST` / `REDIS_PORT`, optional `REDIS_PASSWORD`):

```sh
npm run build --workspace @chiwire/core
npm run build --workspace @chiwire/bull-board
npm run start:bull-board
```

Open [http://localhost:3000/bullboard](http://localhost:3000/bullboard).

## Deploy + tunnel

```sh
npm run deploy:bull-board
npm run tunnel:bull-board
```

Then open [http://localhost:3040/bullboard](http://localhost:3040/bullboard).

Optional Basic auth: set `BULL_BOARD_PASSWORD` (and optionally `BULL_BOARD_USER`,
default `admin`) in `.env.deploy.local`.

## Queues

Queue names are registered in `@chiwire/core` (`QUEUE_NAMES`). Contimiti’s
purge job (`q-contimiti-purge-expired`) appears here automatically.
