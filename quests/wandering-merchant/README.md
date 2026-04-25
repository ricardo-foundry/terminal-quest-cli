# The Wandering Merchant

A late-game timed quest that exercises every iter-12 system at once:

- season triggers (the merchant disappears in winter)
- affinity triggers (the existing `shop` NPC must be befriended first)
- hasItem trigger (proof you've transacted before)
- the existing nine triggers from earlier iterations

## Gating summary

| step                   | trigger        | notes                                       |
| ---------------------- | -------------- | ------------------------------------------- |
| spot_merchant_anywhere | visitDir       | enter `/shadow/realm`                        |
| not_winter             | season         | non-winter only                              |
| warmup_merchant        | achievement    | reuse `first_step`                           |
| build_trust            | affinity shop  | shop NPC affinity >= 20                      |
| carry_token            | hasItem        | merchant-token in inventory                  |
| level_gate             | level min 4    | seasoned customers only                      |

## Branches

| branch     | condition       | text                                      |
| ---------- | --------------- | ----------------------------------------- |
| honest     | alignment >= +2 | gift lantern, merchant disappears         |
| thief      | alignment <= -3 | stealth ending; merchant remembers you    |
| fair_trade | default         | clean transaction                         |

## Rewards

- +420 EXP
- `forbidden-lantern` (carry-light through dark areas — flavour for now)
- `merchant-token`    (refreshed copy — useful for chained trades)
- `wanderer-map`      (lore artifact)

## Notes for community contributors

The merchant is intentionally not a static NPC; treat them as a
"role" that any future quest can attach to. If you want to add new
endings, prefer adding `branches.<name>` entries here over forking
the file.
