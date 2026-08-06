FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db-migrate/package.json packages/db-migrate/package.json
COPY packages/mcps-config/package.json packages/mcps-config/package.json
COPY apps/garita-backend/package.json apps/garita-backend/package.json

RUN npm ci

COPY packages/core packages/core
COPY packages/db-migrate packages/db-migrate
COPY packages/mcps-config packages/mcps-config
COPY apps/garita-backend apps/garita-backend
COPY apps/mcps/schemas apps/mcps/schemas

RUN npm run build --workspace @chiwire/core \
  && npm run build --workspace @chiwire/db-migrate \
  && npm run build --workspace @chiwire/mcps-config \
  && npm run build --workspace @chiwire/garita-backend

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db-migrate/package.json packages/db-migrate/package.json
COPY packages/mcps-config/package.json packages/mcps-config/package.json
COPY apps/garita-backend/package.json apps/garita-backend/package.json

RUN npm ci --omit=dev --workspace @chiwire/garita-backend && npm cache clean --force

COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/packages/db-migrate/dist packages/db-migrate/dist
COPY --from=build /repo/packages/mcps-config/dist packages/mcps-config/dist
COPY --from=build /repo/apps/garita-backend/dist apps/garita-backend/dist
COPY --from=build /repo/apps/mcps/schemas apps/mcps/schemas

USER node

EXPOSE 3000

WORKDIR /repo/apps/garita-backend

CMD ["node", "dist/index.js"]
