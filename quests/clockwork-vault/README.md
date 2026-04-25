# The Clockwork Vault

A mid-game heist quest. The player must combine the existing logic-puzzle
minigame, key fragments, and turn-based dusk timing to get past a brass
vault hidden under `/world/nexus/`.

## Gating summary

| step              | trigger              | notes                                    |
| ----------------- | -------------------- | ---------------------------------------- |
| find_vault        | visitDir             | discover the hidden door                  |
| warm_up_logic     | gamePlayed           | beat `run logic` (re-uses minigame)      |
| key_check         | keyFragments min 1   | leverage gives access                     |
| level_gate        | level min 3          | gears spin too fast for novices           |
| after_dusk        | custom predicate     | `turn >= 12` so the vault sleeps         |
| steal_gear        | hasItem master-gear  | new iter-12 trigger                       |

The `master-gear` item drops as a quest reward when the player reads
`/world/nexus/vault.txt` (added by future content patches). For now any
admin can `:save` an inventory entry to test the trigger.

## Branches

| branch  | condition          | text                                     |
| ------- | ------------------ | ---------------------------------------- |
| clean   | alignment >= +1    | replaced the gear with a forged copy      |
| rough   | alignment <= -3    | smash-and-grab; world hates you           |
| clever  | default            | clean burglary, no fanfare                |

## Rewards

- +350 EXP
- `clockwork-cog` (decorative)
- `vault-pass` (used by future side-quests)
