/**
 * Applies pending database migrations during the build, but only once a
 * database is actually attached.
 *
 * A brand-new Vercel project has no database yet — you cannot attach one
 * until the project exists, and the project does not exist until a build has
 * succeeded. Running `prisma migrate deploy` unconditionally deadlocks that:
 * the first build fails for the want of a database that cannot be added yet.
 *
 * So a missing connection string is not an error here — it is the expected
 * state of a first deploy. Skip, and let attaching the database trigger the
 * redeploy that runs the migrations.
 *
 * A connection string that IS set and does not work is a real failure and
 * fails the build, which leaves the last working deployment serving traffic
 * rather than replacing it with one whose tables are missing.
 */
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

// Any of these means a database is attached; src/lib/db-url.ts decides which
// one is used for what.
const CONNECTION_VARS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
];

const attached = CONNECTION_VARS.some(
  (name) => (process.env[name] ?? "").trim().length > 0,
);

if (!attached) {
  console.log(
    [
      "",
      "  No database is attached yet — skipping migrations.",
      "",
      "  The build will finish and the site will deploy, but any page that",
      "  reads data will show an error until a database is connected.",
      "",
      "  Next: attach Postgres (Vercel -> Storage tab -> Supabase). That",
      "  redeploys automatically, and this step then creates the tables.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const result = spawnSync("prisma", ["migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
