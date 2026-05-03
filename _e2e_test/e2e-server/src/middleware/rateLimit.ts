import process from "node:process";
import type { MiddlewareHandler } from "hono";

/**
 * Per-IP in-memory sliding window rate limiter.
 *
 * Defaults: 100 requests per 60 seconds.
 * Configure via env: RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS
 */

interface RateEntry {
  timestamps: number[];
}

const store = new Map<string, RateEntry>();

// Cleanup stale entries every 5 minutes.
// .unref() ensures this timer doesn't prevent process exit.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);
  for (const [ip, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) store.delete(ip);
  }
}, 5 * 60 * 1000);
cleanupTimer.unref();

export function rateLimitMiddleware(): MiddlewareHandler {
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10);
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);

  return async (c, next) => {
    // Skip rate limiting for health checks
    if (c.req.path === "/health") {
      return next();
    }

    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";

    const now = Date.now();
    let entry = store.get(ip);

    if (!entry) {
      entry = { timestamps: [] };
      store.set(ip, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= maxRequests) {
      const retryAfter = Math.ceil(
        (entry.timestamps[0] + windowMs - now) / 1000,
      );
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: "Too many requests",
          retryAfterSeconds: retryAfter,
        },
        { status: 429 },
      );
    }

    entry.timestamps.push(now);
    await next();
  };
}
