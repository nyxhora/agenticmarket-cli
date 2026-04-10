/**
 * src/commands/remove.js
 *
 * agenticmarket remove <server-name>
 *
 * Removes an installed MCP server from all IDE configs.
 * Supports both official (proxy) and community (direct) servers.
 *
 * For community servers, the argument can be:
 *   - The config key (e.g. "fetch")    → looked up in community registry
 *   - The slug (e.g. "fetch-mcp-server") → looked up in community registry
 *
 * For official servers, the argument is the config key as always.
 */

import chalk from "chalk";
import prompts from "prompts";
import {
  getApiKey,
  getInstalledIDEs,
  readMCPConfig,
  writeMCPConfig,
  loadCommunityRegistry,
  getCommunityByConfigKey,
  removeCommunityInstall,
} from "../config.js";

export async function remove(serverName) {
  console.log("");

  // ── Header box ──────────────────────────────────────────
  const pad = "═".repeat(52);
  console.log(chalk.cyan.bold(`╔${pad}╗`));
  console.log(chalk.cyan.bold(`║  ${"Remove MCP Server".padEnd(50)}║`));
  console.log(chalk.cyan.bold(`╚${pad}╝`));
  console.log("");

  // ── Auth check ──────────────────────────────────────────
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(`  ${chalk.red("✗")}  ${chalk.red("Not authenticated")}`);
    console.log("");
    console.log(chalk.dim(`  ${"─".repeat(48)}`));
    console.log(
      `  Run ${chalk.cyan("agenticmarket auth <api-key>")} to log in first`
    );
    console.log("");
    process.exit(1);
  }

  // ── Resolve server name ─────────────────────────────────
  // Check if the argument matches a community slug or community configKey
  const registry = loadCommunityRegistry();
  let communityEntry = null;
  let configKey = serverName;      // the actual key in mcpServers
  let communitySlug = null;        // the community slug for registry cleanup

  // 1. Direct slug match in registry
  if (registry[serverName]) {
    communityEntry = registry[serverName];
    configKey = communityEntry.configKey;
    communitySlug = serverName;
  }
  // 2. Match by configKey in registry
  else {
    const byKey = getCommunityByConfigKey(serverName);
    if (byKey) {
      communityEntry = byKey;
      configKey = byKey.configKey;
      communitySlug = byKey.slug;
    }
  }

  const isCommunity = !!communityEntry;

  // ── Find IDEs that have this server ─────────────────────
  const installedIDEs  = getInstalledIDEs();
  const idesWithServer = installedIDEs.filter((ide) => {
    const config = readMCPConfig(ide.configPath, ide.configKey);
    return !!config.mcpServers?.[configKey];
  });

  if (idesWithServer.length === 0 && !isCommunity) {
    console.log(
      `  ${chalk.yellow("⚠")}  ${chalk.yellow(`"${serverName}" is not installed in any IDE`)}`
    );
    console.log("");
    console.log(
      `  ${chalk.dim("Run")} ${chalk.cyan("agenticmarket list")} ${chalk.dim("to see installed servers")}`
    );
    console.log("");
    process.exit(0);
  }

  // ── Show what will be removed ───────────────────────────
  console.log(
    `  ${chalk.dim("Server")}   ${chalk.white.bold(configKey)}` +
    (isCommunity ? chalk.magenta("  community") : "")
  );
  if (isCommunity && communitySlug !== configKey) {
    console.log(
      `  ${chalk.dim("Slug")}     ${chalk.dim(communitySlug)}`
    );
  }
  console.log(
    `  ${chalk.dim("Found in")} ${chalk.white(idesWithServer.length + " IDE" + (idesWithServer.length !== 1 ? "s" : ""))}`
  );
  console.log("");

  for (const ide of idesWithServer) {
    console.log(`  ${chalk.dim("·")}  ${ide.icon}  ${chalk.dim(ide.name)}`);
  }

  console.log("");
  console.log(chalk.dim(`  ${"─".repeat(48)}`));
  console.log("");

  // ── Confirmation prompt ─────────────────────────────────
  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: `  Remove ${isCommunity ? chalk.magenta(configKey) : chalk.cyan(configKey)}?`,
    initial: false,
  });

  if (confirm === undefined) {
    console.log("");
    console.log(`  ${chalk.dim("Cancelled.")}`);
    console.log("");
    process.exit(0);
  }

  if (!confirm) {
    console.log("");
    console.log(`  ${chalk.dim("Cancelled — nothing was changed.")}`);
    console.log("");
    process.exit(0);
  }

  // ── Remove from each IDE ────────────────────────────────
  console.log("");
  let removed = 0;
  let failed  = 0;

  for (const ide of idesWithServer) {
    try {
      const config = readMCPConfig(ide.configPath, ide.configKey);
      delete config.mcpServers[configKey];
      writeMCPConfig(ide.configPath, config);
      console.log(
        `  ${chalk.green("✓")}  ${ide.icon}  ${chalk.white(ide.name)}`
      );
      removed++;
    } catch (err) {
      console.log(
        `  ${chalk.red("✗")}  ${ide.icon}  ${chalk.white(ide.name)}  ${chalk.dim(err.message)}`
      );
      failed++;
    }
  }

  // ── Remove from community registry ──────────────────────
  if (isCommunity && communitySlug) {
    removeCommunityInstall(communitySlug);
  }

  // ── Summary ─────────────────────────────────────────────
  console.log("");
  console.log(chalk.dim(`  ${"─".repeat(48)}`));
  console.log("");

  if (failed === 0) {
    console.log(
      `  ${chalk.green("✓")}  ${chalk.green.bold(`${configKey} removed`)}` +
      chalk.dim(`  from ${removed} IDE${removed !== 1 ? "s" : ""}`) +
      (isCommunity ? chalk.dim("  + community registry") : "")
    );
    console.log("");
    console.log(`  ${chalk.dim("Restart your IDE to apply changes.")}`);
  } else {
    console.log(
      `  ${chalk.yellow("⚠")}  Removed from ${chalk.white(removed)}, ` +
      `failed on ${chalk.red(failed)}`
    );
    console.log("");
    console.log(
      `  ${chalk.dim("Try running with admin/sudo if the config files are write-protected.")}`
    );
  }

  console.log("");
}