# Merge to `main` — Bundle Plan

> Prepared on `iter-23-merge-bundle`. This branch adds **only** this document on
> top of `iter-21-verify`. No code, asset, or other doc changes.

`main` currently sits at `44cffb8` ("URL foundry" rename, completed during
iter-11). Iterations 12 through 21 have shipped on their own `iter-N-*`
branches and been pushed to `origin`, but **none of them has been merged back
into `main`**. As of 2026-04-25 the gap is **13 commits / 10 iterations** of
production work.

Use this document as the single source-of-truth when deciding _how_ to land
those commits on `main`.

---

## 1. What `main` is missing (iter-12 → iter-21)

Listed newest first. Each entry names the iter branch, the headline commit,
and the user-visible payload it added to the CLI.

| Iter | Branch | Key commit | Headline payload |
| --- | --- | --- | --- |
| 21 | `iter-21-verify` | `c7bea4c` | Verification-only sweep — no code changes. |
| 20 | `iter-20-easter-and-polish` | `aeaf44a` | Easter-egg quest + `--credits` flag + help alphabetisation. |
| 19 | `iter-19-new-game-plus` | `29ee7c2` | New Game+ mode and idle/AFK detection. |
| 18 | `iter-18-launch-ready` | `639d051` | Launch-ready — release checklist, Show HN draft, cross-promo. |
| 17 | `iter-17-final-consolidation` | `823180a` | Final consolidation — JOURNEY.md, badges, CHANGELOG sweep. |
| 16 | `iter-16-bug-bash` | `0e5cc29` | Deep bug-bash — 11/11 quests verified, 1 real bug fixed, +21 tests. |
| 15 | `iter-15-pack-and-tts` | `afc4d25` | 3 season-locked quests (cyber-bazaar / forgotten-archive / orbital-station), opt-in TTS, in-game tutorial, USER_GUIDE.md. |
| 14 | `iter-14-locales-and-leaderboard` | `f3babb1` | Locales (zh-tw + es), 5 new achievements, leaderboard, Markdown reports, retro/no-color polish. |
| 13 | `iter-13-finishing-touches` | `2bb93f1` | Finishing touches — quest reward items in world, `:dev wait-season`, campfire, v2.6 release. |
| 12 | `iter-12-content-depth` | `55184c8` | Content depth — 3 minigames, 3 quests, NPC affinity, seasons. |

Cumulatively: the CLI goes from v2.5 (the URL-foundry rename baseline) to
v2.8.0 with seasons, NPC affinity, leaderboard, additional locales, opt-in TTS,
in-game tutorial, USER_GUIDE, Markdown reports, New Game+ mode, idle detection,
the easter-egg quest, and a full launch docs set.

`package.json` `version` field on `iter-21-verify`: **`2.8.0`**
(version bump landed during the iter-13 finishing-touches commit, so this is
already aligned — see §4).

---

## 2. Recommended path: `squash-merge` per iter

Squashing keeps `main` readable as **one commit per iteration** while still
preserving the full history on the `iter-*` branches (and on `origin`).

```bash
# Land all iterations onto main in chronological order.
# Run from the repo root, on a clean working tree.

git checkout main
git pull --ff-only origin main

for branch in \
    iter-12-content-depth \
    iter-13-finishing-touches \
    iter-14-locales-and-leaderboard \
    iter-15-pack-and-tts \
    iter-16-bug-bash \
    iter-17-final-consolidation \
    iter-18-launch-ready \
    iter-19-new-game-plus \
    iter-20-easter-and-polish \
    iter-21-verify
do
  git merge --squash "$branch"
  git commit -m "$branch: squashed merge"
done

git push origin main
```

If you'd rather collapse the entire 13-commit gap into a **single** merge
commit on `main`, do this instead:

```bash
git checkout main
git pull --ff-only origin main
git merge --squash iter-21-verify
git commit -m "release v2.8: iter-12 → iter-21 squashed onto main"
git push origin main
```

Trade-off: zero per-iteration granularity on `main`, but a clean one-commit
delta. The `iter-*` branches still keep the granular history for archaeology.

---

## 3. Alternative: fast-forward `main` to `iter-21-verify`

Because `iter-21-verify` is a **direct linear descendant** of `main`
(`44cffb8` is its first ancestor), a fast-forward is possible and preserves
every single commit on `main`.

```bash
git checkout main
git pull --ff-only origin main
git merge --ff-only iter-21-verify
git push origin main
```

Use this if you want `main` to mirror the iter timeline 1:1 — you'll see all
13 commits show up on `main` exactly as they exist on the iter branches.

`git log --oneline main` after the FF will start with `c7bea4c` and run all
the way down to the original modular import.

---

## 4. Side-effects to plan for

### 4.1 No GitHub Pages workflow exists

Unlike the sister projects, this repo does **not** ship a Pages deployment.
The two workflows on disk are:

- `.github/workflows/ci.yml` — tests / lint on every push and PR.
- `.github/workflows/publish-npm.yml` — publishes to npm **only on `v*` tags**.

So the merge itself produces **no Pages redeploy** and **no npm publish**.
Both are intentional. The npm publish remains a manual `git tag v2.8.0 &&
git push --tags` follow-up.

### 4.2 CI test count will jump significantly

`main` today predates the iter-16 bug-bash test additions. Post-merge expect:

- **+21 tests** added in iter-16 alone, on top of all the iter-12 minigame /
  quest tests, iter-14 locale tests, and iter-15 season-quest tests.
- Whatever AFK / New-Game-Plus tests landed in iter-19.

The iter-21 verification pass already ran the full suite green, so the spike
is expected and safe.

### 4.3 `package.json` version is **already** at 2.8.0 — no bump needed

`iter-21-verify` reports `"version": "2.8.0"`, matching the user-visible
release the launch docs (RELEASE_CHECKLIST, LAUNCH_POST) target. **No
pre-merge bump is required.**

If you want to publish to npm post-merge, the sequence is:

```bash
# After main is merged + pushed
git checkout main
git pull --ff-only origin main
git tag v2.8.0
git push origin v2.8.0   # <- this triggers publish-npm.yml
```

The tag push (not the merge push) is what kicks off the registry publish.
Do not tag before the merge — the tag should point at the merged commit on
`main`, not at the head of an iter branch.

### 4.4 Branch hygiene

The 10 `iter-*` branches (12–21) will still exist locally and on `origin`
after the merge. They're not strictly needed once `main` catches up, but
**don't delete them yet** — they're the fallback if a regression appears
post-merge. A safe cleanup window is ~2 weeks of `main` running green.

### 4.5 Open PRs / forks

If a contributor is tracking `main` they will need to rebase / reset their
fork after the merge. The FF path adds 13 new commits; the squash path
rewrites very little but adds 1–10 new commits depending on how many squash
points you take.

### 4.6 Save-file compatibility

iter-12 introduced seasons, iter-19 introduced New Game+ — both touch the save
schema. iter-15's `save hardening` commit (referenced in the v2.3 history)
already added forward-compat shims, but **users with very old save files**
should expect either a one-time migration prompt or a cold-start. Worth a
note in the eventual `v2.8.0` release notes.

---

## 5. Pre-merge checklist

- [ ] CI on `iter-21-verify` is green (verified during iter-21).
- [ ] `npm test` passes locally on `iter-21-verify`.
- [ ] Decide on §2 vs §3 path; document the choice in the merge commit message.
- [ ] Confirm version is `2.8.0` (it is — see §4.3).
- [ ] Decide whether to tag `v2.8.0` immediately after the merge to trigger
      `publish-npm.yml`, or to hold the tag until release-day.
- [ ] Mention save-schema changes in the v2.8.0 release notes (§4.6).

Once those check out, the merge itself is a 30-second operation. The work
is in choosing the strategy, not in running it.
