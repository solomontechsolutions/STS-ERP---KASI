import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { getMigrationDatabaseUrl } from "./src/lib/db-url";

loadEnv({ path: ".env.local" });

// Migrations need a DIRECT (session-mode) connection, not the pooled one the
// app uses at runtime — transaction pooling does not hold a session across
// statements, which migrations need for advisory locks and DDL.
//
// The datasource is attached only when a URL is available: `prisma generate`
// runs during the production build and needs no database, so a missing URL
// must not break the build. Commands that do connect fail with Prisma's own
// "datasource required" message instead.
const url = getMigrationDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: url ? { url } : undefined,
});
