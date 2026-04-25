# Security Policy

## Supported Versions

Security fixes follow the policy below. We only patch lines that are
still on the supported Node.js range; older lines are end-of-life
(EOL) and will not be back-ported, even for high-severity issues.

| Version line | Released   | Status            | Security fixes | Min Node |
| ------------ | ---------- | ----------------- | -------------- | -------- |
| 2.8.x        | 2026-04-25 | **Current**       | :white_check_mark: Active | >= 14    |
| 2.7.x        | 2026-04-25 | Maintenance       | :white_check_mark: Critical only | >= 14    |
| 2.6.x        | 2026-04-25 | Maintenance       | :white_check_mark: Critical only | >= 14    |
| 2.5.x        | 2026-04-25 | EOL after 2026-07 | :warning: Until 2026-07-31 | >= 14    |
| 2.0.x – 2.4.x| 2026-02-14 → 2026-04-25 | EOL  | :x:            | n/a      |
| 1.x          | 2026-02-01 | EOL               | :x:            | n/a      |

"Critical only" = a CVE rated **High** or **Critical** that is
exploitable in default configuration. Lower-severity issues are fixed
in the **Current** line only; please upgrade.

The `Current` line is whichever minor is the latest published release
on npm. We aim to keep the previous two minors in *maintenance* and
will publish patch releases for them when needed.

### Supported Node.js versions

The CI matrix runs on **Node 18, 20, and 22** across macOS, Linux, and
Windows. `engines.node` is `>=14.0.0`, but we cannot guarantee
security back-ports for Node versions that are themselves EOL upstream
(see [nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases)).

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, use one of the following private channels:

1. Open a [GitHub security advisory](https://github.com/ricardo-foundry/terminal-quest-cli/security/advisories/new)
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
