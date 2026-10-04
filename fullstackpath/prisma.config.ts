import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Load environment variables for the Prisma CLI.
 *
 * Next.js loads `.env.local` automatically but the Prisma CLI does not, so both
 * files are loaded explicitly here. `.env.local` wins because it is the file
 * developers edit; `.env` holds shared defaults.
 */
for (const file of [".env", ".env.local"]) {
  loadEnv({ path: path.join(process.cwd(), file), override: false });
}

/**
 * Prisma CLI commands always open a direct (non-pooled) connection, so they use
 * DIRECT_URL when present and fall back to DATABASE_URL.
 *
 * At runtime the application uses DATABASE_URL through a driver adapter — see
 * src/lib/db/prisma.ts.
 */
const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directUrl,
  },
});