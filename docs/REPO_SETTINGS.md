# GitHub repo settings checklist

Run through this once before tagging the first public release. Most of
these are one-click toggles in the repo's **Settings** page.

## About box (top of the repo page)

- **Description:**
  > A bilingual RPG that lives entirely in your terminal. `npx terminal-quest-cli` and play in 2 seconds.
- **Website:** `https://www.npmjs.com/package/terminal-quest-cli`
- **Topics** (add all of these — they drive GitHub topic discovery):

  ```
  cli, terminal, game, rpg, text-adventure, interactive-fiction,
  retro, puzzle, kimi-os, npm-package, nodejs, bilingual,
  zero-config, npx, command-line-game, ascii
  ```

- ☐ Check **Releases**
- ☐ Check **Packages**
- ☐ Uncheck **Wikis** (we use `docs/` instead)
- ☐ Uncheck **Sponsorships** (until we have a tier)
- ☐ Uncheck **Discussions** (re-enable post-launch if there's volume)
- ☐ Check **Issues**, **Pull requests**, **Projects**

## Social preview image

Upload `docs/og-card.svg` (rasterise to 1280×640 PNG before upload — GitHub does not accept SVG for the social card).

```bash
# rasterise locally with rsvg-convert / svgexport / inkscape:
rsvg-convert -w 1280 -h 640 docs/og-card.svg -o /tmp/og.png
# then drag /tmp/og.png into Settings -> Social preview
```

## Branch protection — `main`

- ☐ Require pull request before merging (1 approving review)
- ☐ Require status checks: `ci / test (ubuntu-latest, 20.x)` (and 18.x, 22.x)
- ☐ Require branches to be up to date before merging
- ☐ Require signed commits (optional, but a good signal)
- ☐ Do not allow bypassing the above settings

## Tag protection

- Pattern: `v*.*.*` — restrict push to repo admins. Prevents an
  accidental tag from triggering `publish-npm.yml`.

## Actions secrets

| name                    | purpose                                |
|-------------------------|----------------------------------------|
| `NPM_TOKEN`             | scoped to `terminal-quest-cli` only    |
| (optional) `CODECOV_TOKEN` | only if we add coverage uploads     |

The publish workflow uses `npm publish --provenance --access public` —
the runner needs `id-token: write` permission, which is already set in
`.github/workflows/publish-npm.yml`.

## Issue + PR settings

- Default issue template: `bug_report.md` (already in `.github/ISSUE_TEMPLATE/`)
- Default PR template: `.github/pull_request_template.md`
- Pin issues to surface in the issue tab:
  1. *"Translate UI strings into <language>"* (community help-wanted)
  2. *"Add a community quest"* (good-first-issue, links to `docs/QUEST_FORMAT.md`)
  3. *"Roadmap: v2.6"* (a tracking issue)

## README badges (already wired in)

- npm version, npm downloads
- license
- CI status
- node engine
- platform support
- install size

## Security

- ☐ Enable Dependabot alerts (already configured for npm + actions in `.github/dependabot.yml`)
- ☐ Enable secret scanning (free for public repos)
- ☐ Enable code scanning (CodeQL)

## After tagging v2.5.0

- ☐ Verify `https://www.npmjs.com/package/terminal-quest-cli` shows v2.5.0
- ☐ Verify GitHub Release page has the auto-generated changelog
- ☐ Pin a "v2.5 is live!" announcement to Discussions (when enabled)
- ☐ Cross-post to: r/commandline, r/sideproject, lobste.rs
  (templates in `docs/REDDIT_POST.md`)
