# KASI

Internal operating system for Solomon Tech Solutions Limited (STS). See
`PROJECT_NOTES.md` for the full build brief context, phase status, and open
decisions — read that before making structural changes.

## Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
· Auth.js v5 (Credentials + JWT sessions) · Tailwind CSS v4 · Zod v4

## Getting started

1. Copy `.env.example` to `.env.local` and fill in a real Postgres connection
   string (e.g. from Neon or Supabase) and an `AUTH_SECRET`
   (`npx auth secret`).
2. Install dependencies: `npm install`
3. Apply the schema: `npm run db:migrate`
4. Seed the company record, RBAC roles, and the nine initial users:
   `npm run db:seed` — this prints each user's one-time temporary password
   to the console. Deliver these out-of-band; nothing is written to disk.
5. `npm run dev` and sign in at `/login`. First login forces a password
   reset (`/reset-password`).

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint`
- `npm run db:migrate` — `prisma migrate dev`
- `npm run db:seed` — re-runnable; skips users/company that already exist
- `npm run db:studio` — Prisma Studio

## Project layout

- `prisma/schema.prisma` — foundation schema (auth/RBAC, company, director/
  shareholder/employee identity, generic documents, append-only audit log).
  Business-module tables (finance, assets, payroll, sales, etc.) are added
  in later phases.
- `prisma.config.ts` — Prisma 7 config-first datasource (connection URL for
  Migrate lives here, not in `schema.prisma`).
- `src/auth.ts` / `src/proxy.ts` — Auth.js config and route protection.
  Next.js 16 renamed `middleware.ts` to `proxy.ts`.
- `src/lib/rbac.ts` — the seeded permission bundles (Section 6 of the brief).
- `src/lib/nav.ts` — sidebar navigation, gated per-module by permission.
- `src/app/(app)/` — the authenticated shell. Most module pages are stub
  "not built yet" screens until their phase lands — see `PROJECT_NOTES.md`.
