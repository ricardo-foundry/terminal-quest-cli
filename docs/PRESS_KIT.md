# Terminal Quest — Press Kit

## One sentence

A bilingual, zero-install, retro text adventure that runs in any
terminal — `npx terminal-quest-cli` and you are playing.

## One paragraph

Terminal Quest is an open-source, MIT-licensed command-line RPG that
lives entirely inside your terminal.  A single `npx` command drops
you into KIMI-OS, a small filesystem-shaped world with 10 minigames,
23 achievements, a day/night cycle, NPC dialogue with an alignment
system, and 12 main-story quests that culminate in a real ending.
Quests are plain JSON files, so the community can ship new stories
without touching the engine.  Replays, multi-slot saves, optional
GitHub-Gist cloud sync, English + Chinese UI, three themes, and no
analytics of any kind.

## One tweet (≤280 chars)

Terminal Quest is a retro text adventure you play with `npx`.  10
minigames, bilingual UI, day/night cycle, community-writable quests
in plain JSON, replay recording, 0 runtime deps.  No install, no
account, no nonsense.  `npx terminal-quest-cli`.

## Key facts

- Engine: Node.js 14+, cross-platform (macOS / Linux / Windows)
- License: MIT
- Install: `npx terminal-quest-cli` (no global install needed)
- Size: ~250 KB packed tarball
- Deps: 3 optional runtime deps (chalk, figlet, keypress); graceful
  fallback when absent
- Content: 5 zones, 8 NPCs, 10 minigames, 23 achievements, 12 main
  quests + pluggable community quests
- Save format: JSON with schemaVersion + migrations; replay buffer
  included
- Accessibility: `--no-color`, `--no-boot`, non-TTY fallback
  rendering, East-Asian-Width safe tables, English / Chinese toggle

## Suggested screenshots

- `docs/ascii-logo.txt` — boot splash
- `docs/session-transcript.md` — a 50-line sample play session
- `docs/og-card.svg` — 1200×630 social card

## Contact

Issues: https://github.com/Ricardo-M-L/terminal-quest-cli/issues
Author: KIMI-AI team
