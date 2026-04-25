# i18n Coverage

> Locale support in Terminal Quest is *progressive*. Every key lives in
> `src/i18n.js`'s `DICTS` table. When a key is missing in the active
> locale, `t()` falls back to English, then to the literal key — so a
> partially translated locale never breaks the game.

## Currently shipped locales

| Code     | Name              | Keys | Coverage | Notes                                          |
| -------- | ----------------- | ---- | -------- | ---------------------------------------------- |
| `en`    | English            | 76   | 100 %    | Source of truth                                |
| `zh`    | 中文 (Simplified)  | 76   | 100 %    | Hand-translated                                |
| `zh-tw` | 中文 (Traditional) | 76   | 100 %    | v2.7 — derived from `zh` with regional vocab   |
| `ja`    | 日本語             | 76   | 100 %    | v2.5 (iter-10) community-style example         |
| `es`    | Español            | 76   | 100 %    | v2.7 — full hand translation                   |

(Counted by the tests in `test/i18n.test.js` — see "ja covers all en keys",
"zh-tw covers every en key", "es covers every en key".)

## Auto-detection

`detectLocale()` consults `TERMINAL_QUEST_LANG` first, then `LC_ALL`,
`LC_MESSAGES`, `LANG`. The mapping is:

| Env value (case-insensitive)           | Selected locale |
| -------------------------------------- | --------------- |
| `zh_TW.*`, `zh_HK.*`, `zh-Hant*`        | `zh-tw`         |
| any other `zh*`                         | `zh`            |
| `ja*`                                   | `ja`            |
| `es*`                                   | `es`            |
| anything else                           | `en`            |

The Traditional Chinese branch is checked **before** the generic `zh*` so
a Taiwanese player on `LANG=zh_TW.UTF-8` does not get Simplified output.

## Verifying coverage locally

```bash
node -e "
const { DICTS } = require('./src/i18n');
const en = Object.keys(DICTS.en);
for (const code of Object.keys(DICTS)) {
  const missing = en.filter(k => !(k in DICTS[code]));
  console.log(code, 'covers', en.length - missing.length, '/', en.length,
              missing.length ? '(missing: ' + missing.join(', ') + ')' : '');
}
"
```

## Known gaps (English-only strings still in source)

These usage strings still sit in `src/commands.js` outside `t()`. They
are short and stable enough that we have not migrated them yet — adding
them is a tracked good-first-issue:

| File                | Line  | String (truncated)                                  |
| ------------------- | ----- | --------------------------------------------------- |
| `src/commands.js`   | 573   | `Tip: run "scan" to reveal hidden items`            |
| `src/commands.js`   | 591   | `Usage: run <snake|guess|matrix|...>`               |
| `src/commands.js`   | 773   | `Usage: talk <npc> [choice-id]`                     |
| `src/commands.js`   | 935   | `Usage: unlock master`                              |
| `src/commands.js`   | 1096  | `Usage: grep <pattern> <file>`                      |
| `src/commands.js`   | 1128  | `Usage: find <pattern>`                             |
| `src/commands.js`   | 1244  | `Usage: alias name=value`                           |

Boot-time technical strings (`BIOS v2.1`, `MEM`, `KERN`, `SYS`) are
**intentionally** locale-neutral so the boot sequence does not need to
reflow when the player runs `lang en|zh|ja` mid-session. See
`bootSequence()` in `src/ui.js` and the round 9/10 leftover notes.

## How to contribute a new locale

1. Open `src/i18n.js`, copy the `en` entry, add a new code (e.g. `'fr'`).
2. Translate as many keys as you can — partials are fine.
3. Add a coverage assertion in `test/i18n.test.js`:
   ```js
   test('fr exists with at least 50 keys', () => {
     const fr = Object.keys(DICTS.fr || {}).length;
     assert.ok(fr >= 50, 'expected fr to have >=50 keys, got ' + fr);
   });
   ```
4. Update this table with the coverage count.
5. (Optional) Update `detectLocale()` to recognize the system locale
   prefix so users with `LANG=fr_FR` get it automatically.

There is no build step, no runtime dep, and no need to run a scraper —
add the key, save, run `npm test`. That's the whole loop.
