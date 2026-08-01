FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db-migrate/package.json packages/db-migrate/package.json
COPY packages/radiobemba-shared/package.json packages/radiobemba-shared/package.json
COPY apps/radiobemba/package.json apps/radiobemba/package.json

RUN npm ci

COPY packages/core packages/core
COPY packages/db-migrate packages/db-migrate
COPY packages/radiobemba-shared packages/radiobemba-shared
COPY apps/radiobemba apps/radiobemba

RUN npm run build --workspace @chiwire/core \
  && npm run build --workspace @chiwire/db-migrate \
  && npm run build --workspace @chiwire/radiobemba-shared \
  && npm run build --workspace @chiwire/radiobemba

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV RADIOBEMBA_SSH_PORT=2222
ENV RADIOBEMBA_BASE_DOMAIN=bemba.avilalabs.dev
ENV RADIOBEMBA_PUBLIC_ORIGIN=https://bemba.avilalabs.dev
ENV RADIOBEMBA_DATA_DIR=/data
ENV RADIOBEMBA_PERSISTENCE=postgres

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db-migrate/package.json packages/db-migrate/package.json
COPY packages/radiobemba-shared/package.json packages/radiobemba-shared/package.json
COPY apps/radiobemba/package.json apps/radiobemba/package.json

RUN npm ci --omit=dev --workspace @chiwire/radiobemba && npm cache clean --force

COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/packages/db-migrate/dist packages/db-migrate/dist
COPY --from=build /repo/packages/radiobemba-shared/dist packages/radiobemba-shared/dist
COPY --from=build /repo/apps/radiobemba/dist apps/radiobemba/dist
COPY --from=build /repo/apps/radiobemba/schemas apps/radiobemba/schemas

RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000 2222

VOLUME ["/data"]

WORKDIR /repo/apps/radiobemba

CMD ["node", "dist/index.js"]
