# The Silicon Shrine

A spring-only quest that exercises the morse minigame, the new
season trigger, and the per-NPC affinity system.

## Gating summary

| step           | trigger      | notes                                                |
| -------------- | ------------ | ---------------------------------------------------- |
| find_shrine    | visitDir     | enter `/world/lab` (which already has phase rules)   |
| right_season   | season       | new iter-12 trigger - only matches in spring         |
| morse_warmup   | gamePlayed   | one win at `run morse`                               |
| shrine_keeper  | affinity     | new iter-12 trigger - keeper affinity >= 30          |
| decode_proof   | decodeFile   | reuse the existing cipher in the archive             |
| alignment_pure | alignment    | non-negative                                         |

## Branches

| branch  | condition       | text                                           |
| ------- | --------------- | ---------------------------------------------- |
| blessed | alignment >= +5 | shrine speaks back, hidden lore                |
| polite  | default         | three lights flicker; quest closes peacefully  |

## Rewards

- +280 EXP
- `shrine-token` (gift item — boost any NPC affinity by +12 future)
- `morse-card`  (collectible)

## Why this one matters

This is the only quest in the iter-12 pack that requires an entire
seasonal cycle to attempt. Players who started in summer/autumn will
have to either `wait` aggressively or revisit later. That long-loop
experience is the headline of the season system, so the shrine acts as
the canonical demo.
