# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (iter-20 — easter egg + polish, no version bump)
- **Hidden quest `echo-of-claude`** (`quests/echo-of-claude/quest.json`):
  - Lives at the previously-hidden path `/var/log/sessions/`.
  - Triggered by `cat /var/log/sessions/ghost.log`.
  - Theme: a quiet tribute to Claude Code — "a benevolent assistant
    haunts the terminal" (no direct AI namedrop, in keeping with
    the in-world voice).
  - Three branches keyed off alignment: `merge` (>=+3),
    `dismiss` (<=-3), `thanks` (default neutral).
  - Drops a `ghost-token` collectible.
- **`ghost_in_the_machine` achievement** (`src/achievements.js`,
  hidden category) unlocks on completing any branch of the quest.
- **New NPC `ghost`** (`data.js#NPCS`) with mood-aware lines and a
  three-choice dialog tree feeding the quest's branch picker.
- **Hidden flag `--credits`** (`bin/terminal-quest.js` +
  `src/credits.js`): scrolling contributor roll with ASCII art.
  Credits are slow-rolled in TTY mode and one-shot in CI/pipes
  (controlled by `TQ_FAST_CREDITS=1`). Names: Ricardo
  (`ricardo-foundry`) and Claude Code.

### Changed (iter-20)
- **`cmdHelp` is now alphabetised within each section** (`ui.js`).
  Section ordering (Basic -> Advanced -> RPG -> Meta -> Hidden) stays
  hand-curated; only the verb rows inside each section sort.
- Lang line in the `Meta` help block now lists every supported
  locale (`en | zh | zh-tw | ja | es`) instead of the legacy
  `en | zh`.

### Tests (iter-20)
- `test/iter20-easter-polish.test.js` adds 5 new tests covering
  quest validation + discovery, three-way branch picking, the
  hidden achievement check, the credits roll content, and that
  every help section is alphabetised. Total: 348 -> 353 tests.

### Added (iter-19 — New Game+ and idle detection, no version bump)
- **New Game+ mode** (`src/ngplus.js`):
  - Unlocked once the player finishes the main story (the
    `unlock_master` quest, or any save with `masterUnlocked === true`,
    or the legacy `unlock_master` achievement).
  - Boot with `--ng` (alias `--new-game-plus`) to roll the slot into
    a fresh playthrough that carries forward:
    achievements, NPC affinities, talk counts, locales played,
    cumulative `totalCommands` / `totalPlaytimeMs`, an incremented
    `ngCount`, and the `communityQuestState` map (so finished
    community arcs are tagged in `unlockedQuestIds`).
  - World-progression fields (visited dirs, inventory, key fragments,
    `masterUnlocked`, alignment) all reset.
  - Old slot is archived to `<slot>.archived-<ts>` before NG+ writes.
  - `ngGreeting()` decorates NPC dialogue with
    `"Welcome back, traveler... "` while in NG+; cycle 2+ shows
    `"Welcome back again, traveler... (cycle N). "`.
  - Welcome banner (`game.js#showWelcome`) shows the NG+ cycle count
    in gold once the run loads.
- **5 New Game+ exclusive achievements** (`src/achievements.js`):
  - `recurring_soul` (♻) — begin a NG+ cycle, +300 EXP.
  - `echo_of_past` (🪞) — revisit `/world/nexus` in NG+, +180 EXP.
  - `second_dawn` (🌄) — see a dawn cycle in NG+, +180 EXP.
  - `ouroboros` (🐍) — reach the third NG+ cycle, +500 EXP.
  - `mentor_to_self` (🧓) — re-finish the `unlock_master` quest in
    NG+, +600 EXP. All five share the new `ngplus` category.
- **Idle / AFK detection** (`createIdleTimer` in `src/ngplus.js`):
  - Soft prompt at 5 minutes idle: `"[idle] Are you still there?"`
    (does not exit the REPL, just nudges).
  - Hard threshold at 10 minutes: autosave plus
    `"[idle] 10 minutes of inactivity — auto-saved."` warning.
    The game stays alive — typing any command resumes normally.
  - The timer is tick-based (`now()` + `schedule()` shims) so tests
    drive it deterministically without real `setTimeout` clocks.
  - Wired into `game.js#startInputLoop`: every `rl.on('line')`
    bumps the timer; `rl.on('close')` stops it.
- **Tests** (`test/ngplus.test.js`, +10): hasUnlockedNgPlus across
  three milestone shapes, full carry-over via `buildNgPlusState`,
  `ngGreeting` toggle, idle timer with mocked clock (soft+hard,
  bump-resets), idle once-per-bump invariant, all 5 NG+ achievements
  registered with the `ngplus` category, NG+ rollover via the
  actual `TerminalGame` class, cumulative totals across two cycles.

### Changed (iter-19)
- `bin/terminal-quest.js` parses `--ng` / `--new-game-plus`. Refuses
  with a clear stderr if the slot hasn't completed the main story.
- `src/game.js#DEFAULT_STATE` gains `ngPlus`, `ngCount`,
  `ngAchievements`, `unlockedQuestIds`, `totalCommands`,
  `totalPlaytimeMs`. All default to safe falsy values; old saves
  pick them up via the spread merge in `loadGameState()`.
- `src/commands.js#cmdTalk` runs the NPC greeting through
  `ngGreeting(line, state)` so dialogue updates are uniform.
- No new runtime dependencies. No version bump (still v2.8.0).
  Test count rises from 338 to 348.

### Documentation (iter-17 — final consolidation, no version bump)
- New `docs/JOURNEY.md` — end-to-end timeline of iter-1..iter-16
  with theme, headline outcome, and running test count per iter.
- README badge row gains four counters: tests `338+`, quests `11`,
  locales `5 (en | zh | zh-tw | ja | es)`, minigames `11`. No
  badge URL points outside the repository.
- `SECURITY.md` adds a real support-range table (current /
  maintenance / EOL per minor), spells out "critical only" policy
  for previous minors, and documents the supported Node.js matrix.
- `CHANGELOG.md` footer rebuilt: `[Unreleased]` now compares to
  `v2.8.0`, and entries for `v2.6.0`, `v2.7.0`, `v2.8.0` link to
  proper compare URLs (the previous footer stopped at `v2.5.0`).
- No source files in `src/` or `bin/` were touched. No new runtime
  or dev dependencies. Test count stays at **338**.

### Added (iter-16 — deep bug-bash, no version bump)
- `scripts/exhaust-quests.js` — synthesises a `gameState` for every
  quest's friendly / neutral / hostile branch and asserts
  `completed`/`pickBranch` for all 11 quests.
- `scripts/fuzz-commands.js` — 100 random / pathological inputs
  (NUL bytes, RTL overrides, long pastes, history bangs,
  `:` meta prefix, unicode salad) routed through
  `CommandSystem.execute`. No unhandled exceptions surface.
- `test/iter16-bugbash.test.js` — 21 new tests covering
  time-advance overflow, quest folder/id mismatch, alias chain
  length 8 / 12, empty stdin, EOF, payload truncation,
  `evalCustomPredicate` sandbox, large save round-trip, corrupted
  save recovery, locale parity, history bang on empty, branch
  picker priority, `completionsFor` uniqueness,
  `orbital-station` `hasItem` chain enforcement.
- README "Known limitations" section enumerating every
  intentional cap (alias chain depth, save bytes, time-advance
  clamp, predicate sandbox tokens, fs.watch best-effort, TTS host
  dependency, folder/id rule).

### Fixed (iter-16)
- `src/time.js#advance` no longer throws `RangeError` on
  `advance(state, 1e10)`. Now clamps to one in-game year per call
  (120 turns) and tolerates `NaN` / `Infinity`. Reachable via the
  public API even though current call sites already cap inputs.

## [2.8.0] - 2026-04-25 (draft)

### Added (v2.8 quest pack + TTS — Round 15)
- **3 new community quests** in `quests/`:
  - `cyber-bazaar` — summer-only market with branching endings
    (broker_friend / smuggler / fair_buyer). Chains together
    `season=summer`, `affinity{shop}>=25`, and `hasItem` proofs
    from earlier quests.
  - `forgotten-archive` — autumn / winter archivist arc; uses
    `season` (array form), `affinity{keeper}>=40`, `decodeFile`,
    `hasItem`, `keyFragments`, and a `custom` predicate
    (`turn >= 60`) for slow-burn pacing.
  - `orbital-station` — winter endgame. Requires items from the
    other two new quests (`bazaar-pass`, `archive-stamp`) plus
    affinity 50 with the guide AI and all three master-key
    fragments. Three branches (hero / saboteur / operator).
- **Optional text-to-speech** (`src/tts.js`):
  - Auto-detects `say` (macOS), `espeak` / `espeak-ng` (Linux),
    or PowerShell SAPI (Windows). Falls back to a silent no-op
    on any other platform.
  - **Zero new runtime dependencies** — everything is
    `child_process.spawn` with `shell: false`, ANSI-stripped /
    control-byte-scrubbed, capped at 500 chars per utterance.
  - Off by default. Enable with `--tts` at boot, or in-game
    with `tts on`. `tts status` shows the engine; `tts off`
    mutes and kills any inflight speech.
  - NPC dialog (`talk`) is the first surface to be piped through
    TTS when enabled.
- **`tutorial` in-game command** (`src/tutorial.js`):
  - 12-step, ~5-minute new-player walkthrough covering every
    pillar (navigation, scan/decode, NPCs, gifts, seasons,
    bookmarks, quests, sharing).
  - Pure step generator + REPL-friendly runner. The runner
    NEVER auto-executes commands — it only prints guidance, so
    re-running `tutorial` is safe at any point in a save.
  - Soft-grants `took_the_tour` so completion is trackable
    (achievement metadata can land in a follow-up).
- **`docs/USER_GUIDE.md`** — full player handbook covering CLI
  flags, every in-game command, quests, relationships, seasons,
  achievements, TTS, and save data.
- **23 new tests** (294 → 317):
  - `test/tts.test.js` — sanitiser, mock engine spawn capture,
    `detectEngine` shape, disabled / empty / control-byte paths,
    `close()` safety.
  - `test/tutorial.test.js` — step ordering, ~5-min runtime
    bound, render shape, `runTutorial` side-effects on
    `tutorialSeen` + achievement list.
  - `test/iter15-quests.test.js` — validate the three new
    quests, assert each uses at least one new trigger
    (`season` / `affinity` / `hasItem`), each has 3+ branches
    with exactly one default, and the full `loadQuests()` scan
    surfaces all of them.

### Changed
- `DEFAULT_STATE` in `src/game.js` gains `tutorialSeen` so future
  versions can suppress the boot-time "type cat start_here.txt"
  hint after the tour was viewed.
- `TerminalGame` constructs a `createTTS()` adapter on init, even
  when disabled, so call sites can do `this.tts.speak(...)`
  unconditionally.
- `bin/terminal-quest.js` learns the `--tts` flag and prints it
  in `--help`. The in-game help block lists `tutorial` and
  `tts on|off|status`.
- `package.json` bumped to **2.8.0**, no new runtime deps (still
  `chalk`, `figlet`, `keypress`).

### Compatibility
- Saves are forward-compatible. `tutorialSeen` defaults to false
  when missing and never breaks an old save.
- The TTS adapter is a no-op on every platform we cannot detect,
  so existing CI / headless environments are unaffected.

## [2.7.0] - 2026-04-25

### Added (v2.7 locales + leaderboard — Round 14)
- **Two new locales** in `src/i18n.js`:
  - `zh-tw` (Traditional Chinese) — derived from `zh` with regional
    vocabulary (軟體 vs 软件, 啟用 vs 启用, 偵測 vs 检测, 預設 vs 默认,
    程式 vs 程序, 資料 vs 数据, …). Full 76-key coverage.
  - `es` (Spanish) — full hand translation, 76/76 keys covered.
- **Smarter `detectLocale()`** that routes `LANG=zh_TW.UTF-8`,
  `zh_HK.*`, and `zh-Hant*` to the new `zh-tw` locale before the
  generic `zh*` prefix. `LANG=es_ES.UTF-8` (and `es_MX.*` etc.)
  routes to `es`.
- **5 new achievements** in `src/achievements.js`:
  - `polyglot` — play with 4+ unique locales active.
  - `night_shift` — survive 12 consecutive night phases.
  - `merchant_friend` — affinity ≥ 80 with the merchant (`shop`).
  - `completionist_quest` — finish 5 quests (built-in + community
    combined).
  - `silent_runner` — finish a quest without ever opening
    `history`. Once you peek at `history`, the gate closes for
    the rest of the save.
- **Local leaderboard** (`src/leaderboard.js`): scans every save
  slot in `~/.terminal-quest/saves`, builds a weighted score from
  level / EXP / achievements / quests / locale variety / NPC
  affinity peak, and exposes `top`, `top <n>`, `top export`, and
  `top import <file>` commands. The export format wraps machine-
  parseable `LBE { … }` JSON lines inside a sentinel block so it
  survives being pasted into chat or a forum post.
- **Markdown war-story report** (`report` command): writes
  `~/.terminal-quest/reports/<slot>-<ts>.md` with a snapshot, the
  unlocked achievements list, completed quests (built-in +
  community, including branch endings), the visited-directory
  footprint, the favourite NPC, and the inventory.
- **CLI polish**:
  - `--theme retro` now distinguishes `success` / `gold` from
    `primary` (was `#FFB000` for both, making OK lines invisible
    against the amber CRT background). Bumped to `#FFE060`.
  - `--no-color` now also re-applies the active theme so the live
    `colors` palette in `ui.js` (which was bound at require-time
    before `NO_COLOR` was set) gets rebuilt with plaintext
    decorators. Result: prompt and ANSI escapes are *both* gone
    instead of just the body text.
  - `applyTheme` syncs `chalk.level` with the current capability
    detection so a late `NO_COLOR` is honoured by every existing
    `chalk.hex(...)` palette function.
- **23 new tests** (271 → 294+) across `i18n.test.js`,
  `achievements.test.js`, the new `leaderboard.test.js`, and
  `report.test.js`.

### Changed
- `DEFAULT_STATE` in `src/game.js` now carries `localesUsed`,
  `nightSurvivedStreak`, `lastNightTurn`, `historyOpened`, and
  `playtimeMs` so the new achievements have somewhere to live.
- `cmdLang` records the new locale into `gameState.localesUsed`.
- `cmdHistory` flips `gameState.historyOpened = true` once.
- `advanceTime` bumps `nightSurvivedStreak` whenever a `dawn`
  phase boundary is crossed without alignment dipping below the
  running minimum.
- `docs/I18N_COVERAGE.md` documents the new locales and the
  detection priority (zh-tw checked before zh).
- `package.json` bumped to **2.7.0**, no new runtime deps (still
  `chalk`, `figlet`, `keypress`).

## [2.6.0] - 2026-04-25

### Added (v2.6 content depth — Round 12 + Round 13)
- **3 new minigames**: `sokobax` (push-the-box / sokoban),
  `sliding` (15-puzzle), and `connect3` (text-mode match-3). All
  three keep pure helpers exported so tests can drive moves and
  check state without a TTY.
- **3 new community quests**: `clockwork-vault` (mid-game heist),
  `wandering-merchant` (season-gated trade quest), and
  `silicon-shrine` (spring-only morse pilgrimage). Each is a
  schema-version-1 quest that round-trips through
  `--validate-quest`.
- **NPC affinity / relationships** (`src/relationships.js`): every
  NPC now has its own -100..+100 counter with a 5-mood ladder
  (`adoring` / `friendly` / `neutral` / `cold` / `hostile`),
  per-item gift table, talk-tick decay cap, special high-affinity
  dialog, and a one-time special-item grant.
- **Gift loop**: `gift <item> to <npc>` consumes an inventory
  item, adjusts affinity per the gift table, may unlock a special
  line, and can grant a bound special item the first time the NPC
  reaches `adoring`. v2.6 (iter-13) also explicitly fires
  `checkQuests` after a gift so quest progress updates immediately.
- **Seasons** (`src/season.js`): a 4-season / 120-turn cycle layered
  on top of the existing 24-turn day/night clock. Quests can
  gate steps with `{ "type": "season", "season": "spring" }` or an
  array of seasons. `npcAvailable` closes the shop in winter, the
  merchant in winter, and the researcher in summer. The prompt
  badge shows `🌸 Spring (12/30)`-style text.
- **Bookmarks + fast travel**: `bookmark <name>` records the
  current path, `bookmarks` lists them, `goto <name>` `cd`s back.
  Names are validated to `[a-z0-9_-]{1,32}` so a hand-edited save
  cannot inject control characters.
- **Reward items in the world** (v2.6 / iter-13): `master-gear`,
  `forbidden-lantern`, `wanderer-map`, `shrine-token`, and a new
  `campfire` consumable can all be found by reading flagged files
  in the world tree. Quest rewards still apply on top, so a
  completionist can hold both copies.
- **`campfire` item**: `use campfire` consumes the kit and skips
  the rest of the current season in one turn — useful for
  unblocking season-gated quests.
- **`:dev wait-season` command** (--dev only): jumps the turn
  counter to the next season boundary, prints the season
  transition, and is no-op outside `--dev`.
- **Generic file-pickup mechanism** in `cmdCat`: any file with a
  `givesItem` string drops that item into the inventory the
  first time it is read. Replaces the hard-coded
  `abyss-gazer-eye` branch as the canonical pickup pattern.
- **15+ new tests** (246 → 261+) across `minigames`, `season`, and
  `relationships` covering edge cases (sokobax wall-blocking,
  sliding shuffle solvability, connect-3 swap rejection, season
  wrap, talk-tick cap, forbidden-gift drop, …).

### Changed
- `package.json` bumps to `2.6.0`. No new runtime dependencies.
- `README.md` features table now lists 11 minigames, the gift /
  affinity loop, seasons, and bookmark-based fast travel.
  Commands cheat sheet adds `gift`, `season`, `bookmark`,
  `bookmarks`, `goto`.
- `bin/terminal-quest.js --validate-quest` continues to validate
  every quest in `quests/`; CI verifies all 8 packs round-trip.

### Fixed
- `cmdGift` now explicitly calls `checkQuests` after granting an
  affinity bump so a gift that satisfies a quest trigger updates
  the quest log without waiting for the next command.

## [2.5.0] - 2026-04-25

### Added (v2.5 reflection + polish)
- `docs/RELEASE_v2.5.md` — full v1.0 → v2.5 timeline and publish
  checklist for maintainers.
- `docs/REPO_SETTINGS.md` — checklist of every GitHub repo setting
  (about box, topics, branch protection, social card, secrets) that
  has to be configured before tagging the first public release.
- `docs/GOOD_FIRST_ISSUES.md` — 10 ready-to-file
  `good-first-issue` templates spanning translations, quests, NPCs,
  achievements, themes, minigames and easter eggs.
- `docs/terminal-demo.svg` — pure-SVG, dependency-free,
  `<animate>`-driven 12-second / 4-scene terminal demo. Embedded at
  the top of `README.md` so the npm and GitHub previews show
  motion. Renders inline on github.com without any rasterisation.
- `scripts/record-session.js` — generator for `terminal-demo.svg`.
  Edit the `SCENES` table at the top of the file and re-run; pass
  `--check` for CI to fail when the asset is stale.
- `src/cloud.js#readMeta` / `writeMeta` and a per-host
  `~/.terminal-quest/cloud-meta.json` slot → gist-id mapping so
  `--cloud push <slot>` updates an existing gist rather than
  creating a new one each call. A 404 on the cached id falls
  through to a fresh POST and rewrites the cache.
- `src/game.js#reloadCommunityQuests` and `_startQuestWatcher` —
  `--dev` now `fs.watch`es `quests/` (recursive, 150 ms coalesce)
  and reloads the pack on change. Falls back to a no-op on
  platforms without recursive watch.
- 5 new tests (171 -> 176): `test/cloud.test.js` gains 3
  (update-in-place via PATCH, PATCH->404 POST fallover, corrupt
  meta tolerance), `test/quests.test.js` gains a hot-reload
  simulation against a tmp dir, and `test/save.test.js` gains an
  end-to-end `--new` `.bak` test that drives the bin via
  `execSync`.

### Changed
- `bin/terminal-quest.js#archiveSlot` now copies the slot to
  `<slot>.json.bak` before renaming it to the timestamped archive,
  so an accidental `--new` is recoverable without scanning for the
  timestamp.
- `src/game.js`: `minAlignment` is no longer re-seeded to the
  current alignment on every fresh process. A new
  `minAlignmentInit` boolean lives in the save envelope and gates
  the seeding to exactly once per save. The pacifist achievement
  now respects history across restarts.
- `package.json` bumps to `2.5.0`. No new runtime dependencies.
- `README.md` references `docs/terminal-demo.svg` directly under
  the badge row.

### Fixed
- Cloud sync no longer pollutes a user's gist account with one
  fresh gist per `push` cycle.
- Pacifist achievement could be silently un-earned by a load+save
  cycle that re-seeded `minAlignment` to a higher value.
- `--new` previously left the player one timestamped file with no
  obvious "latest" copy; the new `.bak` solves that.

## [2.4.0] - 2026-04-25

### Added (v2.4 quests & launch prep)
- `src/quests.js` — pluggable JSON quest loader with a v1 schema
  (`schemaVersion`, `id`, `title`, `steps[].triggers[]`, `rewards`,
  `branches`).  Supports 9 trigger types including a sandboxed
  `custom` predicate evaluator whose identifier set is whitelisted.
- `quests/starter-lab/quest.json` and `quests/shadow-archive/quest.json` —
  two official quests that exercise every trigger kind and include
  alignment-branched endings.
- `docs/QUEST_FORMAT.md` — full schema + contribution guide + example.
- `src/cloud.js` — experimental `CloudBackend` abstract class with a
  `GistBackend` reference implementation (GitHub Gist API, token via
  `GH_TOKEN`, fetch override for tests) and an in-memory backend for
  tests.  Exposed via new CLI flag `--cloud push/pull/list <slot>`.
  Not wired into the main game loop.
- `src/replay.js` — append-only replay recorder kept inside the save
  envelope (`state.replay`).  Capped at 500 events.  Playable via the
  in-game `replay [slot]` command or CLI `--replay <slot>`.  Uses
  setTimeout-based pacing with a pluggable sleep function for tests.
- 3 new NPCs: Librarian (`/library`), Conductor (`/station`), Keeper
  (mood dialog only).  Each with friendly / neutral / hostile moods
  and alignment-weighted choices where appropriate.
- 2 new scenes: `/library` (underground library with a quiet room and
  a loose diary page) and `/station` (old terminal station with a
  timetable, a conductor and a lost-property envelope).
- 5 new achievements: `completionist_v24`, `speedrunner_v24`,
  `historian_v24`, `pacifist`, `collector_v24`.  All auto-evaluated.
- 2 new minigames: `run chess` (mate-in-1 puzzle with forgiving input
  parsing) and `run cipher` (Caesar-cipher decoder with a tiny
  dictionary-based "looks like English" scorer).
- CLI DX: `--list-quests` (prints every loaded quest + failures) and
  `--validate-quest <path>` (exits non-zero on invalid JSON).  Help
  text expanded to cover every new flag and in-game command.
- `docs/CLOUD_SAVE.md`, `docs/LAUNCH_POST.md`, `docs/PRESS_KIT.md`,
  `docs/TWEET_DRAFTS.md`, `docs/REDDIT_POST.md`, `docs/FAQ.md` —
  launch-prep docs: English blog draft, 1-line / 1-para / 1-tweet
  press kit, 5 tweet angles, 3 subreddit templates, 10-question FAQ.
- `test/quests.test.js` (23 tests), `test/cloud.test.js` (9 tests),
  `test/replay.test.js` (11 tests), plus new cases in
  `test/minigames.test.js`, `test/achievements.test.js` and
  `test/game.test.js`.  Total test count 112 -> 171.

### Changed
- `src/game.js` now loads community quests at construction time and
  evaluates them every `checkQuests()` cycle, awarding exp/items on
  first completion.  A running `minAlignment` is tracked so the
  pacifist achievement can look backward.
- `src/commands.js` records every executed command into the replay
  buffer and exposes `replay` / `communityquests` in-game commands.
- `package.json` bumps to `2.4.0` and ships `quests/` in the tarball.
- No new runtime dependencies.

### Fixed
- Quest folder name / quest id mismatches are surfaced in
  `--list-quests` output rather than silently skipped.
- `replay` playback uses a pluggable sleep function so tests are
  fully deterministic — we no longer rely on real wall-clock timers.

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

[Unreleased]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v2.8.0...HEAD
[2.8.0]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v2.0.0...v2.2.0
[2.0.0]: https://github.com/ricardo-foundry/terminal-quest-cli/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/ricardo-foundry/terminal-quest-cli/releases/tag/v1.0.0
