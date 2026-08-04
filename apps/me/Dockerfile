FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY apps/me/package.json apps/me/package.json

RUN npm ci

COPY packages/ui packages/ui
COPY apps/me apps/me

RUN npm run build --workspace @chiwire/me

FROM nginx:alpine AS runtime

COPY --from=build /repo/apps/me/dist /usr/share/nginx/html

EXPOSE 80
