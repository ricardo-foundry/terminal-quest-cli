# Journey: iter-1 → iter-16

The development of `terminal-quest-cli` was structured as a chain of
short, single-day "iterations". Each iteration left a tagged commit on
its own `iter-NN-*` branch, and every branch ran the full test suite
green before the next one started.

This document is a one-stop timeline so a new contributor (or a future
us) can see *why* a given file or feature exists, without re-reading
every commit body.

| Iter | Branch                       | Theme                                  | Headline outcome                                                                                  | Test count |
| ---- | ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| 1    | `main` (initial)             | Initial import + modular refactor      | Monolithic `index.js` split into `src/`; first 24 tests; bilingual EN/ZH UI.                     |  24        |
| 2    | `iter-2-oss-hygiene`         | OSS hygiene + CI                       | Code of conduct, Dependabot, GH Actions matrix (Node 18/20/22 × macOS/Linux/Windows), publish workflow. |  24        |
| 3    | `iter-3-content-depth-v2.1`  | Content depth v2.1                     | 16 new achievements, NPC mood system, day/night cycle, `share` ASCII card, alias/history.        |  51        |
| 4    | `iter-4-readme-rebuild-v2.2` | Visual + demo (v2.2)                   | README rewrite around 30-second pitch, OG card, ASCII logo, demo SVG, Round-3 fixes.             |  51        |
| 5    | `iter-5-robustness-v2.3`     | Robustness + cross-platform (v2.3)     | `wcwidth.js`, `terminal.js`, four-step colour fallback, save corruption quarantine, +61 tests.   | 112        |
| 6    | `iter-6-launch-prep-v2.4`    | Quests + launch prep (v2.4)            | JSON quest loader, replay system, cloud-save stub, 3 new NPCs, 2 new minigames, launch docs.     | 171        |
| 7    | `iter-7-polish-v2.5`         | Reflection + polish (v2.5)             | Update-in-place cloud sync, hot-reload `--dev` quest watcher, `--new` `.bak`, SVG demo capture.  | 176        |
| 8    | `iter-8-final-polish-v2.5`   | Final polish (v2.5 follow-up)          | 3 more quests (`ghost-train`, `library-cipher`, `midnight-market`), real asciinema cast.         |  ~190      |
| 9    | `iter-9-runtime-qa`          | Runtime playthrough QA                 | `scripts/runtime-playthrough.js` drove the bin headlessly, surfaced 3 real bugs, all fixed.       |  ~210      |
| 10   | `iter-10-final-mile`         | Final mile + `ja` locale               | Interactive quest builder (`--validate-quest=new --interactive`), Japanese pack, polish.         |  ~246      |
| 11   | `iter-11-org-rename`         | Repo rename                            | `Ricardo-M-L` → `ricardo-foundry` URL flip across docs and badges. No version bump.              |  246       |
| 12   | `iter-12-content-depth`      | Content depth v2.6 (1 of 2)            | 3 minigames (sokobax / sliding / connect3), seasons, NPC affinity, 3 community quests.            | 261        |
| 13   | `iter-13-finishing-touches`  | Finishing touches v2.6 (2 of 2)        | Quest reward items in world tree, `:dev wait-season`, campfire item, v2.6 release commit.        |  ~271      |
| 14   | `iter-14-locales-leaderboard`| Locales + leaderboard v2.7             | `zh-tw` + `es` packs, 5 new achievements, local leaderboard, Markdown reports, retro polish.     | 294        |
| 15   | `iter-15-quest-pack`         | Quest pack + TTS v2.8 (1 of 2)         | 3 season-locked quests (cyber-bazaar / forgotten-archive / orbital-station), opt-in TTS, tutorial command, USER_GUIDE.md. | 317        |
| 16   | `iter-16-bug-bash`           | Deep bug-bash                          | `exhaust-quests.js` + `fuzz-commands.js`, 1 real bug fixed (`time.advance` overflow), Known-Limitations section, +21 tests. | 338        |

## Cumulative numbers at the end of iter-16

- **Tests:** 338 (Node built-in test runner, no extra deps)
- **Quests:** 11 community-format quests in `quests/` (all schema-v1)
- **Locales:** 5 (`en` / `zh` / `zh-tw` / `ja` / `es`), all 76/76 keys
- **Minigames:** 11 listed in the README cheat sheet (snake, guess,
  matrix, pong, wordle, qte, logic, morse, sokobax, sliding,
  connect3); two more (`chess`, `cipher`) ship as bonus
- **Achievements:** 39, in 6 categories
- **Runtime deps:** 3 (`chalk`, `figlet`, `keypress`) — unchanged
  since v2.0
- **Supported Node versions:** 18 / 20 / 22 (CI matrix)

## Design principles that survived every iteration

1. **No new runtime deps after v2.0.** Every later iteration audits
   itself against this rule. `tts.js`, `wcwidth.js`, `terminal.js`,
   `season.js`, `leaderboard.js`, `tutorial.js` are all built on
   Node stdlib only.
2. **Saves are forward-compatible.** Every state field added between
   v2.0 and v2.8 has a default that `load()` can synthesise from a
   missing key, so an old save never crashes a new build.
3. **Pure helpers, exported.** Minigames, quests, season math,
   relationships, and the predicate evaluator all expose pure
   functions so tests can drive them without a TTY.
4. **Degrade, don't crash.** Non-TTY, `NO_COLOR`, missing speech
   engine, unsupported `fs.watch` mode, OOB save bytes — every one
   of these is handled by silently degrading rather than aborting.
5. **Folder name == quest id.** A small constraint that paid for
   itself the moment community packs started landing.

## What iter-17 (this branch) did not do

- No version bump — the package stays at `2.8.0` (RC).
- No new dependencies, no new features, no source-level edits to
  `src/` or `bin/`.
- iter-17 was scoped to documentation consolidation only:
  this `JOURNEY.md`, the README badges row, the CHANGELOG
  v1.0 → v2.8 sweep, and a SECURITY support-range refresh.
