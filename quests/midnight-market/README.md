# The Midnight Market

A late-game quest that exists to give the level-5+ player a reason to
come back to `/shadow/` and exercise the merchant NPC dialog tree.

## Gating summary

- level >= 5
- `turn >= 12` (replaces a wall-clock "after dark" rule)
- must have already played `run morse` at least once
- visit `/shadow` and read `/shadow/flyer.txt`

Nothing here should feel like a grind - every prerequisite is already
satisfied by the time most players reach the shadow realm for the first
time.

## Rewards

- +300 EXP
- `merchant-token` (used as a hidden discount marker in future quests)
- `lantern-oil` (flavour; no mechanical effect in v2.5)

## Branches

| branch   | condition        |                                           |
| -------- | ---------------- | ----------------------------------------- |
| generous | alignment >= +3  | best; merchant gifts the hint             |
| thief    | alignment <= -3  | triggers a hidden `blackmarket` flag      |
| trade    | default          | standard completion                       |

## Contributing

New NPC lines, flyer variants and alternative rewards are all welcome.
See [`docs/QUEST_FORMAT.md`](../../docs/QUEST_FORMAT.md) for the schema.
