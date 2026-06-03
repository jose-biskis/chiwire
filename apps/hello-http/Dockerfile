FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY apps/hello-http/package.json apps/hello-http/package.json

RUN npm ci

COPY apps/hello-http apps/hello-http

RUN npm run build --workspace @chiwire/hello-http

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build /repo/apps/hello-http/package.json package.json
COPY --from=build /repo/apps/hello-http/dist dist

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
