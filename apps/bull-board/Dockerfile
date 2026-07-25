FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/bull-board/package.json apps/bull-board/package.json

RUN npm ci

COPY packages/core packages/core
COPY apps/bull-board apps/bull-board

RUN npm run build --workspace @chiwire/core \
  && npm run build --workspace @chiwire/bull-board

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/bull-board/package.json apps/bull-board/package.json

RUN npm ci --omit=dev --workspace @chiwire/bull-board && npm cache clean --force

COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/apps/bull-board/dist apps/bull-board/dist

USER node

EXPOSE 3000

WORKDIR /repo/apps/bull-board

CMD ["node", "dist/index.js"]
