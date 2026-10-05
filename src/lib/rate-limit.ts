import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Per-client sliding-window limiter. IMPORTANT: state lives in the memory of one
 * isolate, so this is a first line of defence only. For real DoS protection also
 * add a Cloudflare Rate Limiting rule on the POST server-function routes.
 *
 * Import this module ONLY from inside server handlers (`await import(...)`),
 * never at the top of a file the browser bundle also imports.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function clientIdentity(): string {
  const forwarded = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-real-ip") ?? forwarded;
  return (ip ?? "unknown").slice(0, 64);
}

/** Throws a bilingual error once `limit` calls were made in `windowMs`. */
export function enforceRateLimit(
  scope: string,
  limit: number,
  windowMs: number,
  message = "محاولات كثيرة، حاول لاحقاً · Too many attempts, please try again later",
): void {
  const now = Date.now();
  const key = `${scope}:${clientIdentity()}`;

  // Bound memory: evict expired buckets first, then the oldest entry.
  if (buckets.size >= MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;
  if (current.count > limit) throw new Error(message);
}
