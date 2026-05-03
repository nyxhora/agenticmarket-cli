import process from "node:process";
import type { MiddlewareHandler } from "hono";

/**
 * Audit logger — structured logging for MCP tool calls.
 *
 * Records who-called-what for debugging & compliance.
 * Active in all environments (dev + production).
 *
 * Output (structured JSON per line):
 *   {"ts":"2026-05-03T14:32:01.123Z","method":"POST","path":"/mcp","ip":"203.0.113.42","status":200,"ms":12}
 *
 * In production, pipe stdout to your log aggregator (Datadog, Loki, CloudWatch).
 * In development, the devLogger middleware provides human-readable output instead.
 */
export function auditLogger(): MiddlewareHandler {
  const isProduction = process.env.NODE_ENV === "production";

  return async (c, next) => {
    // Only log in production — dev uses the colored devLogger
    if (!isProduction) return next();

    const start = performance.now();
    await next();
    const duration = Math.round(performance.now() - start);

    const entry = {
      ts: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      ip:
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
        c.req.header("x-real-ip") ??
        "unknown",
      status: c.res.status,
      ms: duration,
      requestId: c.res.headers.get("X-Request-ID") ?? undefined,
      sessionId: c.req.header("mcp-session-id") ?? undefined,
    };

    // Single-line JSON — compatible with all log aggregators
    console.log(JSON.stringify(entry));
  };
}
