/**
 * CLI entry point for the foundation seed: `npm run db:seed`.
 *
 * The seeding itself lives in src/lib/seed.ts so the one-time setup route
 * creates identical data. This wrapper only loads the environment, opens a
 * connection, and prints the result.
 *
 * Temporary passwords are printed ONLY to this script's console output —
 * never written to a file, never committed (Section 4's instruction).
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRuntimeDatabaseUrl } from "../src/lib/db-url";
import { runSeed } from "../src/lib/seed";

const adapter = new PrismaPg({ connectionString: getRuntimeDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

runSeed(prisma)
  .then(({ log, credentials }) => {
    for (const line of log) console.log(line);

    if (credentials.length === 0) {
      console.log("\nNo new users — everything was already seeded.");
      return;
    }

    console.log("\n=== TEMPORARY PASSWORDS (shown once — not stored anywhere) ===");
    for (const c of credentials) {
      console.log(`${c.email}  ${c.password}`);
    }
    console.log("=== Deliver these out-of-band and ask each user to sign in and reset. ===\n");
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
