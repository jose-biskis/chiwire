FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/contimiti/package.json apps/contimiti/package.json

RUN npm ci

COPY packages/core packages/core
COPY apps/contimiti apps/contimiti

RUN npm run build --workspace @chiwire/core \
  && npm run build --workspace @chiwire/contimiti

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/contimiti/package.json apps/contimiti/package.json

RUN npm ci --omit=dev --workspace @chiwire/contimiti && npm cache clean --force

COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/apps/contimiti/dist apps/contimiti/dist

RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000

VOLUME ["/data"]

WORKDIR /repo/apps/contimiti

CMD ["node", "dist/index.js"]
