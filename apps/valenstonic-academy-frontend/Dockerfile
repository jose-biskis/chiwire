FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/valenstonic-academy-shared/package.json packages/valenstonic-academy-shared/package.json
COPY apps/valenstonic-academy-frontend/package.json apps/valenstonic-academy-frontend/package.json

RUN npm ci

COPY packages/valenstonic-academy-shared packages/valenstonic-academy-shared
COPY apps/valenstonic-academy-frontend apps/valenstonic-academy-frontend

RUN npm run build --workspace @chiwire/valenstonic-academy-shared \
  && npm run build --workspace @chiwire/valenstonic-academy-frontend

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/valenstonic-academy-shared/package.json packages/valenstonic-academy-shared/package.json
COPY apps/valenstonic-academy-frontend/package.json apps/valenstonic-academy-frontend/package.json

RUN npm ci --omit=dev --workspace @chiwire/valenstonic-academy-frontend && npm cache clean --force

COPY --from=build /repo/packages/valenstonic-academy-shared/dist packages/valenstonic-academy-shared/dist
COPY --from=build /repo/apps/valenstonic-academy-frontend/dist apps/valenstonic-academy-frontend/dist
COPY apps/valenstonic-academy-frontend/static apps/valenstonic-academy-frontend/static

# Vite client assets live under dist/client (included via dist copy above).

USER node

EXPOSE 3000

WORKDIR /repo/apps/valenstonic-academy-frontend

CMD ["node", "dist/index.js"]
