/**
 * src/commands/add-tool.js
 *
 * agenticmarket add tool <name>
 *
 * Post-scaffold tool generator — creates a new MCP tool file
 * and auto-registers it in tools/index.ts.
 *
 * Must be run from inside a scaffolded project directory.
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";

// ── Helpers ──────────────────────────────────────────────────────────────────

const NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Convert kebab-case to PascalCase.
 * "get-weather" → "GetWeather"
 */
function toPascal(name) {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/**
 * Convert kebab-case to snake_case.
 * "get-weather" → "get_weather"
 */
function toSnake(name) {
  return name.replace(/-/g, "_");
}

/**
 * Check if current directory is a scaffolded MCP project.
 */
function isScaffoldedProject(cwd) {
  return (
    fs.existsSync(path.join(cwd, "src", "tools", "index.ts")) &&
    fs.existsSync(path.join(cwd, "src", "index.ts"))
  );
}

/**
 * Detect if this is an api-wrapper project.
 */
function isApiWrapper(cwd) {
  return fs.existsSync(path.join(cwd, "src", "lib", "api-client.ts"));
}

// ── Templates ────────────────────────────────────────────────────────────────

function freshToolTemplate(toolName) {
  const pascal = toPascal(toolName);
  const snake = toSnake(toolName);

  return `import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * ${pascal} Tool
 *
 * TODO: Update the description, input schema, and handler logic.
 */
export function register${pascal}Tool(server: McpServer): void {
  server.tool(
    "${snake}",
    "TODO: Describe what this tool does for AI agent discovery",
    {
      input: z.string().describe("TODO: Describe this input parameter"),
    },
    async ({ input }) => {
      // TODO: Implement your tool logic here
      return {
        content: [
          {
            type: "text" as const,
            text: \`${pascal} result: \${input}\`,
          },
        ],
      };
    },
  );
}
`;
}

function apiWrapperToolTemplate(toolName) {
  const pascal = toPascal(toolName);
  const snake = toSnake(toolName);

  return `import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient, ApiClientError } from "../lib/api-client.js";

/**
 * ${pascal} Tool
 *
 * TODO: Update the description, endpoint, and input schema.
 */
export function register${pascal}Tool(server: McpServer): void {
  server.tool(
    "${snake}",
    "TODO: Describe what this tool does for AI agent discovery",
    {
      query: z.string().describe("TODO: Describe this input parameter"),
    },
    async ({ query }) => {
      try {
        const data = await apiClient.get("/TODO-endpoint", { q: query });

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
            ? \`API Error (\${err.statusCode}): \${err.message}\`
            : \`Unexpected error: \${err instanceof Error ? err.message : "Unknown"}\`;

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
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function addTool(toolName) {
  const cwd = process.cwd();

  console.log("");

  // Validate
  if (!toolName) {
    console.log(`  ${chalk.red("✗")} Tool name required`);
    console.log(`  ${chalk.dim("Usage:")} ${chalk.cyan("agenticmarket add tool")} ${chalk.yellow("<tool-name>")}`);
    console.log(`  ${chalk.dim("Example:")} ${chalk.cyan("agenticmarket add tool get-weather")}`);
    console.log("");
    process.exit(1);
  }

  if (!NAME_REGEX.test(toolName)) {
    console.log(`  ${chalk.red("✗")} Invalid tool name: ${chalk.white(toolName)}`);
    console.log(`  ${chalk.dim("Use lowercase letters, numbers, and dashes. Must start with letter/number.")}`);
    console.log("");
    process.exit(1);
  }

  // Check we're in a scaffolded project
  if (!isScaffoldedProject(cwd)) {
    console.log(`  ${chalk.red("✗")} Not inside a scaffolded MCP project`);
    console.log(`  ${chalk.dim("Run this command from a project created with:")} ${chalk.cyan("agenticmarket create")}`);
    console.log("");
    process.exit(1);
  }

  // Check if tool already exists
  const toolFile = path.join(cwd, "src", "tools", `${toolName}.ts`);
  if (fs.existsSync(toolFile)) {
    console.log(`  ${chalk.red("✗")} Tool file already exists: ${chalk.dim(`src/tools/${toolName}.ts`)}`);
    console.log("");
    process.exit(1);
  }

  // Generate tool file
  const isWrapper = isApiWrapper(cwd);
  const template = isWrapper
    ? apiWrapperToolTemplate(toolName)
    : freshToolTemplate(toolName);

  fs.writeFileSync(toolFile, template);
  console.log(`  ${chalk.green("✓")} Created ${chalk.white(`src/tools/${toolName}.ts`)}`);

  // Auto-register in tools/index.ts
  const indexPath = path.join(cwd, "src", "tools", "index.ts");
  let indexContent = fs.readFileSync(indexPath, "utf-8");

  const pascal = toPascal(toolName);
  const importLine = `import { register${pascal}Tool } from "./${toolName}.js";`;
  const registerLine = `  register${pascal}Tool(server);`;

  // Guard: check if already registered (e.g., file was manually added)
  if (indexContent.includes(`register${pascal}Tool`)) {
    console.log(`  ${chalk.yellow("⚠")} register${pascal}Tool already in index.ts — skipping auto-register`);
  } else {
    // Insert import: find the last import line and append after it
    const lines = indexContent.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImportIdx = i;
    }

    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, importLine);
    } else {
      // No imports found — add at top
      lines.unshift(importLine);
    }

    // Insert registration: find the closing brace of registerTools function
    // Look for the FIRST "}" that appears after "registerTools"
    let registerToolsFound = false;
    let insertIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("registerTools")) registerToolsFound = true;
      if (registerToolsFound && lines[i].trim() === "}") {
        insertIdx = i;
        break;
      }
    }

    if (insertIdx >= 0) {
      lines.splice(insertIdx, 0, registerLine);
    } else {
      console.log(`  ${chalk.yellow("⚠")} Could not find registerTools closing brace — add manually`);
    }

    indexContent = lines.join("\n");
    fs.writeFileSync(indexPath, indexContent);
  }

  console.log(`  ${chalk.green("✓")} Registered in ${chalk.white("src/tools/index.ts")}`);

  console.log("");
  console.log(chalk.dim(`  ${"─".repeat(52)}`));
  console.log("");
  console.log(chalk.bold("  Next:"));
  console.log(`    1. Edit ${chalk.cyan(`src/tools/${toolName}.ts`)} — update schema + logic`);
  console.log(`    2. ${chalk.cyan("npm run dev")} — hot-reload picks up changes`);
  console.log(`    3. ${chalk.cyan("npm run inspect")} — test interactively`);
  console.log("");
}
