import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetDataTool } from "./get-data.js";

/**
 * Tool Registry
 *
 * Import your API wrapper tools and register them here.
 * Each tool wraps one or more REST API endpoints as MCP tools.
 *
 * Example:
 *   import { registerListItemsTool } from "./list-items.js";
 *   registerListItemsTool(server);
 */
export function registerTools(server: McpServer): void {
  registerGetDataTool(server);

  // Add your tools here:
  // registerListItemsTool(server);
}
