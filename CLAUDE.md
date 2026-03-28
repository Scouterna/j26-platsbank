# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**j26-platsbank** is a full-stack web application for Jamboree 26 (Scout event) — a "places bank" platform (Swedish: platsbank). Users can post **requests** (tasks that need people) and **vacancies** (availability windows). Built with TanStack Start (React + Nitro SSR), Material-UI, and PostgreSQL via Prisma.

## Commands

```bash
pnpm dev          # Start dev server on port 3000
pnpm build        # Production build
pnpm test         # Run tests with Vitest
pnpm lint         # Lint with Biome
pnpm format       # Format with Biome
pnpm check        # Biome check (lint + format combined)

pnpm db:generate  # Regenerate Prisma client after schema changes
pnpm db:push      # Push schema to DB (no migration file)
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Prisma Studio
pnpm db:seed      # Seed database
```

Run a single test file: `pnpm test src/path/to/file.test.ts`

## Architecture

### Authentication
- Cookie `j26-auth_access-token` holds a Keycloak-issued JWT from `https://dev.id.scouterna.se/realms/jamboree26`
- Verified server-side using `jose` with the Keycloak JWKS endpoint
- Access control: `resource_access['j26-platsbank'].roles` must include `basic:read`
- Auth logic lives in `src/lib/auth.ts` (JWT verification) and `src/server/auth.ts` (server functions)
- `requireUser()` in `src/server/auth.ts` is called at the top of every mutating server function — throws `Response(403)` if unauthorized

### Routing (TanStack Router — file-based)
- `src/routes/__root.tsx` — HTML shell (fonts, MUI baseline, DevTools)
- `src/routes/_authenticated.tsx` — pathless layout; calls `getUser()` in `beforeLoad`, redirects to `/unauthorized` if the user lacks access, injects `user` into route context and `UserContext` (React context) for child components
- `src/routes/_authenticated/requests/` and `src/routes/_authenticated/vacancies/` — protected feature routes
- `src/routes/index.tsx` — redirects to `/requests`
- `src/routes/unauthorized.tsx` — shown when auth fails
- `src/routeTree.gen.ts` is **auto-generated** — never edit manually; regenerated on `pnpm dev`

### User context in components
`src/lib/user-context.ts` exports `useUser()` — a React context hook that returns the authenticated `AppUser`. Only usable inside the `_authenticated` layout tree.

### Server functions
All data operations are in `src/server/`:
- `auth.ts` — `getUser()` (used in route `beforeLoad`) and `requireUser()` (used as auth guard in other server functions)
- `requests.ts` — `getRequests`, `createRequest`, `deleteRequest` (owner-only)
- `vacancies.ts` — `getVacancies`, `createVacancy`, `deleteVacancy` (owner-only)

### Database
- Models: `Request` (description, startTime, endTime, peopleNeeded, createdBy, creatorName) and `Vacancy` (userId, userName, startTime, endTime, note?)
- Prisma schema: `prisma/schema.prisma`
- Prisma client singleton: `src/db.ts` (always import from here)
- Generated client output: `src/generated/prisma/`
- Requires `DATABASE_URL` env var; local dev: `docker-compose up` for PostgreSQL on port 5432

### Path Aliases
Both `#/*` and `@/*` resolve to `src/*`.

## Key Conventions
- **Language**: UI text is in Swedish
- **Linting/Formatting**: Biome (not ESLint/Prettier) — tabs, double quotes
- **Styling**: Material-UI (MUI) v7 components; global CSS in `src/styles.css`
- After modifying `prisma/schema.prisma`, run `pnpm db:generate` to update the client
