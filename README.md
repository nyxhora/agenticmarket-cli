# AgenticMarket CLI

## Setup (one time)

```bash
npm install
```

## Test locally

```bash
# See all commands
node bin/cli.js --help

# Authenticate (uses your test API key)
node bin/cli.js auth am_test_1234567890abcdef

# Check balance
node bin/cli.js balance

# Install a skill (will auto-detect your IDEs)
node bin/cli.js install demo-skill

# List installed skills
node bin/cli.js list

# Remove a skill
node bin/cli.js remove demo-skill
```

## Deploy to npm (when ready)

```bash
# Login to npm
npm login

# Publish (makes it available as npx agenticmarket)
npm publish
```

After publishing, anyone can run:
```bash
npx agenticmarket auth <their-api-key>
npx agenticmarket install security-scanner
```

## File structure

```
bin/
  cli.js          ← entry point, command router
src/
  config.js       ← saves API key, finds IDE configs
  commands/
    auth.js       ← save + verify API key
    install.js    ← add skill to IDE config files
    remove.js     ← remove skill from IDE config files
    list.js       ← show installed skills
    balance.js    ← check credits
```

## Important: update your worker URL

In src/config.js, line 14:
```js
export const PROXY_BASE_URL = "https://agentic-market-proxy.YOUR-SUBDOMAIN.workers.dev";
```

Replace with your actual Cloudflare Worker URL before publishing.
