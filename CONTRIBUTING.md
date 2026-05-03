# Contributing to AgenticMarket

Thanks for your interest in contributing. This document covers everything you need to know.

---

## What We Accept

| Contribution type | Welcome? |
|---|---|
| Bug fixes | ✅ Always |
| Security improvements to middleware | ✅ Always — follow SECURITY.md for vulnerabilities |
| New scaffold templates (`--example`) | ✅ With discussion first |
| New CLI commands | ✅ With discussion first |
| Documentation fixes | ✅ Always |
| Dependency upgrades | ✅ With justification |
| Cosmetic changes only (formatting, renaming) | ⚠️ Low priority |
| New frameworks or languages | ⚠️ Discuss before starting |
| Changes to security middleware defaults | ⚠️ Requires strong justification |

If you are planning something significant, open an issue first. It saves everyone time.

---

## Getting Started

```bash
# Fork and clone
git clone https://github.com/agenticmarket/agenticmarket
cd agenticmarket
npm install

# Run any command locally
node bin/cli.js --help
node bin/cli.js create my-test-server

# Run the full test suite
node test/test-create.js
node test/test-e2e.js
```

All 132 unit tests and E2E must pass before you open a pull request.

---

## Workflow

1. Fork the repository
2. Create a branch: `git checkout -b fix/rate-limiter-edge-case`
3. Make your changes
4. Run tests: `node test/test-create.js && node test/test-e2e.js`
5. Commit using the convention below
6. Push and open a pull request against `main`

---

## Commit Convention

```
add: short description       # new feature or file
fix: short description       # bug fix
security: short description  # security improvement
docs: short description      # documentation only
test: short description      # tests only
refactor: short description  # no behavior change
```

One concern per commit. Do not bundle unrelated changes.

---

## Pull Request Rules

- **One PR per concern.** Do not fix three things in one PR.
- **Tests required.** If you add a feature, add a test. If you fix a bug, add a regression test.
- **No breaking changes without discussion.** If your change affects generated project output, existing users are affected.
- **Security middleware is protected.** Changes to `security.ts`, `rateLimit.ts`, or `audit.ts` in templates require a clear security justification and will be reviewed carefully. Do not weaken defaults.
- **Keep the README honest.** If your change affects behavior documented in CREATE.md or README.md, update the docs in the same PR.

---

## Adding a New Example Template

The highest-value contribution is a new example template under `src/templates/examples/`. Good candidates:

- Wraps a widely-used public API with no authentication required
- Demonstrates a pattern not covered by `fresh` or `api-wrapper`
- Includes at least two working tools
- Has a real use case (not a toy)

Requirements for acceptance:

- Follows the exact file structure of the `fresh` template
- Security middleware untouched and imported correctly
- `AGENTS.md` included and accurate for the template
- `.mcp/server.json` correctly populated including `_meta["dev.agenticmarket"]`
- At least 5 passing assertions added to `test/test-create.js`
- README section for the new example

---

## What We Will Not Merge

- Changes that remove or weaken security defaults
- Contributions that introduce telemetry, tracking, or analytics without explicit user opt-in
- Code that makes the CLI work differently from what the README documents
- Anything that violates the Code of Conduct
- PRs with no tests

---

## Licensing

By submitting a pull request, you agree that your contribution will be licensed under the same [MIT License](./LICENSE) that covers this project. You confirm that you have the right to submit the code under these terms.

AgenticMarket reserves the right to incorporate, modify, or redistribute your contribution as part of the project under the MIT License.

---

## Disclaimer

Contributions are accepted in good faith. AgenticMarket is not responsible for:

- Bugs introduced by third-party contributions
- Security issues arising from contributed code that passed review at the time of merge
- How contributors use the scaffolded output in their own projects

If you discover a security issue in a contribution, follow the [Security Policy](./SECURITY.md).

---

## Questions

Open a GitHub discussion or email support@agenticmarket.dev.
