# Runtime QA Report — iter-9 (2026-04-25)

This report captures the iter-9 runtime QA pass: spawning the CLI in a
child process and feeding a sequence of player commands, then comparing
real output to expected milestones. Run on macOS 25.3 (Darwin) with
Node v22.

## How to reproduce

```bash
node scripts/runtime-playthrough.js          # asserts milestones, exit 0/1
TQ_DUMP=1 node scripts/runtime-playthrough.js # dump full stdout for inspection
node scripts/record-real-cast.js              # rebuild docs/demo-real.cast
```

Both scripts run in an isolated temporary `$HOME` so they cannot pollute
or corrupt the developer's real save directory.

## Coverage

| Surface             | Probed via                                     |
| ------------------- | ---------------------------------------------- |
| Boot / banner       | child stdout, milestone "[OK]"                 |
| Help                | `help`                                         |
| Filesystem traversal | `ls`, `ls -a`, `cd`, `cat`                    |
| Hidden discovery    | `scan` then `ls -a`                            |
| RPG status          | `status`, `inventory`, `quests`, `achievements`|
| Time/phase          | `time`, `wait`                                 |
| Aliases & history   | `alias`, `alias gg=status`, `history`          |
| Theme / language    | `theme retro`, `lang en`                       |
| Search              | `find readme`                                  |
| Save / list         | `save smoke-test`, `saves`, `version`          |
| Exit                | `exit` plus stdin EOF                          |

CLI flags exercised separately (no game start required):

- `--version` → prints, exits 0
- `--help` → prints usage, exits 0
- `--no-boot` → boot animation skipped, banner still shown
- `--list-quests` → 5 quests, exits 0
- `--validate-quest quests/starter-lab/quest.json` → ok, exits 0
- `--export-save <missing>` → "no save found", exits 2
- `--import-save` (no args) → usage, exits 2
- `--replay <missing slot>` → "no save found", exits 2
- `--validate-quest <missing path>` → "invalid", exits 2
- `--cloud` (no op, no GH_TOKEN) → usage, exits 2 (was: launched the game) ← see Bug #1
- `--cloud list` (no GH_TOKEN) → "GH_TOKEN env var not set", exits 2

Corrupt save resilience:

- A garbage JSON in `~/.terminal-quest/saves/default.json` does NOT crash;
  the loader falls back to defaults silently.
- A valid envelope with empty `state` boots cleanly.

## Bugs found and fixed

### Bug #1 — `--cloud` with no operation silently dropped into game

`bin/terminal-quest.js`. The arg parser stored `cloudOp = argv[++i]`
which was `undefined` when the user typed only `--cloud`. The dispatcher
then guarded with `if (args.cloudOp)`, so the game booted normally
instead of printing usage. Fix: introduce a boolean `cloudFlag` and
gate dispatch on that, while `runCloud` itself prints the proper usage
and exits 2.

### Bug #2 — `find` with empty pattern dumped the entire 77-entry filesystem

`src/commands.js#cmdFind`. `find` with no argument called
`(''.toLowerCase()).includes('')` which is `true` for every name, so the
command listed every file and directory recursively. That is not the
shell `find` behaviour, and it leaks gated/late-game paths to a brand
new player. Fix: reject an empty pattern with usage + a tip pointing to
`tree`.

### Bug #3 — `time` showed "phases seen: (none)" until first phase boundary

`src/game.js#init`. `phasesSeen` was only mutated inside
`advanceTime()` when a phase changed; on a fresh save the player was
already in dawn but the array was empty. Fix: seed `phasesSeen` with
the current phase at game init, and also bump `dawnVisited` /
`nightVisited` if applicable so the first-launch experience matches
what `time` reports.

## Bugs considered but accepted as designed

- `cd /home/user` followed by another command shows two prompts on the
  same line — that is `readline` echoing piped stdin and is a property
  of the test harness, not a bug.
- `cat /etc/passwd` returns content — `/etc/passwd` is part of the
  *virtual* filesystem and the content is intentional flavour.
- `alias evil="ls; rm -rf /"` does not run `rm`. The alias is taken as
  a single command; tokenizer splits the resulting input into words and
  `ls;` is a command-not-found. Documented behaviour.
- `talk <npc>` from the wrong room prints "is not here" without leaking
  the greeting — verified by reading the handler order.
- A truly malformed `~/.terminal-quest/saves/<slot>.json` is ignored
  (defaults take over) instead of throwing.

## Final state

- `node scripts/runtime-playthrough.js` → **PASS** (28 commands, exit 0,
  no stderr).
- `npm test` → 176 tests, all green.
- `docs/demo-real.cast` is a valid asciinema v2 file recorded from the
  real child-process run (130 events, ~17 KB).

## Known minor issues left for follow-ups

- The boot banner mixes English and Chinese on first launch; switching
  to `lang en` only takes effect for *new* output, so the boot block
  itself never localises. Not a runtime bug — would need a startup-time
  locale flag override (already supported via `--lang en`, just not
  documented prominently in the boot copy).
- `wait 999999` is silently capped to 24 turns; users may expect
  feedback. Cosmetic.
- Hidden top-level `/shadow` is filtered out of `ls /` until `scan`,
  which is intended but easy to miss in a runtime playthrough.

