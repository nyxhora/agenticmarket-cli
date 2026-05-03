import process from "node:process";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { securityMiddleware } from "./middleware/security.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { registerTools } from "./tools/index.js";

// ── App Setup ──────────────────────────────────────────────────────────────────

const app = new Hono();

// Apply security middleware to all routes
app.use("*", securityMiddleware());
app.use("*", rateLimitMiddleware());

// ── Health Endpoint ────────────────────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    server: "e2e-server",
    timestamp: new Date().toISOString(),
  });
});

// ── MCP Transport ──────────────────────────────────────────────────────────────
// Each session gets its own McpServer + transport instance.
// The mcp-session-id header tracks sessions across requests.

const sessions = new Map<
  string,
  { server: McpServer; transport: StreamableHTTPServerTransport }
>();

/**
 * Create a new MCP server + transport pair and register tools.
 */
function createSession(): {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
} {
  const server = new McpServer({
    name: "e2e-server",
    version: "1.0.0",
  });

  registerTools(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  return { server, transport };
}

// POST /mcp — main MCP request handler (initialize, tool calls, etc.)
app.post("/mcp", async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  const { req, res } = toReqRes(c.req.raw);

  let session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    // New session — create server + transport, connect them
    session = createSession();
    await session.server.connect(session.transport);

    // Store session once transport assigns an ID
    const assignedId = session.transport.sessionId;
    if (assignedId) {
      sessions.set(assignedId, session);
    }
  }

  await session.transport.handleRequest(req, res);

  res.on("close", () => {
    // If this was the final message, the transport will have closed
    if (session && session.transport.sessionId) {
      const sid = session.transport.sessionId;
      if (!sessions.has(sid)) return;
      // Keep session alive — transport handles lifecycle
    }
  });

  return toFetchResponse(res);
});

// GET /mcp — SSE stream for server-to-client notifications
app.get("/mcp", async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  if (!sessionId || !sessions.has(sessionId)) {
    return c.json({ error: "No active session. Send a POST first." }, 400);
  }

  const session = sessions.get(sessionId)!;
  const { req, res } = toReqRes(c.req.raw);
  await session.transport.handleRequest(req, res);
  return toFetchResponse(res);
});

// DELETE /mcp — close a session
app.delete("/mcp", async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.close();
    await session.server.close();
    sessions.delete(sessionId);
  }
  return c.json({ status: "session closed" });
});

// ── Start Server ───────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`\n  ✦ e2e-server running on http://localhost:${port}`);
  console.log(`  ├─ Health:  http://localhost:${port}/health`);
  console.log(`  └─ MCP:     http://localhost:${port}/mcp\n`);
});
