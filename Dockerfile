# ── Stage 1: install all dependencies (needed for build) ─────────────────────
FROM node:22-alpine AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: build the app ────────────────────────────────────────────────────
FROM node:22-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Regenerate Prisma client for the current schema
RUN node_modules/.bin/prisma generate

# Produces the Nitro server bundle in .output/
RUN pnpm build

# ── Stage 3: production image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
ENV NODE_ENV=production

# Self-contained Nitro server bundle (app doesn't need node_modules at runtime)
COPY --from=builder /app/.output ./.output

# Install production deps so the init container can run `prisma migrate deploy`.
# These are not used by the app itself (Nitro bundles everything), but prisma's
# migration engine and CLI live here.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Prisma schema, migrations, and config (required by `prisma migrate deploy`)
COPY prisma ./prisma
COPY prisma.config.ts ./

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
