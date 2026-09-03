/**
 * A small in-process rate limiter for public endpoints — the ones with no
 * session to count against, where the only handle is the caller's address.
 *
 * Deliberately in memory. Ajour runs as one container behind one proxy, so
 * one process is the whole installation and a shared store would be a
 * dependency bought for nothing. The honest limits of that: the counters
 * reset when the app restarts, and an installation that is ever scaled to
 * several instances gets a limit per instance rather than a limit. If that
 * day comes, this is the one file to replace, and the call sites do not
 * change.
 *
 * The authenticated surface does not use this: model calls are counted in
 * the database per user and per workspace (see modules/ai/limits.ts), and
 * Better Auth rate-limits its own endpoints.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Drops expired buckets now and then, so a long-running process stays flat. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

export type RateLimit = { allowed: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimit {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit)
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * The caller's address as the proxy reports it. Trusting a header is only
 * sound behind a proxy that sets it, which is how Ajour is deployed; with
 * no header the whole installation shares one bucket, which fails closed
 * rather than open.
 */
export function callerKey(headers: Headers, prefix: string): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${prefix}:${forwarded || headers.get("x-real-ip") || "unknown"}`;
}

/** Only for tests: forget every bucket. */
export function resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}
