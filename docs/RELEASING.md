# Releasing terminal-quest-cli

This package publishes to npm via GitHub Actions on tag push (`v*`).
Maintainers should never `npm publish` from a laptop — always tag and push.

## 1. Pre-flight (on `main`)

```bash
git checkout main && git pull
npm test                       # all 51 tests must be green
npm pack --dry-run             # eyeball the tarball; expect: bin/, src/, docs/, README.md, LICENSE, CHANGELOG.md
```

Open the tarball listing and confirm:

- `package.json` `version` matches what you intend to ship
- `bin/terminal-quest.js` is present and executable
- `src/*.js` (10 files: game, commands, data, ui, themes, i18n, save,
  share, time, achievements, minigames)
- `README.md`, `LICENSE`, `CHANGELOG.md`, `docs/`
- **no** `node_modules/`, `test/`, `.git`, `.github/`, `*.test.js`,
  `.DS_Store`, `coverage/`

## 2. Bump version and changelog

```bash
# patch / minor / major - pick one
npm version minor              # writes package.json, package-lock.json, makes a commit + tag

# Update CHANGELOG.md: move Unreleased -> the new version, add release date.
$EDITOR CHANGELOG.md
git add CHANGELOG.md
git commit --amend --no-edit   # fold changelog edit into the npm-version commit
git tag -f v$(node -p "require('./package.json').version")
```

(If you'd rather not amend, make a separate `chore: changelog for vX.Y.Z`
commit and re-tag with `git tag v$(...) -f`.)

## 3. Push code + tag

```bash
git push origin main
git push origin --tags
```

## 4. CI takes over

`.github/workflows/publish-npm.yml` triggers on the `v*` tag and:

1. Re-runs the test matrix on Node 18 / 20 / 22 (Ubuntu / macOS / Windows).
2. Builds with `npm ci`.
3. Publishes to the public npm registry with provenance
   (`--provenance --access public`).
4. Creates a GitHub Release with the changelog excerpt.

The publishing step requires the `NPM_TOKEN` secret on the repository.
Refresh it from <https://www.npmjs.com/settings/<owner>/tokens> if it
expires. The token must be an **automation** token (passes 2FA).

## 5. Post-release smoke test

```bash
# in a throwaway directory
mkdir /tmp/tq-smoke && cd /tmp/tq-smoke
npx --yes terminal-quest-cli@latest --version
npx --yes terminal-quest-cli@latest --no-boot
```

Then:

- [ ] update the README "Stars over time" link if you change the repo slug
- [ ] re-record `docs/demo.cast` if the boot UI changed
- [ ] open a PR with the bumped social card if the screenshot is stale
- [ ] tweet / post the share card from `~/.terminal-quest/shares/`

## Rolling back

`npm` does not allow republishing the same version. If a release is broken:

```bash
npm deprecate terminal-quest-cli@<bad-version> "broken; use <good-version>"
# then bump and ship a fixed version
```

Do **not** `npm unpublish` more than 24h after publish — npm forbids it.

## Conventions

- Tags are `vX.Y.Z` (no `release/`, no leading `release-`).
- `CHANGELOG.md` follows Keep a Changelog: `Added / Changed / Fixed`.
- Public API is the in-game command set + the JSON save schema. Breaking
  either bumps the major. The save schema is documented in
  `docs/SAVE_FORMAT.md` — bump `SCHEMA_VERSION` in `src/save.js` and add
  a migration step.
