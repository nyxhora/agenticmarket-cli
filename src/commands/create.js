/**
 * src/commands/create.js
 *
 * agenticmarket create <project-name>
 *
 * Scaffolds a production-ready, security-first MCP server project.
 * Templates: fresh (blank server) | api-wrapper (REST API → MCP bridge)
 *
 * All templates are bundled — no internet required for scaffolding.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import chalk from "chalk";
import prompts from "prompts";
import ora from "ora";
import { execSync } from "child_process";

// ── Resolve template directory relative to this file ────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

// ── Constants ───────────────────────────────────────────────────────────────

const NAME_REGEX = /^[a-z0-9][a-z0-9._-]*$/;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Replaces all __PLACEHOLDER__ tokens in file content.
 */
function replaceTokens(content, tokens) {
  let result = content;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.split(key).join(value);
  }
  return result;
}

/**
 * Recursively copy a directory, replacing tokens in all text files.
 * Skips binary files to avoid corrupting images/fonts.
 */
function copyTemplate(srcDir, destDir, tokens) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTemplate(srcPath, destPath, tokens);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      const binaryExts = new Set([
        ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
        ".woff", ".woff2", ".ttf", ".eot", ".otf",
      ]);

      if (binaryExts.has(ext)) {
        fs.copyFileSync(srcPath, destPath);
      } else {
        const content = fs.readFileSync(srcPath, "utf-8");
        fs.writeFileSync(destPath, replaceTokens(content, tokens));
      }
    }
  }
}

/**
 * Convert project name to title case of MCP Server.
 * "my-weather-server" → "My Weather Server"
 */
function toTitle(name) {
  return name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Get GitHub username from git config. Returns "" if unavailable.
 */
function getGitUsername() {
  try {
    return execSync("git config user.name", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

/**
 * Generate a random hex secret for MCP_SECRET of the server.
 * Uses Node.js crypto.randomBytes (available in all Node 18+ environments).
 */
function generateSecret() {
  return "mcp_" + randomBytes(24).toString("hex");
}

/**
 * Validate project name. Returns error string or true.
 */
function validateName(name) {
  if (!name) return "Project name is required";
  if (!NAME_REGEX.test(name)) return "Use lowercase letters, numbers, dashes, dots only. Must start with letter or number.";
  if (name.length < 2) return "Name must be at least 2 characters long";
  if (name.length > 50) return "Name too long (max 50 characters)";
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function create(projectName, options = {}) {
  const jsonMode = options.json === true;
  const log = jsonMode ? () => {} : console.log;

  log("");

  // ── Header ──────────────────────────────────────────────────────────────
  const pad = "═".repeat(52);
  log(chalk.cyan.bold(`╔${pad}╗`));
  log(
    chalk.cyan.bold(`║  ${"✦ AgenticMarket  create-mcp".padEnd(50)}║`),
  );
  log(chalk.cyan.bold(`╚${pad}╝`));
  log("");

  // ── Project name ────────────────────────────────────────────────────────

  let name = projectName;

  if (name) {
    // Validate CLI-provided name
    const validation = validateName(name);
    if (validation !== true) {
      if (jsonMode) {
        console.log(JSON.stringify({ error: validation }));
      } else {
        console.log(`  ${chalk.red("✗")} ${chalk.red(validation)}`);
        console.log(
          `  ${chalk.dim("Usage:")} ${chalk.cyan("agenticmarket create")} ${chalk.yellow("<project-name>")}`,
        );
      }
      console.log("");
      process.exit(1);
    }
  } else {
    if (jsonMode) {
      console.log(JSON.stringify({ error: "Project name required in --json mode" }));
      process.exit(1);
    }
    const res = await prompts({
      type: "text",
      name: "name",
      message: "Project name",
      initial: "my-mcp-server",
      validate: validateName,
    });
    if (!res.name) {
      console.log(chalk.dim("  Cancelled."));
      process.exit(0);
    }
    name = res.name;
  }

  // ── Check if folder exists ──────────────────────────────────────────────

  const targetDir = path.resolve(process.cwd(), name);

  if (fs.existsSync(targetDir)) {
    if (jsonMode) {
      console.log(JSON.stringify({ error: `Folder ${name} already exists` }));
    } else {
      console.log(
        `  ${chalk.red("✗")} Folder ${chalk.white.bold(name)} already exists`,
      );
      console.log(
        `  ${chalk.dim("Choose a different name or delete the existing folder.")}`,
      );
    }
    console.log("");
    process.exit(1);
  }

  log(
    `  ${chalk.dim("Creating")} ${chalk.white.bold(name)} ${chalk.dim("in")} ${chalk.dim(targetDir)}`,
  );
  log("");

  // ── Template selection ──────────────────────────────────────────────────

  const { template } = await prompts({
    type: "select",
    name: "template",
    message: "Template",
    choices: [
      {
        title: "Fresh server",
        description: "Blank MCP server — write your own tools",
        value: "fresh",
      },
      {
        title: "API wrapper",
        description: "Wrap a REST API as MCP tools",
        value: "api-wrapper",
      },
    ],
    initial: 0,
  });

  if (!template) {
    console.log(chalk.dim("  Cancelled."));
    process.exit(0);
  }

  // ── Deploy target ─────────────────────────────────────────────────────

  const { deploy } = await prompts({
    type: "select",
    name: "deploy",
    message: "Deploy target",
    choices: [
      {
        title: "Cloudflare Workers",
        value: "cloudflare",
      },
      {
        title: "Railway / Render (Docker)",
        value: "docker",
      },
      {
        title: "None (configure later)",
        value: "none",
      },
    ],
    initial: 0,
  });

  if (deploy === undefined) {
    console.log(chalk.dim("  Cancelled."));
    process.exit(0);
  }

  // ── Secret header auth ────────────────────────────────────────────────

  const { enableSecret } = await prompts({
    type: "confirm",
    name: "enableSecret",
    message: "Enable secret header auth?",
    initial: true,
  });

  if (enableSecret === undefined) {
    console.log(chalk.dim("  Cancelled."));
    process.exit(0);
  }

  // ── API wrapper specific prompts ──────────────────────────────────────

  let apiBaseUrl = "";
  let authType = "none";
  let authHeader = "x-api-key";
  let exampleEndpoint = "/data";

  if (template === "api-wrapper") {
    console.log("");
    console.log(chalk.dim("  ── API Configuration ──"));
    console.log("");

    const apiRes = await prompts([
      {
        type: "text",
        name: "baseUrl",
        message: "Base API URL",
        initial: "https://api.example.com",
        validate: (v) => (v ? true : "URL is required"),
      },
      {
        type: "select",
        name: "authType",
        message: "Auth type",
        choices: [
          { title: "API Key", value: "api-key" },
          { title: "Bearer Token", value: "bearer" },
          { title: "None", value: "none" },
        ],
        initial: 0,
      },
    ]);

    if (!apiRes.baseUrl) {
      console.log(chalk.dim("  Cancelled."));
      process.exit(0);
    }

    apiBaseUrl = apiRes.baseUrl;
    authType = apiRes.authType;

    if (authType !== "none") {
      const headerRes = await prompts({
        type: "text",
        name: "header",
        message: "Auth header name",
        initial: authType === "bearer" ? "Authorization" : "x-api-key",
      });
      if (headerRes.header) authHeader = headerRes.header;
    }

    // Extract example endpoint from URL path
    try {
      const url = new URL(apiBaseUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        exampleEndpoint = "/" + parts[parts.length - 1];
      }
    } catch {
      // keep default
    }
  }

  // ── Build tokens ────────────────────────────────────────────────────────

  const gitUser = getGitUsername(); // get cuurent user name from git
  const sanitizedUser = gitUser.toLowerCase().replace(/[^a-z0-9-]/g, ""); // sanitize user name
  const mcpName = sanitizedUser // MCP name format: io.github.<username>/<project-name>
    ? `io.github.${sanitizedUser}/${name}`
    : `io.github.yourname/${name}`;
  const repoUrl = sanitizedUser // GitHub repository URL
    ? `https://github.com/${sanitizedUser}/${name}`
    : `https://github.com/yourname/${name}`;

  const tokens = {
    __PROJECT_NAME__: name,
    __PROJECT_TITLE__: toTitle(name),
    __DESCRIPTION__: `MCP server for ${toTitle(name)}`,
    __MCP_NAME__: mcpName,
    __REPO_URL__: repoUrl,
    __API_BASE_URL__: apiBaseUrl || "https://api.example.com",
    __AUTH_TYPE__: authType,
    __AUTH_HEADER__: authHeader,
    __EXAMPLE_ENDPOINT__: exampleEndpoint,
  };

  // ── Copy template ───────────────────────────────────────────────────────

  log("");
  const spinner = jsonMode
    ? { start: () => spinner, stop: () => {} }
    : ora({
        text: chalk.dim("Scaffolding project..."),
        color: "cyan",
        spinner: "dots",
      }).start();

  try {
    const templateDir = path.join(TEMPLATES_DIR, template);

    if (!fs.existsSync(templateDir)) { // check if template exists
      spinner.stop();
      console.log(
        `  ${chalk.red("✗")} Template ${chalk.white(template)} not found`,
      );
      console.log(
        `  ${chalk.dim("Expected at:")} ${templateDir}`,
      );
      process.exit(1);
    }

    // Create target directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy and transform template
    copyTemplate(templateDir, targetDir, tokens);

    // ── Post-scaffold adjustments ───────────────────────────────────────

    // Remove deploy configs not selected
    if (deploy !== "cloudflare") {
      const wranglerPath = path.join(targetDir, "wrangler.toml");
      if (fs.existsSync(wranglerPath)) fs.unlinkSync(wranglerPath);
    }
    if (deploy !== "docker") {
      const dockerPath = path.join(targetDir, "Dockerfile");
      if (fs.existsSync(dockerPath)) fs.unlinkSync(dockerPath);
    }

    // Create .env from .env.example with optional auto-generated secret
    const envExamplePath = path.join(targetDir, ".env.example");
    const envPath = path.join(targetDir, ".env");
    if (fs.existsSync(envExamplePath)) {
      let envContent = fs.readFileSync(envExamplePath, "utf-8");
      if (enableSecret) {
        const secret = generateSecret();
        envContent = envContent.replace("MCP_SECRET=", `MCP_SECRET=${secret}`);
      }
      fs.writeFileSync(envPath, envContent);
    }

    // Initialize git repo
    try {
      execSync("git init", { cwd: targetDir, stdio: "ignore" });
      execSync("git add -A", { cwd: targetDir, stdio: "ignore" });
      execSync('git commit -m "Initial scaffold from agenticmarket create"', {
        cwd: targetDir,
        stdio: "ignore",
      });
    } catch {
      // Git not available — not critical
    }

    spinner.stop();

    // ── JSON output ────────────────────────────────────────────────────

    if (jsonMode) {
      console.log(JSON.stringify({
        name,
        path: targetDir,
        template,
        deploy,
        secret: enableSecret,
        tools: template === "api-wrapper" ? ["get_data"] : ["echo"],
        mcpName: tokens.__MCP_NAME__,
        scripts: { dev: "npm run dev", inspect: "npm run inspect", validate: "npm run validate" },
      }));
      return;
    }

    // ── Success output ────────────────────────────────────────────────────

    log(`  ${chalk.green("✓")} Created ${chalk.white.bold(name + "/")}`);
    log(`  ${chalk.green("✓")} .mcp/server.json`);
    log(
      `  ${chalk.green("✓")} src/ ${chalk.dim("(Hono + MCP SDK + security middleware)")}`,
    );

    if (deploy === "cloudflare")
      log(`  ${chalk.green("✓")} wrangler.toml`);
    if (deploy === "docker")
      log(`  ${chalk.green("✓")} Dockerfile`);

    log(`  ${chalk.green("✓")} .env.example`);
    log(`  ${chalk.green("✓")} AGENTS.md`);
    log(`  ${chalk.green("✓")} README.md`);

    if (enableSecret) {
      log(
        `  ${chalk.green("✓")} .env ${chalk.dim("(secret auto-generated)")}`,
      );
    }

    log("");
    log(chalk.dim(`  ${"─".repeat(52)}`));
    log("");

    // ── Next steps ──────────────────────────────────────────────────────

    log(chalk.bold("  Next:"));
    log(`    ${chalk.cyan("cd")} ${name}`);
    log(`    ${chalk.cyan("npm install")}`);
    if (!enableSecret) {
      log(
        `    ${chalk.cyan("cp")} .env.example .env   ${chalk.dim("# add your MCP_SECRET")}`,
      );
    }
    log(
      `    ${chalk.cyan("npm run inspect")}       ${chalk.dim("# opens MCP Inspector")}`,
    );

    log("");
    log(chalk.dim(`  ${"─".repeat(52)}`));

    // ── AgenticMarket CTA ───────────────────────────────────────────────

    log(
      `  ${chalk.bold("Publish this server and earn per call:")}`,
    );
    log(
      `  ${chalk.cyan("→")} ${chalk.cyan.underline("https://agenticmarket.dev/dashboard/submit")}`,
    );
    log("");
    log(
      `  ${chalk.dim("Docs:")}  ${chalk.cyan.underline("https://agenticmarket.dev/docs/publishing")}`,
    );
    log(chalk.dim(`  ${"─".repeat(52)}`));
    log("");
  } catch (err) {
    spinner.stop();
    console.log(`  ${chalk.red("✗")} Scaffold failed: ${err.message}`);
    console.log("");

    // Cleanup partial directory on failure
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
}
