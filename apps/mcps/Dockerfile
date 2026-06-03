FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY apps/mcps/package.json apps/mcps/package.json

RUN npm ci

COPY apps/mcps apps/mcps

RUN npm run build --workspace @chiwire/mcps

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/mcps/package.json apps/mcps/package.json

RUN npm ci --omit=dev --workspace @chiwire/mcps && npm cache clean --force

COPY --from=build /repo/apps/mcps/dist apps/mcps/dist

USER node

EXPOSE 3000

WORKDIR /repo/apps/mcps

CMD ["node", "dist/index.js"]
