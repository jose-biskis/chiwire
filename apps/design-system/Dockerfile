FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY apps/design-system/package.json apps/design-system/package.json

RUN npm ci

COPY apps/design-system apps/design-system

RUN npm run build --workspace @chiwire/design-system

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /repo/apps/design-system

COPY --from=build /repo/apps/design-system/package.json package.json
COPY --from=build /repo/apps/design-system/dist dist
COPY --from=build /repo/apps/design-system/storybook-static storybook-static

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
