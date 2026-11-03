# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/dashboard/Dockerfile -t otp-dashboard .
ARG NODE_VERSION=26
ARG ALPINE_VERSION=3.24

FROM node:${NODE_VERSION}-alpine AS base
ENV CI=true npm_config_store_dir=/pnpm/store NEXT_TELEMETRY_DISABLED=1
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
    pnpm install --offline --frozen-lockfile --filter "dashboard..."
# output: 'standalone' writes a minimal server plus the node_modules it traced as needed
# into .next/standalone. Static assets are copied next to it below.
RUN pnpm --filter dashboard build

FROM alpine:${ALPINE_VERSION} AS runtime
RUN apk add --no-cache libstdc++ libgcc libatomic \
    && addgroup -S -g 1000 node && adduser -S -u 1000 -G node node
COPY --from=base /usr/local/bin/node /usr/local/bin/node
# HOSTNAME=0.0.0.0: listen on all interfaces, not just localhost inside the container.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/dashboard/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build --chown=node:node /repo/apps/dashboard/public ./apps/dashboard/public
USER node
EXPOSE 3001
CMD ["node", "apps/dashboard/server.js"]
