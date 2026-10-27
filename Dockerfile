# syntax=docker/dockerfile:1
FROM oven/bun:1.4.4 AS bun

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# A separate one-shot image runs migrations before the web service starts.
FROM dependencies AS migrator
ENV NODE_ENV=production
COPY migrations ./migrations
COPY docker/migrate.mjs ./docker/migrate.mjs
CMD ["node", "docker/migrate.mjs"]

FROM dependencies AS builder
ARG NEXT_PUBLIC_APP_NAME=ExpenseFlow
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# Build-time placeholders are not deployment credentials. No database connection
# is required for the build; runtime secrets are supplied only by Compose.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_SECRET=build-only-placeholder-at-least-32-characters \
    BETTER_AUTH_URL=http://localhost:3000 \
    TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
    bun run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
