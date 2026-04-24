# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.3.0] - 2026-04-25

### Added (v2.3 robustness + cross-platform)
- `src/wcwidth.js` — dependency-free East-Asian-Width calculator.
  Exports `visualWidth`, `padVisual`, `padVisualStart`, `centerVisual`,
  `truncateVisual`, `wrapVisual`, `stripAnsi`, `isWide`, `isZeroWidth`.
  Correctly treats CJK / Hangul / kana / fullwidth / emoji as width 2
  and combining marks / ZWJ / VS / ANSI CSI as width 0.
- `src/terminal.js` — capability detector. Honours `NO_COLOR`,
  `--no-color`, `FORCE_COLOR`, `COLORTERM=truecolor`, `TERM=dumb`,
  non-TTY pipes, and Windows build-number probing. Exposes
  `getCapabilities()` (memoised) and `refresh()`.
- Four-step colour degradation chain in `src/themes.js`:
  truecolor (hex) -> 256-colour (named) -> 16-colour (named) ->
  plaintext ASCII decorators (`[WARN] `, `[ERROR] `, `[OK] `, `>> `, `* `).
- `bin/terminal-quest.js` new flags: `--no-color`, `--new` (archive old
  slot & start fresh), `--export-save <slot>` (print JSON to stdout),
  `--import-save <file> <slot>` (load external JSON into a slot).
- `src/save.js` corruption handling: unparseable saves are renamed
  `<slot>.json.bak.<timestamp>` and `load()` returns `null` so the
  next run starts clean. 1 MiB soft-cap warning on large saves.
  New exports: `exportSlot`, `importSlot`, `isValidSave`,
  `backupCorrupt`, `MAX_SAVE_BYTES`.
- `docs/CROSS_PLATFORM.md` — platform / Node matrix, degradation
  chain, path-handling vocabulary, known limitations, opt-out table.
- 61 new tests — `wcwidth.test.js` (25), `themes.test.js` (11),
  `cross-platform.test.js` (10), plus extensions to `save.test.js` (11)
  and `commands.test.js` (9). Total test count 51 -> 112.

### Changed
- `src/ui.js` delegates `visualWidth` / `padVisual` / `centerVisual` /
  `truncateVisual` / `wrapVisual` to `src/wcwidth.js` so every panel,
  table and progress bar shares one EAW table.
- `src/game.js#normalizePath` now uses `path.posix.resolve` under the
  hood and coerces any Windows backslash input to forward-slash. The
  virtual filesystem is posix on every host.
- `CommandSystem#execute` strips C0/C1 control bytes (`\x00-\x1f`,
  `\x7f`), truncates input > 1000 chars, and caps alias re-expansion
  at 8 rewrites to defeat cyclic aliases.
- `cmdGrep` replaced its escaped-regex implementation with plain
  `String.includes`, preventing any ReDoS shape from user input.
  Pattern length capped at 200.
- `cmdFind` pattern length capped at 200.
- Applied `@param` / `@returns` JSDoc tags to every public function in
  `src/save.js`, `src/wcwidth.js`, `src/terminal.js`, `src/themes.js`,
  `src/ui.js` (`applyTheme`, `rainbow`), and `src/game.js`
  (`normalizePath`).

### Fixed
- Corrupted save files no longer throw on startup; they are quarantined
  and the player gets a fresh state.
- Oversized input pastes no longer hang the REPL — they are truncated
  and the player is told.
- Pathological regex-shaped `grep` queries (`(a+)+$`, etc.) are no
  longer evaluated as regex and cannot trigger ReDoS.
- Windows path separator pasted into `cd` is coerced to `/` before
  resolution; previously `cd foo\\bar` returned a non-existent path.

## [2.2.0] - 2026-04-25

### Added (v2.2 visual & demo)
- README rebuilt around a 30-second pitch: hero ASCII art, eight badges,
  `npx terminal-quest-cli` callout, "What does it look like?" embedded
  ASCII session, 3x3 feature grid and a "Why another text adventure?"
  differentiator section.
- `docs/ascii-logo.txt` — large logo for splash screens / GitHub social
  preview replacements.
- `docs/og-card.svg` — 1200x630 social card for Twitter / OG / LinkedIn
  link previews.
- `docs/session-transcript.md` — verbatim 50-line sample play session
  used as the README demo.
- `docs/demo.cast.placeholder` — instructions for capturing the real
  asciinema recording (command, validation, embed snippet).
- `docs/RELEASING.md` — npm publish checklist (bump -> tag -> push ->
  GitHub Actions provenance publish, plus rollback notes).
- JSDoc `@module` headers on every file in `src/` describing
  responsibilities, exports and side-effect contracts.

### Changed
- `package.json#files` now ships `docs/` and `CHANGELOG.md` alongside
  `bin/`, `src/`, `README.md`, `LICENSE`. Description rewritten in
  English to surface better in npm search.
- Bumped `version` to 2.2.0 (no behaviour break vs 2.1).
- `.npmignore` rebuilt to whitelist-friendly: explicit excludes for
  test/, dev configs, `.github/`, `install.sh`, `PUBLISH.md`, plus
  large recording artefacts (`*.cast`, `*.gif`, `*.mp4`).

### Fixed
- `cmdLoad`: after loading a slot, the in-memory `achievements` map
  now includes `EXTRA_ACHIEVEMENTS` *and* re-attaches their `check`
  functions (lost across the JSON round-trip). Without this fix,
  every auto-unlock check silently returned undefined after `load`.
- `cmdCd`: gate checks (level + day/night `accessRule`) now run
  strictly before any state mutation. Previously `shadow_walker`
  was awarded even if a subsequent gate denied the move, leaking
  achievement state on a no-op `cd`.

### Added (v2.1 content depth)
- 16 extra achievements spanning exploration, puzzle, combat, collection,
  speedrun and hidden categories. Auto-evaluator runs every turn.
- Three new minigames: reaction QTE (`run qte`), logic-circuit solver
  (`run logic`) and morse-code decoder (`run morse`), each with a pure
  evaluator exported for unit tests.
- Two new areas: abandoned research lab at `/world/lab/` and underground
  archive at `/shadow/archive/`, both with their own NPCs and lore.
- NPC mood system - greetings and dialog branches change with the player's
  kindness/ruthless alignment (`talk <npc> <choice-id>`).
- `achievements` grouped display by category, plus `share` command that
  writes an ASCII art score card to `~/.terminal-quest/shares/`.
- Alias system (`alias name=value`, `unalias`, persisted per save), shell
  history features (`history`, `!!`, `!<n>`) and a `complete <prefix>`
  tab-completion helper.
- In-game time and day/night cycle (dawn/day/dusk/night), with `wait`,
  `sleep`, `look` and `time` commands. Some areas are phase-gated.
- Inventory table UI grouped into consumables / equipment / key items /
  collectibles.

### Added (earlier in this release)
- GitHub issue and pull request templates, CI matrix across Node 18/20/22 on
  Ubuntu, macOS and Windows.
- `publish-npm.yml` workflow that publishes tagged releases to the npm registry
  with npm provenance.
- `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.editorconfig`, `.prettierrc.json` and a
  minimal `.eslintrc.json`.
- Dependabot config for npm and GitHub Actions dependencies.
- `docs/` directory with `COMMANDS.md` and `SAVE_FORMAT.md` references.
- README rewritten in an open-source friendly style with badges, feature list,
  CLI flags table and a Chinese quick reference.

### Changed
- `CHANGELOG.md` now follows the Keep a Changelog structure with version
  deltas from `v1.0.0` to `v2.0.0` and an Unreleased section.
- Test suite grew from 24 to 51 tests covering achievements, share cards,
  time cycle, new minigames and the alias/history system.

## [2.0.0] - 2026-02-14

This is a large rewrite that splits the monolithic entry file into a small,
testable `src/` module tree and ships a real `bin/` CLI.

### Added
- Modular `src/` layout: `game.js`, `commands.js`, `data.js`, `ui.js`,
  `minigames.js`, `i18n.js`, `save.js`, `themes.js`.
- Multi-slot save system stored under `~/.terminal-quest/saves/*.json` with a
  `schemaVersion` field and automatic migration from the legacy single-file
  save.
- Bilingual UI (English / Chinese) selectable at runtime or via `--lang`.
- Theme engine with `dark`, `light` and `retro` presets, switchable in-game or
  via `--theme`.
- 18 achievements that grant EXP on unlock, a 7-tier level progression and an
  inventory for key fragments and quest items.
- 5 minigames: snake, guess-the-number, matrix-rain, pong and a Wordle clone.
- 12 main-story quests, guide / merchant NPC dialogues and an endgame secret.
- 5 explorable zones with hidden files, encrypted notes and three key shards.
- Node's built-in test runner: 24 tests covering commands, i18n, minigames,
  game state and the save subsystem.
- `bin/terminal-quest.js` entry point with `terminal-quest`, `tq` and
  `adventure` binaries.
- `CONTRIBUTING.md` with setup, architecture and testing guidance.

### Changed
- `package.json` bumped to `2.0.0`, `engines.node` pinned to `>=14.0.0`, and
  `files` narrowed to `bin/`, `src/`, `README.md`, `LICENSE` for a smaller tarball.

### Fixed
- Non-TTY environments (CI, pipes) now degrade gracefully instead of crashing
  on `process.stdin.setRawMode`.

## [1.0.0] - 2026-02-01

### Added
- First public release.
- Terminal filesystem explorer with `ls`, `cd`, `cat`, `pwd` and friends.
- Hidden-file discovery mechanic.
- Early achievement prototype.

[Unreleased]: https://github.com/Ricardo-M-L/terminal-quest-cli/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/Ricardo-M-L/terminal-quest-cli/compare/v2.0.0...v2.2.0
[2.0.0]: https://github.com/Ricardo-M-L/terminal-quest-cli/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Ricardo-M-L/terminal-quest-cli/releases/tag/v1.0.0
