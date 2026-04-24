# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |

Only the latest `2.x` line receives security fixes. Please upgrade before
filing a report against an older version.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, use one of the following private channels:

1. Open a [GitHub security advisory](https://github.com/Ricardo-M-L/terminal-quest-cli/security/advisories/new)
   (preferred). This creates a private conversation visible only to maintainers.
2. If you cannot use GitHub advisories, email the maintainers via the address
   listed in `package.json`.

When you report, please include:

- A clear description of the issue and its impact
- Steps to reproduce (a minimal repro case or PoC is ideal)
- The version of `terminal-quest-cli`, Node.js, OS, and terminal you were using
- Any suggested fix or mitigation you already have in mind

## What to Expect

- **Acknowledgement:** within 72 hours.
- **Initial assessment:** within 7 days.
- **Fix / coordinated disclosure:** depending on severity, typically within
  30 days. We will keep you updated throughout the process and credit you in
  the release notes unless you prefer to remain anonymous.

## Scope

In-scope:

- Code execution via crafted save files, themes, language packs, or CLI flags
- Path traversal / arbitrary file write in the save subsystem
- Prototype pollution or injection through user-supplied input
- Supply-chain issues in our runtime dependencies

Out of scope:

- Issues that require physical access to an already-compromised machine
- Denial-of-service by running the CLI against an extremely slow terminal
- Bugs in third-party tools (`npx`, `node`, your terminal emulator) that we
  only surface but do not cause

Thanks for helping keep Terminal Quest players safe.
