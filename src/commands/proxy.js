/**
 * src/commands/proxy.js
 * agenticmarket proxy <username>/<server-name>
 *
 * Runs as a local stdio MCP server.
 * Reads API key from ~/.agenticmarket/config.json at runtime.
 *
 * Architecture:
 *   1. Connect to the upstream AgenticMarket cloud worker via Streamable HTTP (SSE fallback)
 *   2. Fetch the upstream tool list
 *   3. Spin up a low-level MCP Server (no Zod required — raw JSON Schema passes through)
 *   4. Handle tools/list and tools/call locally, forwarding calls upstream
 *
 * Using the low-level Server instead of McpServer avoids the Zod schema
 * requirement that throws "expected a Zod schema or ToolAnnotations".
 */

import { Server }                        from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport }          from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client }                        from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport }            from "@modelcontextprotocol/sdk/client/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getApiKey, PROXY_BASE_URL }     from "../config.js";

export async function proxy(rawServerName) {
  const apiKey = getApiKey();

  if (!apiKey) {
    process.stderr.write(
      "[AgenticMarket] Not authenticated. Run: agenticmarket auth <api-key>\n"
    );
    process.exit(1);
  }

  const [username, server] = rawServerName.split("/");
  if (!username || !server) {
    process.stderr.write(
      "[AgenticMarket] Invalid format. Use: agenticmarket proxy <username>/<server-name>\n"
    );
    process.exit(1);
  }

  const upstreamUrl = `${PROXY_BASE_URL}/mcp/${username}/${server}`;
  process.stderr.write(`[AgenticMarket] Proxy started → ${upstreamUrl}\n`);

  // ── Step 1: Connect to upstream ─────────────────────────────────────────────
  const upstreamClient = new Client({
    name:    "agenticmarket-proxy",
    version: "1.0.0",
  });

  const makeHeaders = () => ({ "x-api-key": getApiKey() });

  // Try Streamable HTTP first, fall back to SSE
  let connected = false;

  try {
    const transport = new StreamableHTTPClientTransport(
      new URL(upstreamUrl),
      { requestInit: { headers: makeHeaders() } }
    );
    await upstreamClient.connect(transport);
    connected = true;
    process.stderr.write("[AgenticMarket] Connected via Streamable HTTP\n");
  } catch (err) {
    process.stderr.write(
      `[AgenticMarket] Streamable HTTP failed (${err.message}), trying SSE...\n`
    );
  }

  if (!connected) {
    try {
      const transport = new SSEClientTransport(
        new URL(upstreamUrl),
        { requestInit: { headers: makeHeaders() } }
      );
      await upstreamClient.connect(transport);
      connected = true;
      process.stderr.write("[AgenticMarket] Connected via SSE\n");
    } catch (err) {
      process.stderr.write(`[AgenticMarket] Failed to connect: ${err.message}\n`);
      process.exit(1);
    }
  }

  // ── Step 2: Fetch tool list from upstream ────────────────────────────────────
  let upstreamTools = [];
  try {
    const { tools } = await upstreamClient.listTools();
    upstreamTools = tools ?? [];
    process.stderr.write(`[AgenticMarket] Discovered ${upstreamTools.length} tool(s)\n`);
  } catch (err) {
    process.stderr.write(`[AgenticMarket] Failed to list tools: ${err.message}\n`);
    process.exit(1);
  }

  // ── Step 3: Create low-level MCP Server (accepts raw JSON Schema, no Zod) ───
  const localServer = new Server(
    { name: `agenticmarket/${server}`, version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Handle tools/list — return upstream tools verbatim
  localServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: upstreamTools.map((t) => ({
      name:        t.name,
      description: t.description ?? "",
      inputSchema: t.inputSchema ?? { type: "object", properties: {} },
    })),
  }));

  // Handle tools/call — forward to upstream
  localServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = upstreamTools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await upstreamClient.callTool({
        name,
        arguments: args ?? {},
      });
      return result;
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  // ── Step 4: Start stdio transport for the local MCP client ──────────────────
  const downstreamTransport = new StdioServerTransport();
  await localServer.connect(downstreamTransport);
  process.stderr.write("[AgenticMarket] Ready — waiting for requests\n");

  // Graceful shutdown
  const shutdown = async () => {
    await upstreamClient.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);
}