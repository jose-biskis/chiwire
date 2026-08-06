FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY apps/garita-frontend/package.json apps/garita-frontend/package.json

RUN npm ci

COPY packages/ui packages/ui
COPY apps/garita-frontend apps/garita-frontend

RUN npm run build --workspace @chiwire/garita-frontend

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY apps/garita-frontend/package.json apps/garita-frontend/package.json

RUN npm ci --omit=dev --workspace @chiwire/garita-frontend && npm cache clean --force

COPY --from=build /repo/packages/ui packages/ui
COPY --from=build /repo/apps/garita-frontend/dist apps/garita-frontend/dist
COPY --from=build /repo/apps/garita-frontend/client-dist apps/garita-frontend/client-dist

USER node

EXPOSE 3000

WORKDIR /repo/apps/garita-frontend

CMD ["node", "dist/index.js"]
