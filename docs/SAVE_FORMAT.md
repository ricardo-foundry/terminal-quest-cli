# Save File Format

Terminal Quest CLI stores every save as a plain JSON file under
`~/.terminal-quest/saves/`. Each file is a full snapshot of the game state,
wrapped in a small envelope that lets us evolve the schema without breaking
existing players.

## File layout on disk

```
~/.terminal-quest/
└── saves/
    ├── default.json      # created automatically on first run
    ├── alice.json        # created by `save alice`
    └── speedrun.json
```

Writes are atomic: we first write `<slot>.json.tmp` and then `rename()` it
into place, so a crash mid-save never corrupts an existing slot.

## Envelope

```jsonc
{
  "schemaVersion": 2,                 // integer, bumped on breaking changes
  "slot":          "default",         // slot name, matches the filename
  "savedAt":       1739520000000,     // Date.now() at save time, ms epoch
  "state":         { /* game state */ }
}
```

| Field           | Type    | Notes                                                     |
| --------------- | ------- | --------------------------------------------------------- |
| `schemaVersion` | number  | Starts at `2`. Older files (v1 or unwrapped) are migrated on load. |
| `slot`          | string  | Sanitized slot name (`[a-zA-Z0-9_-]+`, max ~32 chars).    |
| `savedAt`       | number  | Epoch milliseconds.                                       |
| `state`         | object  | The actual game state. See below.                         |

## `state` object (v2)

The exact shape is considered semi-stable - additive changes do not bump the
schema version. The canonical reference is `src/save.js` plus the state
initializer in `src/game.js`.

```jsonc
{
  "currentPath":    "/home/user",      // current virtual working directory
  "visitedPaths":   ["/home/user", "/system/core"],

  "level":          3,                 // 1..7
  "exp":            420,
  "title":          "Explorer",        // derived from level, denormalized for speed

  "inventory":      ["key-fragment-1", "old-floppy"],
  "keyFragments":   ["AW4K3"],         // collected fragments, in order of discovery

  "quests": {
    "active":    ["find-the-guide"],
    "completed": ["tutorial", "first-scan"]
  },

  "achievements": {
    "first-step":   1739500000000,     // unlock timestamp, or `false` if locked
    "hacker":       false
  },

  "stats": {
    "commandsRun":  128,
    "filesRead":    42,
    "minigamesWon": 3
  },

  "lang":  "en",                       // "en" | "zh"
  "theme": "retro",                    // "dark" | "light" | "retro"

  "flags": {
    "masterUnlocked": false,
    "metGuide":       true
  }
}
```

## Migrations

Migrations run on every `load()` call. The rules live in `src/save.js`:

| From                          | To  | What happens                                                              |
| ----------------------------- | --- | ------------------------------------------------------------------------- |
| Legacy single-file save       | v2  | `~/.terminal-quest-save.json` is copied into `saves/default.json` and wrapped in the envelope. |
| Envelope with no `schemaVersion` | v2 | Treated as the raw `state` object, wrapped in the current envelope.       |
| `schemaVersion < 2`           | v2  | Bumped to `2`. No structural changes are needed yet.                      |

Future breaking migrations should:

1. Bump `SCHEMA_VERSION` in `src/save.js`.
2. Add a new branch in `migrate()` that transforms the old payload.
3. Add a test in `test/save.test.js` that loads a fixture of the old format.

## Deleting a save

Save files are safe to delete at any time - there is no index. Either:

- Run `slots` in-game, pick a slot, then `delete <slot>` (coming soon); or
- Remove the JSON file manually from `~/.terminal-quest/saves/`.

## Portability

The file is plain UTF-8 JSON, so you can freely copy it between machines,
check it into a gist, or hand-edit it for testing. The loader tolerates extra
unknown keys, so mods can add their own fields without conflicting with
core state.
