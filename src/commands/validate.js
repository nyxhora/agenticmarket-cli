/**
 * src/commands/validate.js
 *
 * agenticmarket validate
 *
 * Pre-publish security audit & schema check.
 * Runs from inside a scaffolded project directory.
 *
 * Checks:
 *   1. server.json exists and has valid schema
 *   2. .env has MCP_SECRET set
 *   3. Security middleware is wired in index.ts
 *   4. No hardcoded secrets in source files
 *   5. package.json has required fields
 *   6. .gitignore includes .env
 *   7. Dockerfile (if present) uses non-root user
 *   8. No zod/v4 process import conflict
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Recursively scan .ts files in a directory for a pattern.
 * Returns array of { file, line, content } matches.
 */
function scanSource(dir, pattern) {
  const matches = [];
  if (!fs.existsSync(dir)) return matches;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
      matches.push(...scanSource(fullPath, pattern));
    } else if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          matches.push({
            file: path.relative(dir, fullPath),
            line: i + 1,
            content: lines[i].trim(),
          });
        }
      }
    }
  }
  return matches;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function validate() {
  const cwd = process.cwd();
  let pass = 0;
  let fail = 0;
  let warn = 0;

  const ok = (msg) => { pass++; console.log(`  ${chalk.green("✓")} ${msg}`); };
  const bad = (msg) => { fail++; console.log(`  ${chalk.red("✗")} ${msg}`); };
  const warning = (msg) => { warn++; console.log(`  ${chalk.yellow("⚠")} ${msg}`); };

  console.log("");
  const pad = "═".repeat(52);
  console.log(chalk.cyan.bold(`╔${pad}╗`));
  console.log(chalk.cyan.bold(`║  ${"✦ AgenticMarket  validate".padEnd(50)}║`));
  console.log(chalk.cyan.bold(`╚${pad}╝`));
  console.log("");

  // ── 1. server.json ───────────────────────────────────────────────────────

  console.log(chalk.bold("  ── MCP Registry Schema ──\n"));

  const serverJsonPath = path.join(cwd, ".mcp", "server.json");
  const serverJson = readJson(serverJsonPath);

  if (!serverJson) {
    bad(".mcp/server.json missing or invalid JSON");
  } else {
    ok(".mcp/server.json exists and is valid JSON");

    if (serverJson.$schema) {
      ok(`$schema set: ${chalk.dim(serverJson.$schema)}`);
    } else {
      bad("$schema field missing — add official MCP schema URL");
    }

    if (serverJson.name && serverJson.name.includes("/")) {
      ok(`name: ${chalk.dim(serverJson.name)}`);
    } else {
      bad("name should follow format: io.github.<user>/<project>");
    }

    if (serverJson.description) {
      ok(`description: ${chalk.dim(serverJson.description.substring(0, 50))}...`);
    } else {
      warning("description missing — helps discoverability");
    }

    if (serverJson.version) {
      ok(`version: ${chalk.dim(serverJson.version)}`);
    } else {
      bad("version missing");
    }

    // Check for hardcoded pricing
    const meta = serverJson._meta?.["dev.agenticmarket"];
    if (meta?.pricing) {
      bad("Hardcoded pricing found — pricing should be set on dashboard");
    } else {
      ok("No hardcoded pricing in _meta");
    }
  }

  // ── 2. Environment ─────────────────────────────────────────────────────────

  console.log(chalk.bold("\n  ── Environment & Secrets ──\n"));

  const envPath = path.join(cwd, ".env");
  const envExamplePath = path.join(cwd, ".env.example");

  if (fileExists(envPath)) {
    ok(".env file exists");
    const envContent = readFile(envPath);
    const secretMatch = envContent?.match(/^MCP_SECRET=(.+)$/m);
    if (secretMatch && secretMatch[1] && secretMatch[1].length > 0) {
      ok(`MCP_SECRET is set (${chalk.dim(secretMatch[1].substring(0, 8) + "...")})`);
    } else {
      bad("MCP_SECRET is empty — server will be unprotected");
    }
  } else {
    warning(".env file missing — copy from .env.example");
  }

  if (fileExists(envExamplePath)) {
    ok(".env.example exists");
  } else {
    bad(".env.example missing — needed for documentation");
  }

  // ── 3. .gitignore ──────────────────────────────────────────────────────────

  const gitignore = readFile(path.join(cwd, ".gitignore"));
  if (gitignore) {
    if (gitignore.includes(".env")) {
      ok(".gitignore includes .env");
    } else {
      bad(".gitignore does NOT include .env — secrets will leak!");
    }
    if (gitignore.includes("node_modules")) {
      ok(".gitignore includes node_modules");
    } else {
      warning(".gitignore missing node_modules");
    }
  } else {
    bad(".gitignore missing — create one immediately");
  }

  // ── 4. Security Middleware ─────────────────────────────────────────────────

  console.log(chalk.bold("\n  ── Security Middleware ──\n"));

  const srcDir = path.join(cwd, "src");
  const indexTs = readFile(path.join(srcDir, "index.ts"));

  if (!indexTs) {
    bad("src/index.ts missing");
  } else {
    // Check middleware imports
    if (indexTs.includes("securityMiddleware")) {
      ok("Security middleware imported and used");
    } else {
      bad("securityMiddleware missing from index.ts — server is unprotected!");
    }

    if (indexTs.includes("rateLimitMiddleware")) {
      ok("Rate limiting middleware imported and used");
    } else {
      bad("rateLimitMiddleware missing — no DDoS protection");
    }

    if (indexTs.includes("bodyLimit")) {
      ok("Body size limit middleware present");
    } else {
      warning("bodyLimit missing — vulnerable to memory exhaustion");
    }

    if (indexTs.includes("gracefulShutdown") || indexTs.includes("SIGTERM")) {
      ok("Graceful shutdown handler present");
    } else {
      warning("No graceful shutdown — may leave zombie sessions in Docker/K8s");
    }

    if (indexTs.includes("SESSION_TTL_MS") || indexTs.includes("lastActivity")) {
      ok("Session timeout configured");
    } else {
      warning("No session timeout — sessions may grow unbounded");
    }
  }

  // Security middleware file check
  const securityTs = readFile(path.join(srcDir, "middleware", "security.ts"));
  if (securityTs) {
    if (securityTs.includes("timingSafeEqual") || securityTs.includes("timing")) {
      ok("Timing-safe secret comparison present");
    } else {
      bad("No timing-safe comparison — vulnerable to timing oracle attacks");
    }

    if (securityTs.includes("Content-Security-Policy")) {
      ok("CSP headers present");
    } else {
      warning("Missing Content-Security-Policy header");
    }

    if (securityTs.includes("X-Frame-Options")) {
      ok("X-Frame-Options header present");
    } else {
      warning("Missing X-Frame-Options header");
    }
  } else {
    bad("src/middleware/security.ts missing");
  }

  // ── 5. Code Quality ──────────────────────────────────────────────────────

  console.log(chalk.bold("\n  ── Code Quality ──\n"));

  // Check for hardcoded secrets in source
  const secretPatterns = [
    /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][a-zA-Z0-9_\-]{8,}["']/i,
  ];

  let hardcodedSecrets = [];
  for (const pattern of secretPatterns) {
    hardcodedSecrets.push(...scanSource(srcDir, pattern));
  }

  // Filter out false positives (env references, type declarations)
  hardcodedSecrets = hardcodedSecrets.filter(
    (m) =>
      !m.content.includes("process.env") &&
      !m.content.includes("??") &&
      !m.content.includes("interface") &&
      !m.content.includes("type ") &&
      !m.content.includes("__") && // template tokens
      !m.content.includes("mcp_"),
  );

  if (hardcodedSecrets.length === 0) {
    ok("No hardcoded secrets detected in source");
  } else {
    bad(`${hardcodedSecrets.length} potential hardcoded secret(s) found:`);
    for (const m of hardcodedSecrets.slice(0, 5)) {
      console.log(chalk.dim(`    → ${m.file}:${m.line}: ${m.content.substring(0, 60)}`));
    }
  }

  // Check for zod/v4 process conflict
  const zodConflicts = scanSource(srcDir, /from\s+["']zod\/v4/);
  if (zodConflicts.length === 0) {
    ok("No zod/v4 import conflicts");
  } else {
    bad(`zod/v4 import found — breaks process.env access:`);
    for (const m of zodConflicts) {
      console.log(chalk.dim(`    → ${m.file}:${m.line}`));
    }
  }

  // Check explicit node:process usage
  const bareProcessImports = scanSource(srcDir, /import.*process.*from\s+["']process["']/);
  if (bareProcessImports.length === 0) {
    ok("All process imports use node:process prefix");
  } else {
    bad("Bare process imports found (use 'node:process' instead):");
    for (const m of bareProcessImports) {
      console.log(chalk.dim(`    → ${m.file}:${m.line}`));
    }
  }

  // ── 6. package.json ───────────────────────────────────────────────────────

  console.log(chalk.bold("\n  ── Package Configuration ──\n"));

  const pkg = readJson(path.join(cwd, "package.json"));
  if (!pkg) {
    bad("package.json missing or invalid");
  } else {
    ok(`name: ${chalk.dim(pkg.name)}`);

    if (pkg.mcpName) {
      ok(`mcpName: ${chalk.dim(pkg.mcpName)}`);
    } else {
      warning("mcpName field missing — needed for registry listing");
    }

    if (pkg.scripts?.dev) {
      ok(`dev script: ${chalk.dim(pkg.scripts.dev.substring(0, 40))}...`);
    } else {
      bad("No dev script");
    }

    if (pkg.scripts?.build) {
      ok("Build script present");
    } else {
      bad("No build script — cannot create production bundle");
    }

    if (pkg.engines?.node) {
      ok(`Node engine: ${chalk.dim(pkg.engines.node)}`);
    } else {
      warning("engines.node not specified — may fail on old Node versions");
    }
  }

  // ── 7. Dockerfile (if present) ─────────────────────────────────────────────

  const dockerfile = readFile(path.join(cwd, "Dockerfile"));
  if (dockerfile) {
    console.log(chalk.bold("\n  ── Dockerfile ──\n"));

    if (dockerfile.includes("USER") && !dockerfile.includes("USER root")) {
      ok("Runs as non-root user");
    } else {
      warning("Runs as root — add a non-root USER directive");
    }

    if (dockerfile.includes("HEALTHCHECK")) {
      ok("HEALTHCHECK directive present");
    } else {
      warning("No HEALTHCHECK — container orchestrators can't monitor health");
    }

    if (dockerfile.match(/node:\d{2}/)) {
      const nodeVersion = dockerfile.match(/node:(\d{2})/)?.[1];
      if (parseInt(nodeVersion) >= 20) {
        ok(`Node ${nodeVersion} base image`);
      } else {
        warning(`Node ${nodeVersion} — upgrade to 20+ for --env-file support`);
      }
    }
  }

  // ── Result ─────────────────────────────────────────────────────────────────

  console.log("");
  console.log(chalk.dim(`  ${"═".repeat(52)}`));

  const total = pass + fail + warn;
  if (fail === 0) {
    console.log(
      `  ${chalk.green.bold("PASS")} — ${pass} checks passed${warn > 0 ? `, ${warn} warnings` : ""}`,
    );
    console.log("");
    console.log(`  ${chalk.dim("Ready to publish:")} ${chalk.cyan("npm run release")}`);
  } else {
    console.log(
      `  ${chalk.red.bold("FAIL")} — ${fail} issue(s), ${pass} passed, ${warn} warning(s)`,
    );
    console.log("");
    console.log(`  ${chalk.dim("Fix the issues above before publishing.")}`);
  }

  console.log(chalk.dim(`  ${"═".repeat(52)}`));
  console.log("");

  return { pass, fail, warn, total };
}
