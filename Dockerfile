# Production image: bundled server + worker (no TypeScript/tsx at runtime), runtime deps only, non-root user.
# NOTE: written for the release but NOT built in the development container (no Docker daemon there) — build and scan it in CI/staging first.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages packages
COPY apps apps
COPY scripts scripts
COPY database database
RUN pnpm install --frozen-lockfile \
 && pnpm build:client \
 && node scripts/build-server.mjs \
 && pnpm prune --prod

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production APP_ROOT=/app PORT=2567 HOST=0.0.0.0
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/database database
COPY --from=build /app/deliverables/playable-artifact deliverables/playable-artifact
COPY --from=build /app/apps/admin-dashboard apps/admin-dashboard
USER node
EXPOSE 2567
HEALTHCHECK --interval=15s --timeout=3s --retries=4 CMD wget -qO- http://127.0.0.1:2567/readyz >/dev/null || exit 1
CMD ["node", "dist/server.mjs"]
