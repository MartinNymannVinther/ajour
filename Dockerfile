# Production image for Ajour. Multi-stage:
#   deps     -> install node_modules once
#   build    -> next build (standalone output)
#   migrator -> minimal image that runs drizzle migrations (compose "migrate")
#   runner   -> non-root runtime serving the standalone build

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build stamp the running app reports. .dockerignore excludes .git, so
# the commit has to be handed in; without it the app honestly says
# "unknown" rather than guessing.
ARG AJOUR_COMMIT=""
ARG AJOUR_BUILT_AT=""
ENV AJOUR_COMMIT=$AJOUR_COMMIT AJOUR_BUILT_AT=$AJOUR_BUILT_AT
# Dummy values so importing env-validated modules never fails at build time;
# real values come from the environment at runtime.
ENV APP_DATABASE_URL=postgres://build:build@localhost:5432/build \
    AUTH_DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder \
    BETTER_AUTH_URL=http://localhost:3000
RUN pnpm build

FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/core/db/schema ./src/core/db/schema
# The migration step is our own script (it names its failures) and role
# provisioning runs with it; see scripts/migrate.ts and ensure-roles.ts.
COPY scripts/migrate.ts scripts/ensure-roles.ts ./scripts/
USER node
CMD ["pnpm", "db:migrate"]

FROM base AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
