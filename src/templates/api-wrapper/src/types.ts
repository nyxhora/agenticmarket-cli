import process from "node:process";

/**
 * Shared types for __PROJECT_NAME__
 */

/** Tool result content item */
export interface ToolContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

/** Standard tool return shape */
export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

/** Server configuration from environment */
export interface ServerConfig {
  port: number;
  mcpSecret: string;
  nodeEnv: "development" | "production";
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

/** Load config from environment */
export function loadServerConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT ?? "3000", 10),
    mcpSecret: process.env.MCP_SECRET ?? "",
    nodeEnv: (process.env.NODE_ENV ?? "development") as "development" | "production",
    corsOrigins: (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  };
}
