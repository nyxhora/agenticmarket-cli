import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Echo Tool — reference implementation
 *
 * Shows the correct pattern for building MCP tools:
 *   1. Zod schema for input validation
 *   2. Description for AI agent discovery
 *   3. Structured return with content array
 *
 * Duplicate this file to create new tools, then register in tools/index.ts.
 */
export function registerEchoTool(server: McpServer): void {
  server.tool(
    // Tool name — use snake_case
    "echo",

    // Description — helps AI agents decide when to use this tool
    "Echoes back the provided message. Use this to test that the server is working.",

    // Input schema — Zod validates before your handler runs
    {
      message: z.string().describe("The message to echo back"),
    },

    // Handler — receives validated input, returns MCP content
    async ({ message }) => {
      return {
        content: [
          {
            type: "text" as const,
            text: `Echo: ${message}`,
          },
        ],
      };
    },
  );
}
