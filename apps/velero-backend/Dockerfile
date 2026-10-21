FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY apps/velero/package.json apps/velero/package.json
COPY apps/velero-backend/package.json apps/velero-backend/package.json

RUN npm ci

COPY apps/velero apps/velero
COPY apps/velero-backend apps/velero-backend

RUN npm run build --workspace @chiwire/velero \
  && npm run build --workspace @chiwire/velero-backend

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV VELERO_PROFILES_PATH=/data/profiles.json

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/velero/package.json apps/velero/package.json
COPY apps/velero-backend/package.json apps/velero-backend/package.json

RUN npm ci --omit=dev --workspace @chiwire/velero-backend && npm cache clean --force

COPY --from=build /repo/apps/velero/dist apps/velero/dist
COPY --from=build /repo/apps/velero/package.json apps/velero/package.json
COPY --from=build /repo/apps/velero-backend/dist apps/velero-backend/dist

RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000

WORKDIR /repo/apps/velero-backend

CMD ["node", "dist/index.js"]
