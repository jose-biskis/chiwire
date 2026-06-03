FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/avila-labs/package.json apps/avila-labs/package.json

RUN npm ci

COPY apps/avila-labs apps/avila-labs

RUN npm run build --workspace @chiwire/avila-labs

FROM nginx:alpine AS runtime

COPY --from=build /repo/apps/avila-labs/dist /usr/share/nginx/html

EXPOSE 80
