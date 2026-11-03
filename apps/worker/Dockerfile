# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/worker/Dockerfile -t otp-worker .
# Same stages as apps/api/Dockerfile (see the comments there), minus Prisma and migrations.
ARG NODE_VERSION=26
ARG ALPINE_VERSION=3.24

FROM node:${NODE_VERSION}-alpine AS base
ENV CI=true npm_config_store_dir=/pnpm/store
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .pnpmfile.cjs ./
# Node 25+ no longer ships Corepack, so install pnpm with npm, at the exact version that
# package.json pins in "packageManager" (single source of truth for local, CI and Docker).
RUN npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "worker..."
RUN pnpm --filter "worker..." build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter worker deploy --prod --legacy --ignore-scripts /out

FROM alpine:${ALPINE_VERSION} AS runtime
RUN apk add --no-cache libstdc++ libgcc libatomic \
    && addgroup -S -g 1000 node && adduser -S -u 1000 -G node node
COPY --from=base /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production WORKER_PORT=3002
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]
