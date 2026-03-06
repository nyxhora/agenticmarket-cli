/**
 * src/config.js — manages local config + finds IDE MCP config files
 *
 * Saves to: ~/.agenticmarket/config.json
 * Reads MCP configs from: Claude Desktop, Cursor, VS Code
 */

import fs from "fs";
import path from "path";
import os from "os";

// ── AgenticMarket config (stores API key) ─────────────

const AM_CONFIG_DIR = path.join(os.homedir(), ".agenticmarket");
const AM_CONFIG_FILE = path.join(AM_CONFIG_DIR, "config.json");

// Your deployed worker URL
export const PROXY_BASE_URL = "https://agentic-market-proxy.shekharpachlore99.workers.dev";
export const API_BASE_URL = PROXY_BASE_URL;

export function saveConfig(data) {
  if (!fs.existsSync(AM_CONFIG_DIR)) {
    fs.mkdirSync(AM_CONFIG_DIR, { recursive: true });
  }
  const existing = loadConfig();
  fs.writeFileSync(AM_CONFIG_FILE, JSON.stringify({ ...existing, ...data }, null, 2));
}

export function loadConfig() {
  if (!fs.existsSync(AM_CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(AM_CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function getApiKey() {
  return loadConfig().apiKey ?? null;
}

// ── IDE MCP config detection ──────────────────────────

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
const home = os.homedir();
const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");

// All known MCP config file locations
export const IDE_CONFIGS = [
  {
    name: "Claude Desktop",
    icon: "🤖",
    path: isWindows
      ? path.join(appData, "Claude", "claude_desktop_config.json")
      : isMac
      ? path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : path.join(home, ".config", "claude", "claude_desktop_config.json"),
  },
  {
    name: "Cursor (global)",
    icon: "⚡",
    path: path.join(home, ".cursor", "mcp.json"),
  },
  {
    name: "Cursor (project)",
    icon: "⚡",
    path: path.join(process.cwd(), ".cursor", "mcp.json"),
  },
  {
    name: "VS Code",
    icon: "💙",
    path: path.join(process.cwd(), ".vscode", "mcp.json"),
  },
];

// Returns all IDE configs that actually exist on this machine
export function getInstalledIDEs() {
  return IDE_CONFIGS.filter((ide) => {
    // If the config file already exists, definitely detected
    if (fs.existsSync(ide.path)) return true;

    // Check if the IDE's config directory exists (e.g. .vscode/, .cursor/)
    const configDir = path.dirname(ide.path);
    if (fs.existsSync(configDir)) return true;

    // Detect VS Code by its integrated terminal environment variable
    if (ide.name === "VS Code" && process.env.TERM_PROGRAM === "vscode") return true;

    return false;
  });
}

// Read an MCP config file safely
export function readMCPConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { mcpServers: {} };
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed.mcpServers) parsed.mcpServers = {};
    return parsed;
  } catch {
    return { mcpServers: {} };
  }
}

// Write an MCP config file safely
export function writeMCPConfig(filePath, config) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}

// Build the MCP server entry for a skill
export function buildMCPEntry(skillName, apiKey) {
  return {
    url: `${PROXY_BASE_URL}/mcp/${skillName}`,
    headers: {
      "x-api-key": apiKey,
    },
  };
}
