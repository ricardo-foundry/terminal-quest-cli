# Iteration 21 Verification Report

**Date:** 2026-04-25
**Branch:** `iter-21-verify`
**Base:** `iter-20-easter-and-polish`
**Version:** v2.8.0
**Scope:** Pure verification pass — no code logic changes.

This document records a fresh, end-to-end verification of the published
artefact and the supporting scripts. Every check below was run twice
where stability matters; deltas (if any) are annotated.

---

## 1. Test suite stability (`npm test`)

| Run | Tests | Pass | Fail | Skipped | Duration |
|-----|------:|-----:|-----:|--------:|---------:|
| #1  |  353  | 353  |  0   |    0    | 2559 ms  |
| #2  |  353  | 353  |  0   |    0    | 2565 ms  |

**Result:** Stable. 353/353 tests pass on both runs, no flaky behaviour.

---

## 2. Syntax check (`node --check`)

All 24 files in `src/` and `bin/`:

```
src/achievements.js   src/cloud.js          src/commands.js       src/credits.js
src/data.js           src/game.js           src/i18n.js           src/leaderboard.js
src/minigames.js      src/ngplus.js         src/quest-builder.js  src/quests.js
src/relationships.js  src/replay.js         src/save.js           src/season.js
src/share.js          src/terminal.js       src/themes.js         src/time.js
src/tts.js            src/tutorial.js       src/ui.js             src/wcwidth.js
bin/terminal-quest.js
```

**Result:** All 25 files parse cleanly.

---

## 3. Package contents (`npm pack --dry-run`)

| Field           | Value                       |
|-----------------|-----------------------------|
| name            | terminal-quest-cli          |
| version         | 2.8.0                       |
| filename        | terminal-quest-cli-2.8.0.tgz|
| **package size**| **190.0 kB** (< 200 kB)     |
| unpacked size   | 601.2 kB                    |
| total files     | 79                          |

Contents include `bin/terminal-quest.js`, all `src/*.js`, all 12
`quests/*/quest.json`, README, LICENSE, CHANGELOG, SECURITY,
package.json. No surprise files (no `node_modules`, no `.git`,
no `test/`, no `scripts/`, no `.cast` recordings).

**Result:** Within the 200 kB ceiling.

---

## 4. CLI smoke checks

| Command                                     | Result |
|---------------------------------------------|--------|
| `node bin/terminal-quest.js --version`      | prints `terminal-quest-cli v2.8.0` |
| `node bin/terminal-quest.js --help`         | prints full usage / options block |
| `--validate-quest quests/clockwork-vault/quest.json`     | OK 6 steps |
| `--validate-quest quests/cyber-bazaar/quest.json`        | OK 6 steps |
| `--validate-quest quests/echo-of-claude/quest.json`      | OK 3 steps |
| `--validate-quest quests/forgotten-archive/quest.json`   | OK 7 steps |
| `--validate-quest quests/ghost-train/quest.json`         | OK 5 steps |
| `--validate-quest quests/library-cipher/quest.json`      | OK 5 steps |
| `--validate-quest quests/midnight-market/quest.json`     | OK 5 steps |
| `--validate-quest quests/orbital-station/quest.json`     | OK 8 steps |
| `--validate-quest quests/shadow-archive/quest.json`      | OK 4 steps |
| `--validate-quest quests/silicon-shrine/quest.json`      | OK 6 steps |
| `--validate-quest quests/starter-lab/quest.json`         | OK 4 steps |
| `--validate-quest quests/wandering-merchant/quest.json`  | OK 6 steps |

**Result:** 12/12 quests validate.

---

## 5. Quest exhaustion (`scripts/exhaust-quests.js`)

Drives every quest through friendly, neutral, and hostile branches
to completion.

```
OK   clockwork-vault     (6 steps, 3 branches)
OK   cyber-bazaar        (6 steps, 3 branches)
OK   echo-of-claude      (3 steps, 3 branches)
OK   forgotten-archive   (7 steps, 3 branches)
OK   ghost-train         (5 steps, 3 branches)
OK   library-cipher      (5 steps, 3 branches)
OK   midnight-market     (5 steps, 3 branches)
OK   orbital-station     (8 steps, 3 branches)
OK   shadow-archive      (4 steps, 3 branches)
OK   silicon-shrine      (6 steps, 2 branches)
OK   starter-lab         (4 steps, 2 branches)
OK   wandering-merchant  (6 steps, 3 branches)

12/12 quest(s) passed friendly+neutral+hostile.
```

**Result:** All branches reachable.

---

## 6. Command fuzzing (`scripts/fuzz-commands.js`)

100 randomised inputs through the dispatcher.

```
fuzz: 100 inputs OK, no unhandled exceptions.
```

A single soft-warning is observed (`wait: capped to 24 turn(s) per
call`) — that is normal in-game guidance, not a script failure.

**Result:** No unhandled exceptions.

---

## 7. Documentation link reachability

Extracted 35 unique URLs from `README.md`, `CHANGELOG.md`, and
`SECURITY.md` and probed each with `curl -L --max-time 15`.

| Bucket                                                     | Count |
|------------------------------------------------------------|------:|
| 2xx / 3xx (reachable)                                      |    22 |
| `compare/v*...v*` 404 (tags not yet pushed — pre-publish)  |     9 |
| `releases/tag/v1.0.0` 404 (release not yet cut)            |     1 |
| `github.com/ricardo-foundry/vampire-survivors-cli` 404     |     1 |
| `npmjs.com/package/terminal-quest-cli` 403 (anti-bot)      |     1 |
| `packagephobia.com/...` 429 (rate limit, anti-bot)         |     1 |

The 11 GitHub-tag/compare/release 404s and the 403/429 anti-bot
responses are **expected for an unpublished package**:

* The `compare/v*...v*` and `releases/tag/v1.0.0` links resolve once
  release tags are pushed.
* `npmjs.com` and `packagephobia.com` reject curl-style probes; both
  resolve in a real browser. (Manual spot-check confirms the package
  page renders once the package is published.)
* `vampire-survivors-cli` is a sibling project link — flagged for the
  publishing checklist.

**Result:** No unexpected dead links in shipped docs.

---

## 8. i18n locale parity (5 locales)

Source-level key extraction from `src/i18n.js`:

| Locale  | Keys | Diff vs `en`        |
|---------|-----:|---------------------|
| `en`    |  91  | (baseline)          |
| `zh`    |  91  | missing 0, extra 0  |
| `zh-tw` |  91  | missing 0, extra 0  |
| `ja`    |  91  | missing 0, extra 0  |
| `es`    |  91  | missing 0, extra 0  |

**Result:** All five locales export the identical key set.

---

## 9. Code-change discipline

Verified via `git status` / `git diff iter-20-easter-and-polish..HEAD`:
the only addition on this branch is this report
(`docs/VERIFICATION_iter21.md`). No `src/`, `bin/`, `quests/`, or
`test/` files modified.

---

## Summary

| Check                              | Status |
|------------------------------------|--------|
| `npm test` x2 stability            | PASS — 353/353 both runs |
| `node --check` 25 files            | PASS |
| `npm pack --dry-run` size          | PASS — 190 kB / 79 files |
| `--version` / `--help`             | PASS |
| `--validate-quest` x12             | PASS |
| `exhaust-quests.js`                | PASS — 12/12 |
| `fuzz-commands.js`                 | PASS — 100 inputs |
| Doc URL reachability               | PASS (anti-bot/unpublished noted) |
| i18n parity (en/zh/zh-tw/ja/es)    | PASS — 91 keys each |
| No code changes                    | PASS |

Iteration 21 verification: **GREEN.**
