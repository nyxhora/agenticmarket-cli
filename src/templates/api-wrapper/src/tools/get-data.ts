import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient, ApiClientError } from "../lib/api-client.js";

/**
 * Get Data Tool — example API wrapper tool
 *
 * Demonstrates the pattern for wrapping a REST API endpoint as an MCP tool:
 *   1. Zod schema for input validation
 *   2. apiClient call with proper error handling
 *   3. MCP-formatted response
 *
 * Duplicate this file for each endpoint you want to expose.
 */
export function registerGetDataTool(server: McpServer): void {
  server.tool(
    // Tool name — use snake_case
    "get_data",

    // Description — helps AI agents understand when to use this tool
    "Fetches data from the API. Replace this with your actual endpoint description.",

    // Input schema — Zod validates before your handler runs
    {
      query: z.string().describe("Search query or identifier"),
    },

    // Handler — receives validated input, calls API, returns MCP content
    async ({ query }) => {
      try {
        const data = await apiClient.get("__EXAMPLE_ENDPOINT__", {
          q: query,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? `API Error (${err.statusCode}): ${err.message}`
            : `Unexpected error: ${err instanceof Error ? err.message : "Unknown"}`;

        return {
          content: [
            {
              type: "text" as const,
              text: message,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
