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

## Boardroom, collections, notifications and meetings

### Selcom collections (`/finance/collections`)

Live view of every payment collected through Selcom: today, 7 days, month,
per-channel totals, a 14-day chart and the latest orders. The page refreshes
itself every 15 seconds. Visible to holders of `banking:view` or
`sales_subscriber:view`.

1. Set `SELCOM_API_KEY` and `SELCOM_API_SECRET` (the billing system's own).
2. Real time: Selcom sends each payment callback to the `webhook` URL the
   billing system gives when it creates the order. Have the billing system
   **forward each callback unchanged** (same JSON body and the `Digest`,
   `Timestamp` and `Signed-Fields` headers) to
   `https://<kasi-domain>/api/integrations/selcom/webhook`. KASI verifies
   Selcom's signature with the shared secret. If the billing system reshapes
   the payload instead, send it with header `X-KASI-Relay-Token:
   <SELCOM_RELAY_TOKEN>`.
3. Safety net: the scheduled tick (below) pulls Selcom's `list-orders` for
   the last day, so a missed callback shows up within minutes. "Sync with
   Selcom now" on the page imports up to 90 days, which is how past
   collections are loaded the first time.

### Boardroom (`/boardroom`)

Open to anyone with a Director or Shareholder record (all eight founders),
not controlled by roles.

- **Founder agreements**: loyalty and fiduciary undertaking, NDA,
  non-compete and non-solicitation, board secrecy, conflict of interest.
  Signing needs the typed full name, a drawn signature and the account
  password. KASI stores the signature image, IP, device and a SHA-256
  fingerprint of the exact text signed. Edits publish a new version and
  everyone signs again. **The version 1 wording is a draft: have it reviewed
  by the company's advocate and publish the approved text before relying on
  it.**
- **Decisions and votes**: board resolutions (one vote per director) and
  shareholder resolutions (weighted by shareholding, so the 65% holder
  carries 65 of 100). Thresholds: simple majority, 75% special, unanimous.
  Counted against all voting rights, not just votes cast. Every founder sees
  every decision, each vote and the discussion. Votes are final and
  audit-logged.

### Meetings (`/meetings`)

Video meetings inside KASI via the Jitsi IFrame API. Board and
shareholders' meetings invite all founders automatically. Attendance is
recorded when people join; the organiser records minutes afterwards.
For confidential board business configure 8x8 JaaS (`JAAS_*`) or a
self-hosted Jitsi with token auth (`JITSI_*`). With neither, rooms are
protected only by their random names and KASI shows a warning.

### Phone notifications (`/notifications`)

In-app inbox plus Web Push. Generate VAPID keys once
(`npx web-push generate-vapid-keys`) and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
and `VAPID_PRIVATE_KEY`. Each person then taps "Enable notifications" on
each device. Android: works in Chrome directly. iPhone/iPad (iOS 16.4+):
open KASI in Safari, Share, Add to Home Screen, open it from the home
screen, then enable. The page walks people through this.

### Scheduled jobs

`/api/cron/tick` (Selcom sync, closing decisions past deadline, meeting
reminders 15 minutes ahead) should run every 5 to 15 minutes with
`Authorization: Bearer <CRON_SECRET>`. Vercel Hobby only allows daily cron,
so `.github/workflows/kasi-tick.yml` runs it every 10 minutes from GitHub:
add repository secrets `KASI_URL` and `CRON_SECRET`. Pages also close
expired decisions when viewed, so results are right even without a
scheduler; only reminders and Selcom back-fill depend on it.

### Icons

`node scripts/generate-icons.mjs` regenerates `public/icons/`.
