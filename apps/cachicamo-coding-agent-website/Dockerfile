FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY apps/cachicamo-coding-agent-website/package.json apps/cachicamo-coding-agent-website/package.json

RUN npm ci

COPY packages/ui packages/ui
COPY apps/cachicamo-coding-agent-website apps/cachicamo-coding-agent-website

RUN npm run build --workspace @chiwire/cachicamo-coding-agent-website

FROM nginx:alpine AS runtime

COPY apps/cachicamo-coding-agent-website/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/cachicamo-coding-agent-website/dist /usr/share/nginx/html

EXPOSE 80
