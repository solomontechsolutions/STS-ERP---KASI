# KASI — project notes

Working notes for whoever (human or Claude Code session) picks this project
up next. The full business/domain brief this project was built from lives
in the conversation history that kicked it off; this file tracks build
status and the decisions made along the way, not the whole brief.

## Status: Phase 2 (architecture) complete, Phase 3 (foundation) well underway

Built and working (verified with `npx tsc --noEmit`, `npx eslint .`, and
`npx next build`, all clean):

- Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4 with STS brand
  tokens (`src/app/globals.css`), Space Grotesk / Inter / JetBrains Mono.
- Postgres via Prisma 7, config-first (`prisma.config.ts`) with the
  `@prisma/adapter-pg` driver adapter — Prisma 7 removed `url` from
  `schema.prisma`'s datasource block, this is not a mistake if you see it
  missing.
- RBAC data model: composable `Role` → `Permission` (module × verb) bundles,
  `UserRole` join, defined in `src/lib/rbac.ts`. Enforcement helper in
  `src/lib/permissions.ts`. This is coarse-grained (does this user's role
  bundle grant this verb on this module at all); row-level scoping (e.g. an
  Employee seeing only their own HR record) still needs to be added at each
  module's query layer when that module is built.
- Auth.js v5, Credentials provider, bcrypt, JWT sessions, forced
  password-reset-on-first-login flow (`src/app/reset-password`).
  `src/proxy.ts` (not `middleware.ts` — renamed in Next.js 16) guards all
  routes except `/login`.
- Append-only audit log (`AuditLog` model + `src/lib/audit.ts`). Only
  `recordAudit()` should ever write to it — wired into the password-reset
  flow as the first real usage; not yet wired into anything else.
- Sidebar nav (`src/lib/nav.ts`, `src/components/layout/`) grouped per the
  brief's Section 13.1, filtered per-user by `module:view` permission.
  Every nav item routes to a real page — modules not yet built render an
  honest "not built yet" empty state (`ModulePlaceholder`), never fake data.
- Seed script (`prisma/seed.ts`): Company record, all 6 baseline roles, and
  the 9 confirmed initial users linked to their Director/Shareholder/
  Employee identity records. Re-runnable — skips anything that already
  exists. Prints one-time temp passwords to console only.
- **Documents**: generic polymorphic `Document` model, a swappable
  `StorageAdapter` interface (`src/lib/storage.ts`) with a dev-only
  local-disk implementation, an authenticated download/preview route
  (`/api/documents/[id]`), and reusable `DocumentList`/`UploadForm`
  components. Documents inherit the sensitivity of the record they're
  attached to via `moduleForEntity()` in `src/lib/documents.ts`.
- **Employees** (`/people/employees`, `/people/employees/[id]`): the first
  real business-data module. Real row-level scoping — not just the coarse
  module+verb check — so an Employee-role user only ever sees their own
  record (`src/lib/hr.ts`), and salary is gated by a separate
  `hr_compensation:view` grant, or by it being your own record
  (`canViewCompensation`). Documents (contract, ID, etc.) upload/preview
  through the generic Document system above. This module is the "proof of
  the pattern" end-to-end wiring the brief asked for in Phase 3: permission
  gate → row-level scope → document evidence → audit log.
- **Company settings** (`/settings/company`): BRELA/TRA registration fields
  shown read-only (changing them is a real legal filing event, not a UI
  edit); administrative fields (trading name, registered office, P.O. Box,
  tax office, accounting reference date) are editable by `settings:edit`
  holders (currently: directors) via a server action that writes an audit
  entry with before/after values.
- **Users & Access** (`/settings/access`): table of all users with their
  role bundles as togglable checkboxes (`AccessTable`) — grant/revoke is a
  server action gated by `settings:edit`, audit-logged, and blocks a user
  from deactivating their own account. Role *definitions* (which
  module/verb grants each role bundle carries) are still only editable by
  changing `src/lib/rbac.ts` and re-seeding — no UI for authoring custom
  roles yet.

**Not yet built:** anything from Phase 4 onward (finance/accounting,
banking reconciliation, payroll, assets, inventory, sales, purchasing,
projects, approval engine), Phase 5 governance record-keeping (resolutions/
minutes — note Directors/Shareholders identity records already exist from
the seed, just no UI or resolution/minute tracking yet), Phase 6
integrations (email/SMS/WhatsApp), the global Cmd+K search, and a UI for
authoring custom roles (only assigning the 6 seeded ones is supported).

## Blocking on: a real Postgres connection string

Nothing has been migrated or seeded against a real database yet — there's
no local Postgres/Docker on this machine. `.env.local` currently holds a
placeholder `DATABASE_URL` (present only so `prisma validate`/`generate`
don't choke on missing env vars) and a placeholder `AUTH_SECRET`. Before
anyone can actually log in:

1. Provision a Postgres database (Neon or Supabase, per the brief's stack
   recommendation) and put its connection string in `.env.local`.
2. `npx auth secret` to generate a real `AUTH_SECRET`.
3. `npm run db:migrate` then `npm run db:seed`.
4. Sign in with one of the printed temp passwords and confirm the forced
   reset flow works end to end in a browser — this has not been visually
   verified yet, only build/typecheck-verified.

## Phase 1 decisions made (2026-08-26)

Resolved directly with the user:

| Question | Decision |
|---|---|
| Registered office | BRELA filing address: Plot 406, Block 4, Longido Street, Upanga Mashariki, Ilala CBD, Dar es Salaam (not the "TAN RE House" address from the management accounts) |
| Incorporation date | 25 Feb 2026 (BRELA certificate date, not the 24 Feb date in the management accounts) |
| Finance permission bundle | Both Allan Silas Kisute **and** Mathias Silas Kisute hold it |
| Email domain | solomontechsolutions.com, for both login and outbound mail |
| Ledger opening | TZS 0 at incorporation (25 Feb 2026); Feb–Jun 2026 transaction history gets imported/re-entered rather than seeding a snapshot opening balance at 21 Jun 2026. **Not yet implemented** — no accounting module exists yet (Phase 4). When it's built, do not seed the Section 9.2 opening trial balance as a shortcut; build the real Feb–Jun import path first. |

Proceeding on the brief's own recommended defaults for everything else in
its gaps list (still open, flag again before the relevant phase lands):

- `mj@solomontechsolutions.com`'s role → seeded as `management_admin`, no
  governance access, pending confirmation of his actual function.
- Numberz Group Ltd → not modeled as parent/subsidiary.
- "Tanzanite" entity → out of scope, not seeded anywhere.
- No directors seeded onto payroll — only Novatus is an Employee record.
- No amber/gold in ERP chrome — palette is strictly navy/charcoal/cyan/teal
  (`src/app/globals.css`). KASI-WIFI's amber (#F4B740) is deliberately
  excluded to avoid the two products being visually confused.
- Double-entry: schema is set up so every financial table can eventually
  hang off `journal_entries`/`journal_lines` (not yet created), but no
  decision has been forced yet since no financial module exists.
- Cambium radio quantities → not seeded (source material itself says
  quantities were unconfirmed).

## Things worth knowing before you touch this again

- **Prisma 7 is config-first.** Connection URL lives in `prisma.config.ts`,
  not `schema.prisma`. Runtime `PrismaClient` needs the `@prisma/adapter-pg`
  driver adapter passed explicitly (see `src/lib/prisma.ts` and
  `prisma/seed.ts`) — `new PrismaClient()` with no adapter will not connect.
- **`deepmerge-ts` override in `package.json`** pins a transitive dependency
  of the `prisma` CLI to a patched version (a stack-exhaustion advisory).
  Don't remove it without checking `npm audit` stays clean.
- **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** If you're used to
  older Next.js conventions, read `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
  before assuming old patterns still apply — several file conventions and
  APIs changed (async `params`/`searchParams`, `next lint` removed in favor
  of the ESLint CLI directly, etc.).
- **zod is v4**, not v3 — check current API before assuming v3 patterns.
- RBAC roles are composable bundles a user can hold more than one of at
  once (e.g. Mathias holds `director` + `company_secretary` + `finance`).
  Don't refactor this into a single-role-per-user model — it's deliberate
  (Section 6 of the brief), matching how STS's real governance works.
- **`src/lib/storage.ts`'s local-disk adapter writes to `./.data/uploads/`
  and only works because there's a persistent filesystem in local dev.**
  It will silently lose every uploaded file on Vercel (ephemeral,
  per-invocation filesystem). Swap in an S3-compatible or Vercel Blob
  adapter implementing the same `StorageAdapter` interface before deploying
  anywhere except a machine with persistent local disk.
- Row-level HR scoping (`src/lib/hr.ts`) infers "broad HR access" from
  holding any `hr` verb beyond `view` — this is a proxy, not a first-class
  concept. If you add a role that should have broad HR visibility with
  view-only-shaped permissions, it won't be picked up automatically; check
  `hasBroadHrAccess()` when you add roles.
