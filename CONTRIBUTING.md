# Contributing to Terminal Quest CLI

Thank you for your interest! This project is a Node.js CLI text-adventure
game and we welcome pull requests, issue reports, documentation fixes,
translation work, and ideas for new areas / puzzles / mini-games.

## Getting started

```bash
git clone https://github.com/kimi-ai/terminal-quest-cli.git
cd terminal-quest-cli
npm install
npm test
npm start   # launch the game
```

Requires Node.js **>= 18**.

## Project layout

```
bin/              CLI entry
src/
  game.js         main loop, state, signals
  commands.js     command dispatcher + parser
  minigames.js    snake, guess, matrix, pong, wordle
  data.js         world data (file system, NPCs, quests, achievements)
  ui.js           rendering, animations, box drawing
  i18n.js         locale dictionary
  save.js         save slots + schema migration
  themes.js       colour palettes
test/             node:test suites
```

## Running tests

```bash
npm test            # all tests
npm run test:watch  # re-run on change
npm run lint        # (optional) if eslint is configured
```

## Pull request checklist

- [ ] `npm test` passes locally.
- [ ] New behaviour is covered by at least one test.
- [ ] No new hard dependencies unless strictly needed.
- [ ] Strings are routed through `src/i18n.js` with both `en` and `zh`
      translations. When you add a key, add it to **both** locales.
- [ ] Save format changes bump `SCHEMA_VERSION` and include a migration.
- [ ] README updated if a new command / flag is added.

## Code style

- CommonJS (`require`) throughout.
- 2-space indentation, single quotes, trailing commas where legal.
- Keep modules small; prefer pure functions where possible.
- Avoid `console.log` in library code unless it's user-facing output.
- Do not introduce heavy dependencies (the CLI must start quickly).

## Filing issues

Please use the issue templates under `.github/ISSUE_TEMPLATE/`. Include
your Node version (`node -v`), OS, and a minimal reproduction when
reporting a bug.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](./CODE_OF_CONDUCT.md).
By participating you agree to abide by its terms.

## License

Contributions are licensed under the MIT License.
