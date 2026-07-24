FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db-migrate/package.json packages/db-migrate/package.json
COPY packages/valenstonic-academy-shared/package.json packages/valenstonic-academy-shared/package.json
COPY apps/valenstonic-academy-backend/package.json apps/valenstonic-academy-backend/package.json

RUN npm ci

COPY packages/core packages/core
COPY packages/db-migrate packages/db-migrate
COPY packages/valenstonic-academy-shared packages/valenstonic-academy-shared
COPY apps/valenstonic-academy-backend apps/valenstonic-academy-backend

RUN npm run build --workspace @chiwire/core \
  && npm run build --workspace @chiwire/db-migrate \
  && npm run build --workspace @chiwire/valenstonic-academy-shared \
  && npm run build --workspace @chiwire/valenstonic-academy-backend

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db-migrate/package.json packages/db-migrate/package.json
COPY packages/valenstonic-academy-shared/package.json packages/valenstonic-academy-shared/package.json
COPY apps/valenstonic-academy-backend/package.json apps/valenstonic-academy-backend/package.json

RUN npm ci --omit=dev --workspace @chiwire/valenstonic-academy-backend && npm cache clean --force

COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/packages/db-migrate/dist packages/db-migrate/dist
COPY --from=build /repo/packages/valenstonic-academy-shared/dist packages/valenstonic-academy-shared/dist
COPY --from=build /repo/apps/valenstonic-academy-backend/dist apps/valenstonic-academy-backend/dist
COPY --from=build /repo/apps/valenstonic-academy-backend/schemas apps/valenstonic-academy-backend/schemas

USER node

EXPOSE 3000

WORKDIR /repo/apps/valenstonic-academy-backend

CMD ["node", "dist/index.js"]
