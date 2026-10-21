FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY apps/velero-frontend/package.json apps/velero-frontend/package.json

RUN npm ci

COPY packages/ui packages/ui
COPY apps/velero-frontend apps/velero-frontend

RUN npm run build --workspace @chiwire/velero-frontend

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY apps/velero-frontend/package.json apps/velero-frontend/package.json

RUN npm ci --omit=dev --workspace @chiwire/velero-frontend && npm cache clean --force

COPY --from=build /repo/packages/ui packages/ui
COPY --from=build /repo/apps/velero-frontend/dist apps/velero-frontend/dist
COPY --from=build /repo/apps/velero-frontend/client-dist apps/velero-frontend/client-dist

USER node

EXPOSE 3000

WORKDIR /repo/apps/velero-frontend

CMD ["node", "dist/index.js"]
