# Terminal Quest — FAQ

## 1. How do I play?

`npx terminal-quest-cli`.  That runs the latest version from npm
without installing anything globally.  If you prefer to install:
`npm install -g terminal-quest-cli`, then run `terminal-quest`
(aliases `tq` and `adventure` also work).

## 2. What does it need?

Node.js 14 or newer, and a terminal that can display a few hundred
characters per line.  That is it.  No Python, no Docker, no network,
no account.

## 3. Is it safe to run `npx` with one command?

The package is MIT-licensed, source-available, and each release is
published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so you can verify it was built from the GitHub repo you are reading.
If you are at all uncertain, clone the repo and run
`node bin/terminal-quest.js` directly.

## 4. Where are my saves stored?

Inside `~/.terminal-quest/saves/<slot>.json` on macOS / Linux, and
the Windows equivalent inside your user profile.  Multiple slots
are supported (`--slot name`, `save name`, `load name`).  Saves are
plain JSON — you can open them in a text editor.

## 5. Can I back up or migrate saves?

Yes.  `terminal-quest --export-save <slot>` prints the JSON to
stdout; `--import-save <file> <slot>` imports a previously exported
file into a slot.  There is also an experimental
`--cloud push/pull/list` flow that syncs saves to a private GitHub
Gist.

## 6. Can I play offline?

Yes, the core game never touches the network.  The only networked
features are the optional `--cloud` flags, which are explicitly
opt-in.

## 7. How do I write a quest?

See [QUEST_FORMAT.md](./QUEST_FORMAT.md).  Summary: add a file at
`quests/<your-id>/quest.json`, list the steps and triggers, validate
with `node bin/terminal-quest.js --validate-quest <file>`, open a
PR.  The engine does not need recompiling — quests hot-load from
the `quests/` directory.

## 8. Is there a way to record a playthrough?

Yes.  v2.4 records every command you run into the save envelope.
Play back with `replay` (inside the game) or
`terminal-quest --replay <slot>` from the command line.  Replays are
bounded (the latest 500 events per save) so they do not grow
unbounded.

## 9. What is the endgame?

Find all three key fragments (one in `/home/user/.secret`, one in
`/system/core`, one in `/shadow/realm`), combine them into the master
key `AW4K3_TH3_4I`, then run `unlock master`.  Along the way you
will meet a guide, a researcher, an archivist, a librarian and a
conductor — all of whom remember how you treat them.

## 10. Something broke — what now?

Please open an issue at
https://github.com/ricardo-foundry/terminal-quest-cli/issues with:

- your Node version (`node --version`)
- your OS and terminal
- the exact command you ran
- the last few lines of output

If the game prints `[fatal]`, the global uncaught-exception handler
should already have logged a stack trace.  Corrupted saves are
auto-quarantined to `<slot>.json.bak.<ts>` so the next run starts
clean — feel free to attach the `.bak` file to the bug report.
