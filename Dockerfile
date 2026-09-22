# Production image for Ajour. Multi-stage:
#   deps     -> install node_modules once
#   build    -> next build (standalone output)
#   migrator -> minimal image that runs drizzle migrations (compose "migrate")
#   runner   -> non-root runtime serving the standalone build

FROM node:26-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
# Node 25 and later ship without Corepack, so pnpm is installed outright,
# pinned to the version package.json names under packageManager.
RUN npm install -g pnpm@10.28.0
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

# The migrator carries the full install, dev dependencies included.
#
# A --prod install would be the better shape here, because this image
# holds the Postgres superuser connection string and has no need of
# eslint or vitest next to it. It was tried and reverted at the launch:
# `pnpm db:migrate` runs the scripts through tsx, tsx is a development
# dependency, and `pnpm add --prod tsx` on top of a --prod install does
# not place the binary, so the step fails with `sh: tsx: not found` after
# the database is already up. See TECH-DEBT.md for what a real fix needs.
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
