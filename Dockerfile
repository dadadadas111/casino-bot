# syntax=docker/dockerfile:1
# Single-image build for the casino bot.
#   docker build -t casino-bot .
ARG NODE_VERSION=24-slim

# ----- builder: install, build, prune to prod deps -----
FROM node:${NODE_VERSION} AS builder
RUN npm i -g pnpm@11.5.2
WORKDIR /app
# Manifests first for layer caching; pnpm-workspace.yaml carries allowBuilds
# so better-sqlite3's install script is permitted to run.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

# ----- runtime: dist + prod node_modules only -----
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# SQLite lives on a bind mount; the bot has no inbound port.
CMD ["node", "dist/index.js"]
