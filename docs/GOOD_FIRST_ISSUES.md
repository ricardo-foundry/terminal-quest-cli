# Good first issues

Ten ready-to-file issue templates for new contributors. Copy each block
into a fresh GitHub issue and tag it `good-first-issue` +
`help-wanted`. None require touching core systems; each can be merged
in under 200 lines and ships standalone.

---

## 1. Translate one new UI string into Chinese

**Files:** `src/i18n.js`
**Effort:** 30 min
**What:** Pick any English-only string in `src/i18n.js` (search for keys
whose `zh` value still equals the `en` value), translate it, and add a
test under `test/i18n.test.js`. PR title: `i18n(zh): translate <key>`.

---

## 2. Translate one new UI string into a brand-new locale

**Files:** `src/i18n.js`
**Effort:** 1 h
**What:** Add a top-level `ja` (or `es` / `fr` / `de`) entry under one
key, then wire `--lang ja` to fall back through `en` for missing
strings. The fallback chain already exists; you only need to add the
locale + at least one translated string and one passing test.

---

## 3. Add a tiny community quest

**Files:** `quests/<your-id>/quest.json` only
**Effort:** 1 h
**What:** Follow `docs/QUEST_FORMAT.md`. Three steps minimum, one
trigger per step. CI runs `--validate-quest` against every quest in
`quests/`. Bonus: include a `branches` block so the ending varies
based on the player's `alignment`.

---

## 4. Add an NPC mood line

**Files:** `src/data.js` (NPC dialog tables)
**Effort:** 30 min
**What:** Pick any NPC and add one `friendly` / `neutral` / `hostile`
greeting variant they don't already have. Keep it under one screen
line. Add a snapshot test that asserts the new line is reachable from
the relevant alignment range.

---

## 5. Add an achievement

**Files:** `src/achievements.js`
**Effort:** 1 h
**What:** Pick a behaviour the game already tracks but doesn't reward
(e.g. *"Visited every directory under /world"*, *"Played all 8
minigames"*). Add the achievement to `EXTRA_ACHIEVEMENTS`, write a
`check(gameState)` predicate, and one test in
`test/achievements.test.js`.

---

## 6. Add a minigame

**Files:** `src/minigames.js`, `test/minigames.test.js`
**Effort:** 2-3 h
**What:** Tic-tac-toe, hangman, sudoku, 2048, blackjack… pick a
classic. Two requirements: (1) the evaluator must be a pure function
exported for tests; (2) the playable surface must be drawable inside a
single 80×24 terminal frame. `run snake` is a good shape to copy.

---

## 7. Animated splash variation

**Files:** `src/ui.js#bootSequence`
**Effort:** 1 h
**What:** Add an alternate boot sequence themed around dawn / dusk —
gated by the in-game time-of-day. Must respect `--no-color` and
`--no-boot`. No new runtime deps; ASCII frames only.

---

## 8. New theme preset

**Files:** `src/themes.js`
**Effort:** 1 h
**What:** Add a `solarized` (or `nord`, `dracula`, `gruvbox`) theme
following the existing structure. Must populate every theme key the
existing presets use; missing keys fall back to `dark`. Add a test that
loads `--theme solarized` and asserts the colours apply.

---

## 9. Improve the `share` ASCII card

**Files:** `src/share.js`, `test/share.test.js`
**Effort:** 1 h
**What:** Pick one of: (a) add a CJK-safe variant using `wcwidth`'s
`padVisual` so 中文 player names align; (b) add a "compact" mode for a
≤140-char Twitter share; (c) add an opt-in colour mode.

---

## 10. Add a one-off "easter egg" command

**Files:** `src/commands.js`
**Effort:** 30 min
**What:** Add a hidden command (e.g. `xyzzy`, `konami`, `sudo make me
a sandwich`) that doesn't appear in `help` but does *something*
visible. Must increment `gameState.easterEggCount` and have a test
that asserts the counter went up.

---

## Picking one

Anything tagged 1, 3, 4 or 5 is a "merge-in-an-evening" first PR. Anything
involving game state or UI rendering should add at least one test alongside
the change — `node --test test/<area>.test.js` runs in under 3 seconds.

Open an issue first if you're unsure whether your idea fits; the
maintainers will help you scope it down.
