# Ghost Train at Platform 0

A short nocturnal side-quest tied to `/station`. The train only "stops"
after the player has advanced the turn counter enough to see the
scheduled window (modelled in the quest as `turn >= 5` rather than a
hard clock, so a replay at any wall-time reproduces).

## How to run it

```bash
tq --list-quests                  # verify the quest loads
tq --validate-quest quests/ghost-train/quest.json
```

In-game:

```text
cd /station
cat timetable.txt
wait 8            # advance turns
talk conductor 1  # earns achievement `met_conductor`
```

## Steps

| # | id             | trigger                                     |
| - | -------------- | ------------------------------------------- |
| 1 | find_station   | visit `/station`                            |
| 2 | read_timetable | read `/station/timetable.txt`               |
| 3 | wait_for_night | `turn >= 5` (replaces wall-clock gate)      |
| 4 | talk_conductor | achievement `met_conductor` unlocked        |
| 5 | level_gate     | player level >= 3                           |

## Rewards

- +180 EXP
- `platform-ticket` (collectible, used by the `librarian` for a discount
  in the `library-cipher` quest)

## Branches

| branch         | condition        | note                                          |
| -------------- | ---------------- | --------------------------------------------- |
| return_ticket  | alignment >= +2  | best ending, unlocks an achievement hint      |
| keep_ticket    | alignment <= -2  | darker ending, conductor NPC disappears       |
| neutral        | default          | fallback                                      |

## Contributing

PRs welcome — see [`docs/QUEST_FORMAT.md`](../../docs/QUEST_FORMAT.md)
for the schema and full list of trigger types.
