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

## Web address: erp.solomontechsolutions.com

The company website stays on cPanel at solomontechsolutions.com. KASI runs
on Vercel under a subdomain of the same domains:

| Address | What it does |
|---|---|
| `erp.solomontechsolutions.com` | KASI (the main address) |
| `erp.solomontechsolutions.co.tz` | Redirects to the address above |

1. **Vercel**, Project, Settings, Domains: add `erp.solomontechsolutions.com`,
   then add `erp.solomontechsolutions.co.tz` and set it to redirect to the
   first one. Vercel shows a CNAME target for each.
2. **cPanel**, Domains, Zone Editor, `solomontechsolutions.com`, Manage,
   Add Record: type `CNAME`, name `erp`, record = the target Vercel showed
   (for example `cname.vercel-dns.com.`). Repeat under
   `solomontechsolutions.co.tz`. Do not touch the existing `@`, `www` or
   mail records: they keep the website and email working.
3. Wait for Vercel to show both domains as valid (usually minutes, up to a
   few hours), then set `KASI_CANONICAL_HOST=erp.solomontechsolutions.com`
   in Vercel and redeploy. Vercel issues the HTTPS certificates itself.

If the domain's DNS is not managed in cPanel (the Zone Editor has no
records), add the same CNAME records wherever the nameservers point, for
.co.tz usually the registrar's panel.

## Boardroom, revenue reports, notifications and meetings

### Revenue reports (`/finance/reports`)

A read-only report of payments customers made through Selcom: revenue for
any period (today, 7 or 30 days, this or last month, this year, or custom
dates), average payment, best day, failed and pending payments, a chart,
a daily or monthly breakdown, and a split by payment channel. Export to CSV
or print to PDF. Visible to holders of `banking:view` or
`sales_subscriber:view`.

How it works: BillNasi creates every Selcom payment and receives Selcom's
confirmations, exactly as today. KASI uses the same Selcom API key and
secret to READ the account's order list (Selcom `checkout/list-orders`)
and keeps a copy for reporting. Nothing changes in BillNasi and no money
moves through KASI.

1. Set `SELCOM_API_KEY` and `SELCOM_API_SECRET` (the values in BillNasi,
   Settings, Payment Gateway).
2. Open Finance, Revenue reports and use "Refresh from Selcom" with
   "12 months" once to load history.
3. The scheduled tick (below) reads new orders every 10 minutes after that.

### Boardroom (`/boardroom`)

Open to anyone with a Director or Shareholder record (all eight founders),
not controlled by roles.

- **Founder agreements**: loyalty and fiduciary undertaking, NDA,
  non-compete and non-solicitation, board secrecy, conflict of interest,
  laid out as formal documents (Times New Roman 12 pt, justified, numbered
  clauses, execution block) that print to A4 PDF. Signing needs the typed
  full name, a drawn signature and the account password. KASI stores the
  signature image, IP, device and a SHA-256 fingerprint of the exact text
  signed. Edits publish a new version and everyone signs again; published
  wording is checked for em-dashes and double spaces. Have the standard
  wording reviewed by the company's advocate before relying on it.
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

### Face ID, fingerprint and app lock (`/settings/security`)

Everyone can set up passkeys: sign in with Face ID, Touch ID, Android
fingerprint or face unlock, Windows Hello or the device PIN, instead of the
password. KASI stores only a public key (WebAuthn, via
`@simplewebauthn/server`); biometrics never leave the device. The same check
confirms founder agreement signatures, and powers an optional per-device
app lock (lock immediately or after 1, 5, 15 or 60 minutes away). The page
also shows and tests the device's permissions: notifications, camera and
microphone for meetings, whether KASI is installed.

Passkeys are tied to `KASI_CANONICAL_HOST`; set it before people register.

### Install prompt

Visitors on a phone or tablet browser see an "Install KASI" sheet, on the
login page too: a one-tap install on Android, and the Share, Add to Home
Screen steps on iPhone. "Not now" hides it for a week.

### Phone notifications (`/notifications`)

In-app inbox plus Web Push. Generate VAPID keys once
(`npx web-push generate-vapid-keys`) and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
and `VAPID_PRIVATE_KEY`. Each person then taps "Enable notifications" on
each device. Android: works in Chrome directly. iPhone/iPad (iOS 16.4+):
open KASI in Safari, Share, Add to Home Screen, open it from the home
screen, then enable. The page walks people through this.

### Web and phone preview (`/simulator`)

Shows the live app on the deployment at desktop size and at phone size side
by side, both signed in as you. Navigate in either; with "Linked" on the
other follows. Every update pushed to `master` appears once deployed.
"Test on the phone" plays the iPhone and Android install prompts, the app
lock screen and a test notification inside the phone frame, and "Every
area" lists each page you can reach and ticks it off once opened.

### Scheduled jobs

`/api/cron/tick` (reading new Selcom orders, closing decisions past deadline, meeting
reminders 15 minutes ahead) should run every 5 to 15 minutes with
`Authorization: Bearer <CRON_SECRET>`. Vercel Hobby only allows daily cron,
so `.github/workflows/kasi-tick.yml` runs it every 10 minutes from GitHub:
add repository secrets `KASI_URL` and `CRON_SECRET`. Pages also close
expired decisions when viewed, so results are right even without a
scheduler; only reminders and automatic Selcom reads depend on it.

### Icons

`node scripts/generate-icons.mjs` regenerates `public/icons/`.
