# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**j26-platsbank** is a full-stack web app for Jamboree26 (Swedish Scout event). It's a platsbank where organisers post requests for help and participants sign up. Built with TanStack Start (React 19 + Nitro SSR), Material-UI v7, and PostgreSQL via Prisma 7.

## Build / Lint / Test Commands

```bash
pnpm dev            # Dev server (port 3000, host 0.0.0.0)
pnpm build          # Production build
pnpm test           # Run all tests (Vitest)
pnpm test src/path/to/file.test.ts   # Run a single test file
pnpm lint           # Lint with Biome
pnpm format         # Format with Biome
pnpm check          # Biome check (lint + format combined)
```

Database commands (all use `dotenv -e .env.local`):
```bash
pnpm db:generate    # Regenerate Prisma client after schema changes
pnpm db:push        # Push schema to DB (no migration file)
pnpm db:migrate     # Run migrations
pnpm db:studio      # Open Prisma Studio
pnpm db:seed        # Seed database (runs tsx prisma/seed.ts)
pnpm db:reset       # Reset DB and re-run migrations
```

After modifying `prisma/schema.prisma`, always run `pnpm db:generate`.

## Code Style

### Formatting (Biome — not ESLint/Prettier)
- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes for JS/TS strings
- **Semicolons**: Required (Biome default)
- **Trailing commas**: Yes, where valid
- **Biome organizes imports** automatically — do not manually sort imports
- Config: `biome.json`. Targets `**/src/**/*` (excludes `routeTree.gen.ts` and `styles.css`)

### Imports
- Use the `#/` path alias for all intra-project imports (maps to `src/`). Example: `import { prisma } from "#/db"`
- `@/` also works but `#/` is the convention used throughout the codebase
- Use `type` keyword for type-only imports: `import type { AppUser } from "#/lib/auth"`
- `verbatimModuleSyntax` is enabled in tsconfig — you must use `import type` for type-only imports
- Import order is handled by Biome; do not add blank lines between import groups

### TypeScript
- **Strict mode** is enabled (`strict: true` in tsconfig)
- `noUnusedLocals` and `noUnusedParameters` are on — remove unused variables
- `noFallthroughCasesInSwitch` is on
- Target: ES2022, module: ESNext, moduleResolution: bundler
- Prefer `interface` for object shapes that describe a contract; use `type` for unions, intersections, and utility types
- Use explicit return types on exported functions; inferred types are fine for local helpers

### Naming Conventions
- **Files**: kebab-case (`use-app-bar-title.ts`, `user-context.ts`)
- **Route files**: Follow TanStack Router conventions (`_authenticated.tsx`, `$requestId.edit.tsx`, `__root.tsx`)
- **React components**: PascalCase (`RequestsPage`, `AuthenticatedLayout`)
- **Functions/variables**: camelCase (`getRequests`, `handleSubmit`)
- **Server functions**: camelCase, verb-first (`createRequest`, `deleteRequest`, `signUpForRequest`)
- **Interfaces/types**: PascalCase (`AppUser`, `CreateRequestInput`, `KeycloakPayload`)
- **Constants**: camelCase for module-level (`ISSUER`, `JWKS` are exceptions for auth config)

### UI Language
- All user-facing text is in **Swedish**. Error messages, labels, buttons, descriptions — everything the user sees must be Swedish.
- Code (variable names, comments, types) is in English.

## Architecture

### Directory Structure
```
src/
  db.ts                  # Prisma client singleton (always import prisma from here)
  router.tsx             # TanStack Router setup
  theme.ts               # MUI theme (primary green #41a62a)
  styles.css             # Global CSS (currently empty)
  generated/prisma/      # Auto-generated Prisma client (never edit)
  lib/                   # Shared utilities and hooks
    auth.ts              # JWT verification with jose + JWKS
    user-context.ts      # React context for authenticated user
    use-app-bar-title.ts # Hook to set app bar title via postMessage
  server/                # Server functions (TanStack Start createServerFn)
    auth.ts              # getUser, getUserStatus, requireUser
    requests.ts          # CRUD for requests, signups, blocks
    utils.ts             # withLogging helper
  routes/                # File-based routing (TanStack Router)
    __root.tsx           # HTML shell, MUI ThemeProvider, CssBaseline
    _authenticated.tsx   # Auth layout — checks JWT, provides UserContext
    _authenticated/      # Protected routes (nested under auth layout)
  routeTree.gen.ts       # AUTO-GENERATED — never edit
prisma/
  schema.prisma          # Database schema
  seed.ts                # Seed script
  migrations/            # Migration files
```

### Authentication
- Cookie `j26-auth_access-token` contains a Keycloak JWT
- `src/lib/auth.ts`: `verifyAndGetUser(token)` verifies JWT against JWKS, returns `AppUser | null`
- `src/server/auth.ts`: `requireUser()` — call at the top of every mutating server function; throws `Response(401)` or `Response(403)` if auth fails
- Role-based access via `resource_access['j26-platsbank'].roles` in the JWT payload

### Server Functions Pattern
All server functions use `createServerFn` from `@tanstack/react-start`:
```ts
export const myFunction = createServerFn({ method: "POST" })
  .inputValidator((input: MyInput) => input)
  .handler(({ data }) => withLogging("myFunction", async () => {
    const user = await requireUser();
    // ... business logic
  }));
```
- GET for reads, POST for mutations
- Wrap handler body with `withLogging(name, fn)` from `#/server/utils` — it logs non-Response errors
- Auth errors are thrown as `new Response("message", { status: code })` — these are intentional and should not be logged

### Database
- Prisma 7 with PostgreSQL, using `@prisma/adapter-pg`
- Client singleton in `src/db.ts` — always `import { prisma } from "#/db"`
- In dev, the client is cached on `globalThis.__prisma` to survive HMR
- Models: `Request`, `RequestSignup`, `RequestBlock`
- `DATABASE_URL` env var required; local dev uses docker-compose for PostgreSQL on port 5432

### Routing
- TanStack Router with file-based routing
- `_authenticated.tsx` is a pathless layout — all protected routes live under `_authenticated/`
- `beforeLoad` in the auth layout calls `getUserStatus()` and provides `user` via route context
- Components access the user via `useUser()` (throws if outside auth layout) or `useOptionalUser()` (returns null)
- `routeTree.gen.ts` is auto-generated on `pnpm dev` — never edit it manually

### Styling
- Material-UI (MUI) v7 components — no custom CSS classes, use `sx` prop
- Theme: `src/theme.ts` (green primary #41a62a, light green secondary #a5d6a7)
- Roboto font loaded via `@fontsource/roboto`
- Date/time pickers: `@mui/x-date-pickers` with `dayjs` adapter and `sv` locale
- Base path: `/_services/platsbank` (configured in both vite.config.ts and router.tsx)

## Error Handling
- Server functions throw `new Response(message, { status })` for auth/permission errors (401, 403, 404)
- The `withLogging` wrapper in `src/server/utils.ts` catches and logs unexpected errors, re-throws Response objects silently
- Client-side: form submissions use try/catch with local error state; display Swedish error messages
- Route-level errors use TanStack Router's `errorComponent`

## Environment
- Package manager: **pnpm** (not npm/yarn)
- Node target: ES2022
- `.env.local` holds `DATABASE_URL` and other secrets — never commit this file
- Local dev requires Docker for PostgreSQL: `docker-compose up`
