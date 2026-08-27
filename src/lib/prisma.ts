import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Without this, `pg` silently falls back to its own defaults and every
    // query fails with `ECONNREFUSED 127.0.0.1:5432`, which reads like a
    // database outage rather than the missing environment variable it is.
    throw new Error(
      "DATABASE_URL is not set. Add it to the environment (Vercel: Project → Settings → Environment Variables) before starting the app.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    // Serverless scales by adding instances, each with its own pool, so a
    // large per-instance pool exhausts Postgres' connection limit under load.
    // Point DATABASE_URL at a pooler (PgBouncer, Neon/Supabase pooled URL)
    // for the real fix; this keeps a single instance from doing the damage.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
