# Show HN: Terminal Quest — an RPG that lives entirely in your terminal (`npx terminal-quest-cli`)

## Title (≤ 80 chars)
Show HN: Terminal Quest – npx-installable RPG with 11 quests and 11 minigames

## Body

Hi HN — I built **Terminal Quest**, a single-binary, dependency-light RPG that runs entirely inside your terminal. No GUI, no Electron, no install dance:

```
npx terminal-quest-cli
```

That's it. ~176 kB tarball, boots in under a second, works on macOS / Linux / Windows (cmd, PowerShell, WSL).

### What's in it

- **11 quests** with branching friendly / neutral / hostile paths — every branch is verified by an `exhaust-quests.js` script in CI, so no dead ends.
- **11 minigames** as in-world commands: `run snake`, `run pong`, `run wordle`, `run matrix`, `run guess`, `run qte`, `run logic`, `run morse`, plus 3 hidden ones you unlock by exploring.
- **5 locales** out of the box: English, 简体中文, 日本語, Español, Français. Switch live with `lang`.
- A real-feeling shell: `ls`, `cd`, `tree`, `grep`, `find`, history, `!!`, aliases, tab-complete.
- Save slots, achievements, share-cards, themes, optional TTS narration, and a tutorial command for first-timers.
- A built-in quest builder (`src/quest-builder.js`) so you can ship your own `.json` quests via PR.

### Why I built it

I missed text adventures, but every modern attempt felt like it wanted to be a website. I wanted something I could `npx` on a fresh box, finish a quest on a flight with no Wi-Fi, and hack on with a single `git clone` + `npm start`. The whole game is plain JS + JSON quests — no build step.

### What I'd love feedback on

- Branching design: do the friendly/neutral/hostile splits feel meaningful, or just cosmetic?
- Locale quality (zh-CN / ja / es / fr) — native speakers, please flame freely.
- Anything that breaks on Windows terminals I haven't tested.

Repo: https://github.com/ricardo-foundry/terminal-quest-cli
npm: https://www.npmjs.com/package/terminal-quest-cli

If you finish the game (`unlock master`), `share` prints an ASCII card you can paste in the comments.

---

## Notes for the poster (do NOT paste these)
- Post Tue/Wed 09:00–11:00 PT for best front-page odds.
- First comment should be the author with: install one-liner, quickstart, and a screenshot/cast link.
- Have `docs/CROSSPROMO.md` open so you can drop sister-project links naturally if asked “what else have you made?”.
- Be ready for: Windows terminal bugs, npm registry lookups, “why not Rust?”, save-file location questions (`~/.terminal-quest/saves/`).
