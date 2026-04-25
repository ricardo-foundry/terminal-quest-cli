# Release Checklist — Terminal Quest CLI

A 30-item gate to run before tagging and shipping a new version to npm + GitHub.
Tick every box; if a step fails, stop and fix before continuing.

## A. Code & Tests (1–7)
- [ ] 1. `git status` clean on the release branch (no stray edits, no untracked files).
- [ ] 2. `npm test` passes locally (Node 18 / 20 / 22).
- [ ] 3. `node scripts/exhaust-quests.js` reports `11/11 quest(s) passed friendly+neutral+hostile`.
- [ ] 4. `node scripts/fuzz-commands.js` runs N=2000 with zero unhandled errors.
- [ ] 5. `node scripts/runtime-playthrough.js` exits 0 (full unlock path still reachable).
- [ ] 6. Snake / guess / matrix / pong / wordle / qte / logic / morse + 3 hidden minigames load without throwing.
- [ ] 7. All 5 locales (`en`, `zh-CN`, `ja`, `es`, `fr`) render the title screen with no missing-key warnings.

## B. Packaging (8–13)
- [ ] 8. `package.json` `version` bumped per semver.
- [ ] 9. `npm publish --dry-run` reports **package size < 200 kB** and **unpacked size < 700 kB**.
- [ ] 10. Tarball file count ≤ 80 — no `.cast.placeholder`, no editor backups, no `node_modules`.
- [ ] 11. `bin/terminal-quest.js` has shebang and is `chmod +x`.
- [ ] 12. `files` array in `package.json` matches the actual ship list (bin / src / docs / quests / README / LICENSE / CHANGELOG).
- [ ] 13. `npm pack` and `npx ./terminal-quest-cli-X.Y.Z.tgz` works in a clean tmp dir.

## C. Docs (14–20)
- [ ] 14. `CHANGELOG.md` updated with the new version, dated, sectioned (Added / Changed / Fixed).
- [ ] 15. `README.md` install snippet + version badge bumped.
- [ ] 16. `docs/USER_GUIDE.md` mentions any new command / minigame / quest.
- [ ] 17. `docs/FAQ.md` reviewed for stale answers.
- [ ] 18. `docs/CROSS_PLATFORM.md` Win/macOS/Linux notes verified.
- [ ] 19. `docs/CROSSPROMO.md` sister-project links not 404.
- [ ] 20. `docs/PRESS_KIT.md` screenshots / OG card up to date.

## D. Recordings & Assets (21–24)
- [ ] 21. `demo.cast` re-recorded against the release build (`scripts/record-real-cast.js`).
- [ ] 22. `docs/terminal-demo.svg` regenerated from the new cast.
- [ ] 23. README hero asciinema embed plays end-to-end.
- [ ] 24. Social card (`docs/og-card.svg`) version-string updated.

## E. CI / Cross-platform (25–27)
- [ ] 25. GitHub Actions: ubuntu-latest / macos-latest / windows-latest matrix all green on the release SHA.
- [ ] 26. Node 18 + 20 + 22 matrix green.
- [ ] 27. Lockfile install (`npm ci`) works on a clean runner.

## F. Release & Announce (28–30)
- [ ] 28. Tag `vX.Y.Z`, push tag, create GitHub Release with CHANGELOG excerpt + cast attached.
- [ ] 29. `npm publish` (real, not dry-run) — confirm version visible at https://www.npmjs.com/package/terminal-quest-cli .
- [ ] 30. Announce: Show HN (`docs/SHOW_HN_DRAFT.md`), Reddit (`docs/REDDIT_POST.md`), Tweet thread (`docs/TWEET_DRAFTS.md`), Launch post (`docs/LAUNCH_POST.md`). Cross-link sister projects per `docs/CROSSPROMO.md`.

---
Last verified: 2026-04-25 (iter-18-launch-ready). Package size 176.2 kB / 73 files.
