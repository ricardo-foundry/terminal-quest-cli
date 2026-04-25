# Cross-Promotion — Sister Projects

Terminal Quest CLI ships alongside a small family of terminal-first / hack-friendly
projects. If you enjoyed this one, the others are likely your jam too.

## Sister projects

### vampire-survivors-cli
A keyboard-only auto-attack roguelite inspired by the Vampire Survivors formula,
rendered with box-drawing characters. Same one-liner install, same "no GUI ever"
philosophy.

- Repo: https://github.com/ricardo-foundry/vampire-survivors-cli
- One-liner: `npx vampire-survivors-cli`
- Why play it after Terminal Quest: action loop instead of narrative loop —
  good palate cleanser between quest runs.

### openhand
An open-source, scriptable virtual hand-controller for terminal apps and games.
Maps gamepad / MIDI / accessibility input to stdin sequences, so you can play
Terminal Quest with anything from an Xbox pad to a foot pedal.

- Repo: https://github.com/ricardo-foundry/openhand
- One-liner: `npx openhand --target terminal-quest`
- Why pair it with Terminal Quest: zero-config controller support for the
  minigames (`snake`, `pong`, `qte`) without leaving the TTY.

## How we cross-link

| Surface | Action |
|---|---|
| README (this repo) | Final section "Sister Projects" links to both repos. |
| README (sister repos) | Mirror section linking back to `terminal-quest-cli`. |
| `docs/PRESS_KIT.md` | "Related work" paragraph mentions both. |
| Show HN / Reddit posts | Only mention sister projects if asked — never lead with them. |
| GitHub Release notes | Footer line: "See also: vampire-survivors-cli, openhand". |
| Tweet threads | Final tweet: "If you liked this, you'll like @… (sister projects)." |

## Rules of engagement

1. **No reciprocal-link spam.** Each sister-project mention must add value
   (related genre, related tooling) — never a bare URL dump.
2. **Version-pin nothing.** Cross-links go to the repo root, not to a tag,
   so they don't rot when we ship.
3. **Demote on failure.** If a sister project goes unmaintained (no commits in
   12 months), remove it from the README and demote it here to an archive note.
