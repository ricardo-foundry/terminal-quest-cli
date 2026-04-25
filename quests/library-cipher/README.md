# The Library Cipher

A puzzle-forward quest that exercises `decodeFile`, the `gamePlayed`
trigger and the `keyFragments` gate. Unlike `shadow-archive`, this one
is solvable from level 1 - the only hard gate is the player's own puzzle
skill.

## Why this quest exists

It was designed as a showcase for three trigger types that the starter
quest doesn't touch:

- `decodeFile` (consumes `/library/diary_page.enc`)
- `gamePlayed` (requires the `cipher` minigame to have been run at least
  once; the minigame's own success condition is separate)
- `keyFragments` (player must own `>= 2` fragments - forces at least
  minimal exploration)

## Steps

| # | id             | trigger                                  |
| - | -------------- | ---------------------------------------- |
| 1 | enter_library  | visit `/library`                         |
| 2 | read_pinboard  | read `/library/pinboard.txt`             |
| 3 | decode_page    | decode `/library/diary_page.enc`         |
| 4 | play_cipher    | `run cipher` minigame has been played    |
| 5 | min_fragments  | own `>= 2` key fragments                 |

## Rewards

- +240 EXP
- `library-card` (collectible, no in-game effect beyond lore)

## Branches

- `return_page` (alignment >= +1) - good ending
- `keep_page` (alignment <= -1) - bad ending
- `neutral` - default

## Contributing

See [`docs/QUEST_FORMAT.md`](../../docs/QUEST_FORMAT.md).
