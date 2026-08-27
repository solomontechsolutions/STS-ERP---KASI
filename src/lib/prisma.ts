import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRuntimeDatabaseUrl } from "@/lib/db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    // Throws with a message naming the variables to set. Without it `pg`
    // falls back to its own defaults and every query fails with
    // `ECONNREFUSED 127.0.0.1:5432`, which reads like a database outage
    // rather than the missing configuration it is.
    connectionString: getRuntimeDatabaseUrl(),
    // Serverless scales by adding instances, each with its own pool, so a
    // large per-instance pool exhausts Postgres' connection limit under
    // load. The pooled connection string is the real fix; this keeps a
    // single instance from doing the damage on its own.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
