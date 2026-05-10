// In-memory token bucket rate limiter. Used to throttle Anthropic API calls
// per-user and globally so a runaway client can't burn through budget in
// minutes.
//
// Caveat: in serverless deployments the buckets are per-instance. For
// production-grade quotas under multiple Vercel instances, swap the in-memory
// Map for Vercel KV / Upstash Redis. This implementation is sufficient as a
// safety net for the single-tenant deployment model.

interface Bucket {
  tokens: number;
  capacity: number;
  refillPerSec: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

function refill(b: Bucket, nowMs: number) {
  const elapsedMs = nowMs - b.lastRefillMs;
  if (elapsedMs <= 0) return;
  b.tokens = Math.min(b.capacity, b.tokens + (elapsedMs / 1000) * b.refillPerSec);
  b.lastRefillMs = nowMs;
}

/**
 * Try to consume one request from the bucket identified by `key`. Returns
 * true if allowed, false if throttled. Defaults: capacity=20 requests,
 * refill 0.33/sec (≈ 20/min). Override per call as needed.
 */
export function tryConsume(
  key: string,
  opts: { capacity?: number; refillPerSec?: number } = {},
): boolean {
  const capacity = opts.capacity ?? 20;
  const refillPerSec = opts.refillPerSec ?? 20 / 60;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: capacity, capacity, refillPerSec, lastRefillMs: now };
    buckets.set(key, b);
  } else {
    refill(b, now);
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}

/** Throws if the rate limit was exceeded. Convenience for the common path. */
export function enforceRateLimit(
  key: string,
  opts: { capacity?: number; refillPerSec?: number } = {},
) {
  if (!tryConsume(key, opts)) {
    throw new RateLimitExceeded(key);
  }
}

export class RateLimitExceeded extends Error {
  constructor(key: string) {
    super(`Rate limit exceeded for ${key}`);
    this.name = "RateLimitExceeded";
  }
}
