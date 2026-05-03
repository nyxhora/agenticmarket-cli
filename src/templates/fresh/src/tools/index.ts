import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEchoTool } from "./echo.js";

/**
 * Tool Registry
 *
 * Import your tools and register them here.
 * Each tool file exports a register function that takes the McpServer instance.
 *
 * Example:
 *   import { registerMyTool } from "./my-tool.js";
 *   registerMyTool(server);
 */
export function registerTools(server: McpServer): void {
  registerEchoTool(server);

  // Add your tools here:
  // registerMyTool(server);
}
