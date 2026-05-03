# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in the AgenticMarket CLI, scaffold templates, or any related tooling, **do not open a public GitHub issue.**

Report it privately:

**Email:** support@agenticmarket.dev  
**Subject line:** `[SECURITY] Brief description`

Include:
- What the vulnerability is and where it exists
- Steps to reproduce
- Potential impact
- Your suggested fix (optional but appreciated)

We will acknowledge your report within **48 hours** and aim to release a fix within **7 days** for critical issues. We will notify you before public disclosure.

---

## Coordinated Disclosure

We follow coordinated (responsible) disclosure:

1. You report privately to support@agenticmarket.dev
2. We confirm the issue and scope
3. We develop and release a fix
4. We publish a security advisory publicly after the patch is live
5. We credit you in the advisory unless you prefer to remain anonymous

Please give us reasonable time to fix the issue before any public disclosure. We will not take legal action against researchers who follow this process in good faith.

---

## Scope

This policy covers:

| Target | In Scope |
|--------|----------|
| `agenticmarket` CLI (npm package) | ✅ |
| Scaffold templates (`fresh`, `api-wrapper`) | ✅ |
| Generated security middleware | ✅ |
| AgenticMarket platform (`agenticmarket.dev`, `api.agenticmarket.dev`) | ✅ |
| Third-party MCP servers listed on AgenticMarket | ❌ — contact the creator directly |
| Dependencies (Hono, MCP SDK, Zod, etc.) | ❌ — report upstream |

---

## Out of Scope

The following are not considered vulnerabilities under this policy:

- Issues in servers you built yourself using the scaffold
- Vulnerabilities in third-party dependencies (report to the dependency maintainer)
- Social engineering attacks
- Denial of service via excessive requests without demonstrating a specific bypass
- Issues only reproducible on end-of-life Node.js versions (below 20.6)

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest stable | ✅ |
| Previous minor | ✅ security fixes only |
| Older versions | ❌ |

We recommend always running the latest version of the CLI.

---

## No Warranty

The AgenticMarket CLI and scaffold templates are provided under the MIT License. They are provided **as-is**, without warranty of any kind. AgenticMarket is not responsible for security issues arising from:

- Modifications made to the generated code after scaffolding
- Misconfiguration of environment variables (e.g. exposing `MCP_SECRET`)
- Deployment environments outside the documented configurations
- Third-party dependencies used in your project
- MCP servers you build, deploy, or publish using these tools

The security middleware shipped in generated projects represents current best practices at the time of scaffold generation. It is your responsibility to keep dependencies updated and review security advisories that affect your deployment.
