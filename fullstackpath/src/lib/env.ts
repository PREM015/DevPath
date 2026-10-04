/**
 * Environment variable access.
 *
 * Everything the app reads from `process.env` goes through this module so that
 * a missing variable fails loudly and early instead of producing confusing
 * behaviour deep inside a query. Server-only: never import from a Client
 * Component.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

function optional(name: string, value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL", process.env.DATABASE_URL),
  AUTH_SECRET: required("AUTH_SECRET", process.env.AUTH_SECRET),
  AUTH_URL: optional("AUTH_URL", process.env.AUTH_URL),
  AUTH_GOOGLE_ID: optional("AUTH_GOOGLE_ID", process.env.AUTH_GOOGLE_ID),
  AUTH_GOOGLE_SECRET: optional("AUTH_GOOGLE_SECRET", process.env.AUTH_GOOGLE_SECRET),
  RESEND_API_KEY: optional("RESEND_API_KEY", process.env.RESEND_API_KEY),
  EMAIL_FROM: process.env.EMAIL_FROM ?? "noreply@fullstackpath.dev",
  APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  /** Emails are logged to the server console when no provider is configured. */
  EMAIL_TRANSPORT: (optional("RESEND_API_KEY", process.env.RESEND_API_KEY)
    ? "resend"
    : "console") as "resend" | "console",
} as const;