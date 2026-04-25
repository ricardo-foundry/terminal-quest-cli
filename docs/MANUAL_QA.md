# Manual QA Checklist

A human-readable sister to the automated `scripts/runtime-playthrough.js`
script. Walk down this list before tagging a release.

Each item is meant to be **one terminal session** unless noted. Run each
in a fresh slot (`--slot qa-N`) so prior runs do not bias the result.

## 0. Smoke

- [ ] `node bin/terminal-quest.js --version` → prints `terminal-quest-cli vX.Y.Z`, exit 0.
- [ ] `node bin/terminal-quest.js --help` → usage block, exit 0.
- [ ] `node bin/terminal-quest.js --list-quests` → 5 quests listed, exit 0.
- [ ] `node bin/terminal-quest.js --validate-quest quests/starter-lab/quest.json` → ok, exit 0.
- [ ] `node bin/terminal-quest.js --validate-quest /tmp/missing.json` → invalid + reason, exit 2.

## 1. Start

- [ ] `npx terminal-quest-cli` (or `node bin/terminal-quest.js`) shows the boot banner, then `[OK]` and the prompt.
- [ ] `--no-boot` skips the splash but still shows the welcome line.
- [ ] `--no-color` removes all ANSI escapes (try `node bin/terminal-quest.js --no-boot --no-color`).
- [ ] First-launch prompt is `[Lv.1]` with phase indicator on the left.

## 2. Save

- [ ] `save mytest` → "Game saved to slot 'mytest'".
- [ ] Quitting via `exit` writes the save again ("Progress saved.").
- [ ] Re-opening with `--slot mytest` resumes the same level / EXP.
- [ ] `--export-save mytest` prints valid JSON to stdout.
- [ ] `--import-save backup.json mytest` writes the file back, confirming bytes.

## 3. Load

- [ ] `load mytest` inside the game restores level, dirs, achievements.
- [ ] `load nonexistent` prints a localised error, does not crash.
- [ ] A garbage save (manually edit `~/.terminal-quest/saves/default.json`) boots to defaults instead of throwing.

## 4. Replay

- [ ] Inside the game, run a few commands then `replay` → events stream out tinted dim.
- [ ] `--replay mytest` from the CLI plays the recorded events and exits 0.
- [ ] `--replay nonexistent` prints "no save found", exits 2.

## 5. Quest pack

- [ ] `quests` lists active main-story quests with progress.
- [ ] `community-quests` (or `communityquests`) lists the 5 quest-pack quests.
- [ ] Completing a community quest prints `[quest]` and credits the
      reward EXP / inventory items declared in the pack JSON.
- [ ] `--dev` mode hot-reloads when `quests/<id>/quest.json` changes
      (touch the file, watch for `[dev] reloaded N quest(s)`).

## 6. Share

- [ ] `share` writes `~/.terminal-quest/shares/card-<handle>-<ts>.txt`
      and prints the same card to stdout.
- [ ] `share my-handle` uses the supplied handle in both the file name
      (sanitised to `[A-Za-z0-9_-]`) and the card.
- [ ] `card_shark` achievement unlocks on the first share.

## 7. Cloud (experimental)

- [ ] `--cloud` with no op → prints usage, exits 2.
- [ ] `--cloud list` without `GH_TOKEN` → prints env-var hint, exits 2.
- [ ] `--cloud push default` with a real `GH_TOKEN` → returns a Gist URL.
- [ ] `--cloud pull default` overwrites the local slot from the Gist.

## 8. Multiplay / parallel runs

- [ ] Running two instances with different `--slot` names does not stomp
      saves: open A in one terminal, B in another, level both up, both
      saves persist independently in `~/.terminal-quest/saves/`.
- [ ] Killing the process with `kill -TERM <pid>` saves cleanly (the
      SIGTERM handler in `game.js` calls `saveGameState` before exit).
- [ ] Two `Ctrl+C` within 2 seconds exits gracefully; one alone keeps the
      session alive with a warning.

## 9. Cross-platform smoke

- [ ] macOS / Linux: run `node scripts/runtime-playthrough.js`,
      expect `runtime-playthrough: PASS`.
- [ ] Windows: `node bin/terminal-quest.js --no-boot --no-color`, run
      a handful of commands, confirm prompt redraws and `cd` works
      (the virtual FS uses POSIX paths regardless of host OS).
- [ ] Non-UTF8 locale (`LANG=C`): boot still works, CJK chars in saves
      survive a save→exit→reload cycle.

## 10. Long-running session

- [ ] After 50+ commands the prompt is still responsive, history
      survives, `history` prints the last 50 entries.
- [ ] After repeated `share` (>= 5) the file system shows multiple
      cards, no errors.
