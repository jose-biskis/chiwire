# Cachicamo Coding Agent Website

Download site for **Cachicamo Coding Agent Local** installers.

Deployed behind Caddy at
[https://cachicamo.avilalabs.dev](https://cachicamo.avilalabs.dev)
(container bound to `127.0.0.1:3060` on the host). Point DNS for that
subdomain at the deploy host before the first domain deploy.

## Local

```sh
npm run dev:cachicamo-coding-agent-website
```

Open [http://localhost:5174](http://localhost:5174).

## Create installers

Build on the matching OS. Windows NSIS should be built on native Windows, not WSL.

```sh
# Linux AppImage + .deb (from Linux / WSL)
npm run build:cachicamo-coding-agent-local:linux

# Windows NSIS + portable (from native Windows)
npm run build:cachicamo-coding-agent-local:win
```

Artifacts land in `apps/cachicamo-coding-agent-local/release/`.

## Publish and deploy

Copy built installers into `public/downloads/`, refresh `manifest.json`, then
deploy the site (installers are baked into the image at build time):

```sh
# publish whatever is already in release/
npm run publish:cachicamo-coding-agent-website

# or build for this OS, then publish
npm run publish:cachicamo-coding-agent-website -- --build

# Linux or Windows target explicitly
npm run publish:cachicamo-coding-agent-website -- --build --linux
npm run publish:cachicamo-coding-agent-website -- --build --win

# publish and deploy in one step
npm run publish:cachicamo-coding-agent-website -- --deploy
```

Then:

```sh
npm run deploy:cachicamo-coding-agent-website
```

Open [https://cachicamo.avilalabs.dev](https://cachicamo.avilalabs.dev).

Installer binaries are gitignored. Only `public/downloads/manifest.json` is
committed (empty until you publish).
