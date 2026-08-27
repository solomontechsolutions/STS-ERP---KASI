/**
 * Works out which Postgres connection string to use, from whatever the
 * hosting platform happens to provide.
 *
 * The Vercel <-> Supabase integration injects its own variables rather than
 * `DATABASE_URL`, so reading only `DATABASE_URL` means a correctly linked
 * project still deploys with no database. Reading the platform's names too
 * lets "link Supabase to Vercel" be the whole database setup.
 *
 * Two different connection strings are needed, and using the wrong one for
 * either job fails in a way that is hard to read:
 *
 * - Runtime queries want the POOLED url (Supavisor transaction mode, port
 *   6543). Serverless scales by adding instances, each opening its own
 *   connections, so unpooled runtime traffic exhausts Postgres.
 * - Migrations want the DIRECT / session-mode url (port 5432). Transaction
 *   pooling does not hold a session across statements, which migrations need
 *   for advisory locks and DDL.
 */

/** Vercel/Supabase names for the pooled string, best first. */
const RUNTIME_VARS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
] as const;

/** Vercel/Supabase names for the direct (session-mode) string, best first. */
const MIGRATION_VARS = [
  "DIRECT_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_URL",
] as const;

function firstConfigured(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

/**
 * Supabase presents a certificate signed by its own root CA. `pg` currently
 * reads `sslmode=require` with verify-full semantics, so it rejects that
 * chain with `SELF_SIGNED_CERT_IN_CHAIN` and the app cannot reach the
 * database at all.
 *
 * `uselibpqcompat=true` restores the standard libpq meaning of `require` —
 * encrypt the connection, but do not verify the CA — which is what the
 * Supabase-supplied connection string is asking for. The connection stays
 * encrypted either way.
 *
 * To verify the CA as well, set `sslmode=verify-full` and `sslrootcert` to
 * Supabase's root certificate; this function leaves such a URL untouched.
 */
export function normalizeConnectionString(url: string): string {
  if (/[?&]uselibpqcompat=/.test(url)) return url;
  if (!/[?&]sslmode=(require|prefer|verify-ca)(&|$)/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}uselibpqcompat=true`;
}

function describeMissing(names: readonly string[]): string {
  return (
    `Set ${names[0]} in the environment, or link a Postgres provider that ` +
    `supplies one of: ${names.join(", ")}. ` +
    `On Vercel: Project -> Settings -> Environment Variables, or add the ` +
    `Supabase integration under the Storage tab.`
  );
}

/** Pooled connection string for application queries. */
export function getRuntimeDatabaseUrl(): string {
  const url = firstConfigured(RUNTIME_VARS);
  if (!url) {
    throw new Error(`No database connection string found. ${describeMissing(RUNTIME_VARS)}`);
  }
  return normalizeConnectionString(url);
}

/** Direct/session-mode connection string for `prisma migrate`. */
export function getMigrationDatabaseUrl(): string | undefined {
  const url = firstConfigured(MIGRATION_VARS);
  return url ? normalizeConnectionString(url) : undefined;
}
