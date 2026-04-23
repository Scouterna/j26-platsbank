# j26-platsbank

A platsbank for Jamboree26. Users can post **requests** (tasks needing people) to coordinate staffing.

Built with TanStack Start (React + Nitro SSR), Material-UI, and Prisma.

## Prerequisites

- Node.js + [pnpm](https://pnpm.io/)
- Docker (for local PostgreSQL)

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Start the database**

   ```bash
   docker-compose up -d
   ```

3. **Configure environment**

   Create a `.env.local` file:

   ```bash
   cp .env.local.template .env.local
   ```

4. **Run migrations and seed**

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **Start the dev server**

   ```bash
   pnpm dev
   ```

   The app runs at [http://localhost:3000](http://localhost:3000).

## Authentication

Authentication requires the `j26-cli` dev tool. Install it globally:

```bash
npm install -g @scouterna/j26-cli
```

Then get a `.j26.local.yaml` config file from an admin and place it in the project root before starting the dev server.

To start the local dev environment, run `j26 up`. You'll then be able to access the application att https://local.j26.se/platsbank

## Database

| Command | Description |
|---|---|
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:push` | Push schema to DB without a migration file |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed the database |

After editing `prisma/schema.prisma`, always run `pnpm db:generate`.

## Other commands

```bash
pnpm build     # Production build
pnpm test      # Run tests (Vitest)
pnpm lint      # Lint with Biome
pnpm format    # Format with Biome
pnpm check     # Lint + format combined
```
