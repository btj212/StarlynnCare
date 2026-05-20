import { Redis } from "@upstash/redis";

/**
 * Distributed fixed-window rate limit backed by Upstash Redis.
 * Audit findings H6 + M1.
 *
 * Behavior:
 *   - When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset
 *     (local dev, preview without the integration), the limiter is a no-op
 *     and `allow` returns true. Production must have both set.
 *   - INCR + EXPIRE on first hit gives a fixed window with eventual reset.
 *     For our PII-form surface (low volume, anti-abuse not anti-DoS) this
 *     is sufficient and cheaper than a sliding-window approximation.
 */

let cached: Redis | null | undefined;

function getRedis(): Redis | null {
  if (cached !== undefined) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cached = null;
    return null;
  }
  cached = new Redis({ url, token });
  return cached;
}

export type RateLimitResult = {
  allowed: boolean;
  /** Hits used so far in the current window. 0 if the limiter is a no-op. */
  count: number;
  /** Seconds until the window resets. Best-effort. */
  resetSec: number;
};

/**
 * Returns `allowed=false` when the caller has exceeded `max` requests in the
 * current `windowSec` window for `key`. Caller is expected to 429.
 *
 * Fails open on Redis errors — a temporary Redis outage must not break the
 * inquiry form for real families. The console.error makes the failure
 * visible.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true, count: 0, resetSec: windowSec };

  try {
    const k = `rl:${key}`;
    const count = await redis.incr(k);
    if (count === 1) await redis.expire(k, windowSec);
    return {
      allowed: count <= max,
      count,
      resetSec: windowSec,
    };
  } catch (err) {
    console.error("[rate-limit] Redis error — failing open:", err);
    return { allowed: true, count: 0, resetSec: windowSec };
  }
}

/** Best-effort client IP from forwarded headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
