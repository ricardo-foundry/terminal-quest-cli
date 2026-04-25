# Contributing — 5-Minute Quickstart

Welcome! This is the express lane. The full guide lives in
[`CONTRIBUTING.md`](../CONTRIBUTING.md), but if you just want to ship
your first PR in five minutes, follow this page.

## 1. Clone and run the tests

```bash
git clone https://github.com/ricardo-foundry/terminal-quest-cli.git
cd terminal-quest-cli
npm install            # only dev deps; the runtime has no external deps
npm test               # 187 tests, ~3 s
```

If `npm test` is green you are good to go. There is no build step.

## 2. Pick a starter task

The easiest first contributions, in increasing order of effort:

| Effort   | Task                                            | Where                                  |
| -------- | ----------------------------------------------- | -------------------------------------- |
| 5 min    | Translate one missing string                    | `src/i18n.js` — see `docs/I18N_COVERAGE.md` |
| 15 min   | Move a hardcoded usage string into `t()`        | `src/commands.js`                      |
| 20 min   | Add a new community quest                       | `quests/<your-id>/quest.json`          |
| 30 min   | Fix a documented walkthrough hidden-path issue  | `docs/HIDDEN_PATHS.md`                 |
| 45 min   | Add a new minigame                              | `src/minigames.js` + tests             |
| 1 h+     | New locale (`fr`, `de`, `es`, ...)              | `src/i18n.js`                          |

## 3. Run the new interactive quest builder

If you are writing a quest, you do **not** have to learn the JSON schema
by hand. Run:

```bash
node bin/terminal-quest.js --validate-quest=new --interactive
```

It prompts you for the id, title, steps and triggers, then prints a
schema-valid `quest.json` to stdout. Pipe that into a new folder:

```bash
node bin/terminal-quest.js --validate-quest=new --interactive > /tmp/quest.json
mkdir quests/your-id
mv /tmp/quest.json quests/your-id/quest.json
node bin/terminal-quest.js --list-quests   # confirms it loads
```

## 4. Commit, push, open a PR

- Branch: `git checkout -b your-handle/short-description`
- Commit message style: `feat(quest): add midnight-market lost & found`
- Run `npm test` once more.
- Push and open a PR against `iter-10-final-mile` (or the active iter
  branch in the README) — **not** `main`.

The PR template (see `.github/PULL_REQUEST_TEMPLATE.md`) has a five-line
checklist; please run through it. CI will re-run the tests.

## 5. Suggested labels

When you open an issue or PR, the maintainers use these labels — feel
free to add them yourself:

| Label                  | Meaning                                                |
| ---------------------- | ------------------------------------------------------ |
| `good first issue`     | Self-contained, no deep context needed                 |
| `help wanted`          | Open to anyone who has time                            |
| `quest-pack`           | Adds or changes a `quests/*` folder                    |
| `i18n`                 | Translation or locale work                             |
| `docs`                 | Markdown only                                          |
| `bug`                  | Reproducible defect                                    |
| `enhancement`          | New behaviour or polish                                |
| `accessibility`        | Screen reader, colour, scaling                         |
| `cross-platform`       | Windows / Linux / macOS specific                       |
| `breaking`             | Save schema or CLI surface change — flagged in changelog |
| `needs-spoiler-warn`   | Touches `docs/HIDDEN_PATHS.md` or walkthrough material |

## 6. Things to know

- **No runtime deps**: don't add new ones. We use `chalk`, `figlet`,
  `keypress` and that's it. Test deps via `node:test` are stdlib.
- **i18n discipline**: every player-visible string goes through
  `t('key')`. New keys: add to `en`, `zh`, `ja`. See
  [`docs/I18N_COVERAGE.md`](./I18N_COVERAGE.md).
- **Save format**: bumping `SCHEMA_VERSION` in `src/save.js` requires a
  migration. Do NOT change the wire format silently.
- **Test discipline**: every behaviour change ships with at least one
  test. CI is `node:test`, no jest, no mocha — keep it tiny.

## 7. Where to ask

- Bugs / proposals: open an issue using the template in
  `.github/ISSUE_TEMPLATE/`.
- Quick questions: drop them in the PR description; the maintainer
  reviews are usually within 48h.

Have fun!
