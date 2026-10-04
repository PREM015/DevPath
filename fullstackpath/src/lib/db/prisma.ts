import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Single Prisma client instance for the whole application.
 *
 * Prisma ORM 7 requires a driver adapter. The adapter owns the connection pool,
 * so it must be created once per process and reused — creating a new adapter on
 * every request would exhaust the database's connection limit on serverless.
 *
 * Pool size is deliberately small (1 connection) because the app runs on Vercel
 * where every serverless instance gets its own client. A larger pool plus many
 * instances is what exhausts a hosted Postgres, so a pooler (Neon PgBouncer) is
 * used for runtime queries instead — see .env.example.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local before using the database.",
  );
}

const createClient = () => {
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 1),
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;