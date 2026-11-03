# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/api/Dockerfile -t otp-api .
ARG NODE_VERSION=26
ARG ALPINE_VERSION=3.24

# ---- base: Node ----
FROM node:${NODE_VERSION}-alpine AS base
ENV CI=true npm_config_store_dir=/pnpm/store
WORKDIR /repo

# ---- deps: download every package listed in the lockfile ----
# Only the lockfile is copied, so this layer stays cached until dependencies change,
# no matter how often the source code changes.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .pnpmfile.cjs ./
# Node 25+ no longer ships Corepack, so install pnpm with npm, at the exact version that
# package.json pins in "packageManager" (single source of truth for local, CI and Docker).
RUN npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

# ---- build: install the api and its workspace deps, compile, then cut a prod-only copy ----
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "api..."
RUN pnpm --filter "api..." build
# `pnpm deploy` copies the package's "files" plus only its production node_modules
# (workspace packages like @otp/shared included) into /out. --legacy: pnpm 10 deploy mode
# that doesn't need inject-workspace-packages.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter api deploy --prod --legacy --ignore-scripts /out
# @prisma/client ships a query compiler for every database (~70 MB). This schema only uses
# PostgreSQL, so drop the others and the source maps (~55 MB). Change this if the provider changes.
RUN cd /out/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime \
    && find . -name 'query_compiler_*' ! -name '*postgresql*' -delete \
    && find . -name '*.map' -delete

# ---- migrate: one-off job that applies migrations and seeds the admin ----
# Uses the build stage because it needs the Prisma CLI and tsx (dev dependencies).
FROM build AS migrate
WORKDIR /repo/apps/api
USER node
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node node_modules/tsx/dist/cli.mjs prisma/seed.ts"]

# ---- runtime: plain Alpine + the node binary, no npm/pnpm/corepack ----
FROM alpine:${ALPINE_VERSION} AS runtime
RUN apk add --no-cache libstdc++ libgcc libatomic \
    && addgroup -S -g 1000 node && adduser -S -u 1000 -G node node
COPY --from=base /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production API_PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Not root: a compromised process can't modify the image's files or install packages.
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
