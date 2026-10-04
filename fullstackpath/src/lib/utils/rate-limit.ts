import "server-only";

/**
 * In-process sliding-window rate limiter.
 *
 * This is intentionally dependency-free: the platform must work without paid
 * infrastructure. The trade-off is that the counters live in the memory of a
 * single server instance, so a burst spread across many instances can exceed
 * the limit. That is acceptable for the abuse cases it guards (login
 * brute-forcing, form spam) and is documented rather than hidden.
 *
 * Endpoints that must be protected regardless of instance count (password
 * reset, email verification) additionally enforce a database-backed limit.
 */

type Bucket = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as {
  __fspRateLimits?: Map<string, Bucket>;
};

const store = globalForLimiter.__fspRateLimits ?? new Map<string, Bucket>();
globalForLimiter.__fspRateLimits = store;

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix ms at which the window resets. */
  resetAt: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    store.set(key, fresh);
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: fresh.resetAt,
      retryAfterSeconds: 0,
    };
  }

  bucket.count += 1;
  store.set(key, bucket);

  return {
    success: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Best-effort client identity from proxy headers. */
export function clientKey(request: Request, scope: string): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 10 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  forgotPassword: { limit: 5, windowMs: 60 * 60 * 1000 },
  verifyEmail: { limit: 10, windowMs: 60 * 60 * 1000 },
  mutation: { limit: 120, windowMs: 60 * 1000 },
  search: { limit: 120, windowMs: 60 * 1000 },
} as const;

/** Removes expired buckets so the map cannot grow without bound. */
export function sweepRateLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}