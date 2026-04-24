# Quest JSON Format (v1)

Terminal Quest lets you ship playable quests as plain JSON files.  Drop a
new folder into `quests/` and the game will pick it up on startup — no
code changes required.

- File path: `quests/<quest-id>/quest.json`
- The folder name MUST equal the `id` field.  A mismatch is skipped
  with a warning so a typo cannot crash the game.

## Schema at a glance

```jsonc
{
  "schemaVersion": 1,                 // required, always 1 for now
  "id": "starter-lab",                // required; [a-z0-9_-] only
  "title": "Starter Lab Tour",        // required
  "description": "Find the lab ...",  // required
  "author": "Your Name",              // optional
  "tags": ["intro", "lore"],          // optional

  "steps": [                          // required, at least 1
    {
      "id": "enter_lab",              // required; unique within the quest
      "description": "Walk into /world/lab",
      "triggers": [                   // required, at least 1
        { "type": "visitDir", "path": "/world/lab" }
      ]
    }
  ],

  "rewards": {                        // optional
    "exp": 120,
    "items": ["lab-badge"]
  },

  "branches": {                       // optional endings
    "kind": {
      "condition": "alignment >= 2",
      "text": "The researcher smiles."
    },
    "curious": {
      "default": true,
      "text": "You pocket the badge."
    }
  }
}
```

## Trigger types

| Type                   | Fields                   | Description                                  |
| ---------------------- | ------------------------ | -------------------------------------------- |
| `visitDir`             | `path`                   | Player has walked into this path             |
| `visitFile`            | `path`                   | Player has read this file with `cat`         |
| `decodeFile`           | `file`                   | Player has decoded this file name            |
| `keyFragments`         | `min`                    | Player has collected at least `min` shards   |
| `level`                | `min`                    | Player has reached level `min`               |
| `alignment`            | `min` / `max` (optional) | Kindness alignment in the inclusive range    |
| `gamePlayed`           | `name`                   | Player has finished the named minigame       |
| `achievementUnlocked`  | `id`                     | Player has unlocked this achievement id      |
| `custom`               | `predicate`              | Sandboxed expression (see below)             |

All triggers inside a step must match for the step to count as done.

## Custom predicates

Custom predicates are evaluated in a whitelisted mini-language:

- Allowed identifiers: `level`, `exp`, `alignment`, `gamesPlayed`,
  `keyFragments`, `turn`.
- Allowed operators: `+ - * / ( ) && || ! < <= > >= == !=`
- Length capped at 200 characters.
- Anything outside the allowlist evaluates to `false` — we never `eval`
  arbitrary JavaScript.  You cannot reach `process`, `require`, `globalThis`
  or anything similar.

## Branches

`branches` are evaluated top-to-bottom after every step is complete.
The first whose `condition` (a custom predicate) passes wins; if none
match, the entry marked `default: true` is used.

## Rewards

- `exp`: a number added via the game's normal `addExp` path (so it
  triggers level-ups naturally).
- `items`: added to the player's inventory unless they already have the
  item.

## How to contribute a quest

1. Fork the repo and create `quests/<your-id>/quest.json`.
2. Run `node bin/terminal-quest.js --validate-quest quests/<your-id>/quest.json`
   and fix any reported issues.
3. Run `node bin/terminal-quest.js --list-quests` — your quest should
   appear in the output.
4. Run `npm test` — please do not regress existing tests.
5. Open a PR with:
   - the quest file
   - a one-paragraph pitch in the PR description
   - an optional link to a screenshot / asciinema session

By contributing you agree that your quest may be redistributed under
the project's MIT licence.

## Complete example

`quests/starter-lab/quest.json`:

```json
{
  "schemaVersion": 1,
  "id": "starter-lab",
  "title": "Starter Lab Tour",
  "description": "Find the abandoned lab and listen to what the researcher has to say.",
  "author": "Terminal Quest team",
  "tags": ["intro", "tutorial", "lore"],
  "steps": [
    {
      "id": "enter_lab",
      "description": "Walk into /world/lab",
      "triggers": [
        { "type": "visitDir", "path": "/world/lab" }
      ]
    },
    {
      "id": "read_notice",
      "description": "Read the faded notice on the wall",
      "triggers": [
        { "type": "visitFile", "path": "/world/lab/notice.txt" }
      ]
    },
    {
      "id": "read_research_log",
      "description": "Open the researcher's notebook",
      "triggers": [
        { "type": "visitFile", "path": "/world/lab/research_log.txt" }
      ]
    },
    {
      "id": "level_check",
      "description": "Reach level 2 before you leave",
      "triggers": [ { "type": "level", "min": 2 } ]
    }
  ],
  "rewards": { "exp": 120, "items": ["lab-badge"] },
  "branches": {
    "kind":    { "condition": "alignment >= 2", "text": "The researcher smiles." },
    "curious": { "default": true,               "text": "You pocket the badge." }
  }
}
```

## Hot-reload (dev mode)

Run `npm run dev` (or `node bin/terminal-quest.js --dev`) and the quest
loader will re-read your folder on every `communityquests` command so
you can iterate without restarting the game.
