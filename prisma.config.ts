import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv({ path: ".env.local" });

// `prisma generate` runs during the production build (e.g. on Vercel) where a
// database URL is neither present nor needed — only migration/introspection
// commands connect. Attach the datasource lazily so a missing DATABASE_URL
// fails those commands with Prisma's own message instead of breaking the build.
const datasource = process.env.DATABASE_URL
  ? { url: env("DATABASE_URL") }
  : undefined;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource,
});
