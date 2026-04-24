# Reddit post templates

Three subreddits, three angles.  Adjust the tone to fit each community
and remember: read the rules first, never cross-post verbatim within
an hour, answer questions in the comments.

---

## r/commandline — "Terminal Quest — a retro text adventure that lives in npx"

**Title:** Terminal Quest — a retro text adventure that runs with one
`npx` command (MIT, no deps to install)

**Body:**

Hi r/commandline.  I just shipped v2.4 of Terminal Quest, an
open-source text adventure that runs entirely in your terminal.

```
npx terminal-quest-cli
```

That is the install process.  No accounts, no launcher, no 200 MB
download.  It ships in a ~250 KB tarball and gracefully falls back
to plain ASCII when there is no colour support.

What is in it:

- A small filesystem-shaped world (`ls`, `cd`, `cat`, `tree`,
  `grep`, `find` — they all work).
- 10 minigames including Snake, Wordle, Morse decoder, a chess
  mate-in-one, and a Caesar-cipher decoder.
- A day/night cycle that gates certain rooms.
- 23 achievements.
- Bilingual UI (English / 简体中文).
- Multi-slot saves with a `schemaVersion` field.
- Community-writable quests in plain JSON — drop a file into
  `quests/<your-id>/quest.json` and the game loads it at startup.

Feedback, PRs, or roasts of my prompt design all welcome.

Repo: https://github.com/Ricardo-M-L/terminal-quest-cli

---

## r/rpg_gamers — "A text-RPG that fits in a single command — alignment, branching quests, endings"

**Title:** I made a free text-RPG that runs in your terminal — multiple
endings, alignment system, replay recording

**Body:**

Terminal Quest is a bilingual, open-source RPG that runs with
`npx terminal-quest-cli`.  It is deliberately small — the world fits
in your head after two hours — but it has enough RPG scaffolding to
feel like a real playthrough:

- 5 zones, 8 NPCs, 12 main-story quests, branching endings
- Alignment system (+/- 10) that NPCs actually remember
- 23 achievements (Speedrunner, Pacifist, Completionist, Historian,
  Collector, and more)
- Save slots, save export/import, replay recording
- Community-writable side quests in a JSON format

If you love Zork, Dwarf Fortress's story mode, or `roguebasin` in
general, you might like this.

Repo: https://github.com/Ricardo-M-L/terminal-quest-cli

---

## r/node — "Zero-runtime-dep text adventure on Node — using node:test, node:fs/os only"

**Title:** Shipping a Node.js text adventure with almost no runtime
dependencies — lessons from the process

**Body:**

I wrote Terminal Quest to scratch two itches: play a text adventure
without ceremony, and see how far I can go with Node's built-ins.
v2.4 added a community quest format, replay recording, experimental
cloud saves and 60+ new tests — and it is still shipping with the
same three tiny runtime deps (chalk, figlet, keypress), all
gracefully optional in hostile terminals.

A few things I learned:

- `node:test` is a genuinely pleasant unit test runner if you want
  zero dev-dep overhead.  172 tests, no mocha/jest.
- Wider-than-ASCII text needs a real East-Asian-Width table if you
  are going to draw boxes; I ended up writing a small one.
- Raw-mode input on Windows is full of surprises; a capability
  detector that falls back to line-buffered mode saved me.
- The best cloud sync is the one the user opts into per command.
  v2.4 ships a GitHub-Gist backend behind `--cloud push/pull/list`
  and an abstract `CloudBackend` class for other implementations.

Repo + full write-up: https://github.com/Ricardo-M-L/terminal-quest-cli
