# syntax=docker/dockerfile:1

FROM node:24.16.0-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app


FROM base AS deps

COPY package.json pnpm-lock.yaml ./

# Prisma is generated explicitly in the builder stage, after all source files
# and prisma.config.ts have been copied.
RUN pnpm install --frozen-lockfile --ignore-scripts


FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` loads prisma.config.ts and requires DATABASE_URL to exist,
# but it does not connect to the database. The real URL is supplied at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN pnpm prisma generate
RUN pnpm build


FROM base AS migrator

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma

CMD ["pnpm", "db:migrate"]


FROM node:24.16.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
