FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/velero-shared/package.json packages/velero-shared/package.json
COPY apps/velero-cli/package.json apps/velero-cli/package.json
COPY apps/velero-backend/package.json apps/velero-backend/package.json

RUN npm ci

COPY packages/velero-shared packages/velero-shared
COPY apps/velero-cli apps/velero-cli
COPY apps/velero-backend apps/velero-backend

RUN npm run build --workspace @chiwire/velero-shared \
  && npm run build --workspace @chiwire/velero-cli \
  && npm run build --workspace @chiwire/velero-backend

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV VELERO_PROFILES_PATH=/data/profiles.json

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/velero-shared/package.json packages/velero-shared/package.json
COPY apps/velero-cli/package.json apps/velero-cli/package.json
COPY apps/velero-backend/package.json apps/velero-backend/package.json

RUN npm ci --omit=dev --workspace @chiwire/velero-backend && npm cache clean --force

COPY --from=build /repo/packages/velero-shared/dist packages/velero-shared/dist
COPY --from=build /repo/packages/velero-shared/package.json packages/velero-shared/package.json
COPY --from=build /repo/apps/velero-cli/dist apps/velero-cli/dist
COPY --from=build /repo/apps/velero-cli/package.json apps/velero-cli/package.json
COPY --from=build /repo/apps/velero-backend/dist apps/velero-backend/dist

RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000

WORKDIR /repo/apps/velero-backend

CMD ["node", "dist/index.js"]
