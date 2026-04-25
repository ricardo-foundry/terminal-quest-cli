# Terminal Quest — Player Handbook

A complete reference for everything you can do inside Terminal Quest.
Updated for **v2.8 (iter-15)**.

If you only have five minutes, run `tutorial` from the in-game prompt — it
walks you through this entire guide in 12 steps.

---

## 1. Starting the game

```bash
npx terminal-quest-cli
# or, after npm install -g terminal-quest-cli
terminal-quest
tq                  # alias
```

### Useful CLI flags

| Flag | Purpose |
|---|---|
| `--slot <name>` | use a named save slot (default: `default`) |
| `--lang <code>` | force language: `en`, `zh`, `zh-tw`, `ja`, `es` |
| `--theme <name>` | force theme: `dark`, `light`, `retro` |
| `--no-boot` | skip the intro animation |
| `--no-color` | disable ANSI colours (for screen readers, log capture) |
| `--new` | start with a fresh save (your old slot is archived, not deleted) |
| `--dev` | hot-reload community quests on change |
| `--tts` | enable opt-in text-to-speech for NPC lines |
| `--list-quests` | print every loaded quest pack and exit |
| `--validate-quest <path>` | static-check a community quest JSON file |
| `--export-save <slot>` | dump a slot to stdout |
| `--import-save <file> <slot>` | load JSON into a named slot |
| `--cloud push|pull|list` | optional GitHub Gist sync (needs `GH_TOKEN`) |
| `--replay <slot>` | replay a recorded session |

---

## 2. Core in-game commands

### Navigation
| Command | Description |
|---|---|
| `ls [-a] [path]` | list a directory; `-a` shows hidden items |
| `cd <path>` | change directory; `cd ~` goes home, `cd ..` goes up |
| `cat <file>` | read a plain-text file |
| `pwd` | print working directory |
| `tree` | visualise the world below the current point |
| `look` | summarise NPCs, files and exits in the current room |
| `find <query>` | search file names |
| `grep <pattern> <file>` | pattern-search inside a file |

### World mechanics
| Command | Description |
|---|---|
| `scan` | enable detection mode (hidden objects show up) |
| `decode <file>` | decrypt `.enc` files (may yield key fragments) |
| `analyze` | inspect the current location |
| `hack` | trigger the hack mini-game (when available) |
| `run <minigame>` | play one of the bundled minigames |
| `unlock master` | use all three key fragments |

### NPCs & relationships
| Command | Description |
|---|---|
| `talk <npc> [choice]` | open a dialog; choices change `alignment` |
| `gift <item> to <npc>` | spend an inventory item to raise `affinity` |
| `affinity` | show your standing with every NPC |

### Time, seasons, bookmarks
| Command | Description |
|---|---|
| `wait <n>` | advance time by N turns (capped at 24/call) |
| `time` | print the in-game clock |
| `season` | print the current season |
| `bookmark <name>` | save the current path |
| `goto <name>` | jump to a bookmarked path (1 turn) |
| `bookmarks` | list saved bookmarks |

### Progress & stats
| Command | Description |
|---|---|
| `status` | character sheet: level, EXP, achievements |
| `inventory` / `inv` | list your items |
| `use <item>` | use an inventory item |
| `quests` | show built-in quest progress |
| `communityquests` | show pluggable quest pack progress |
| `achievements` | list unlocked / locked achievements |

### Meta & sharing
| Command | Description |
|---|---|
| `save [slot]`, `load <slot>`, `saves` | manage save slots |
| `theme <name>`, `lang <code>` | switch UI |
| `share` | print a copy-paste-able share card |
| `top [n]`, `top export`, `top import <file>` | local leaderboard |
| `report [slot]` | write a Markdown war story to `~/.terminal-quest/reports/` |
| `replay [slot]` | replay a recorded session |
| `tutorial` | re-run the 5-minute new-player tour |
| `tts on|off|status` | toggle optional NPC text-to-speech |
| `?` | one-screen cheat sheet |
| `exit` / `quit` | save and leave |

---

## 3. Quests

Terminal Quest ships **built-in quests** (linear story line) and a
**community quest pack** loaded from `./quests/<id>/quest.json`. Both grant
EXP and items when their step list is fully satisfied.

### Built-in quest line
1. **tutorial** — read `start_here.txt`
2. **explore_home** → **read_diary** → **find_secret**
3. **decode_message** — decrypt a `.enc` file
4. **meet_guide**, **explore_system**, **play_game**
5. **collect_keys** — gather 3 key fragments
6. **enter_shadow** → **find_master_key** → **unlock_master**

### Community pack (v2.8)
The bundled pack includes 11 quests covering the full season cycle:

| Quest | Season | Focus |
|---|---|---|
| `starter-lab` | any | introductory tour |
| `library-cipher` | any | decode mini-game |
| `ghost-train` | night | NPC choice |
| `shadow-archive` | any | lore + custom predicate |
| `clockwork-vault` | any | mid-game heist |
| `wandering-merchant` | non-winter | trade |
| `silicon-shrine` | spring | morse pilgrimage |
| `midnight-market` | any | late-game merchant |
| **`cyber-bazaar`** | **summer** | summer market with branching |
| **`forgotten-archive`** | **autumn / winter** | autumn archivist arc |
| **`orbital-station`** | **winter** | endgame, requires items from other quests |

Run `communityquests` to see live progress.

### Trigger reference
A quest step lists triggers; **all** triggers must match for the step to
complete. Supported types:

- `visitDir { path }`, `visitFile { path }`
- `decodeFile { file }`
- `keyFragments { min }`
- `level { min }`
- `alignment { min, max }`
- `gamePlayed { name }`
- `achievementUnlocked { id }`
- `season { season }` — string or array (`"spring"` or `["spring","summer"]`)
- `affinity { npc, min, max }` — per-NPC -100..+100 scale
- `hasItem { item }` — inventory check
- `custom { predicate }` — sandboxed expression over
  `level | exp | alignment | gamesPlayed | keyFragments | turn`

Branches are picked top-down: the first branch whose `condition` evaluates
true wins; otherwise the `default: true` branch fires.

---

## 4. Relationships

Every NPC has an **affinity** counter from -100 to +100 with a 5-mood
ladder:

| Range | Mood |
|---|---|
| ≥ 60 | adoring |
| 20…59 | friendly |
| -19…19 | neutral |
| -59…-20 | cold |
| ≤ -60 | hostile |

`talk` ticks affinity slowly. `gift` is the fast path; each NPC has a
preference table (some love rare-stamps, others want lantern-oil). When an
NPC first reaches `adoring` they may hand you a one-time **special item**.

`alignment` is a separate, world-wide -10..+10 morality scale. Choices in
`talk` adjust it, and quest branches frequently gate on it.

---

## 5. Seasons and the world clock

- **24 turns** = 1 in-game day
- **30 days** = 1 season (spring → summer → autumn → winter)
- **120 turns** = 1 full year

Seasons gate access to some areas and NPCs:

- `winter` — the shop is closed; the wandering merchant is gone
- `summer` — the researcher is on field leave
- `spring` — the silicon shrine awakens
- `autumn` / `winter` — the forgotten archive opens

Use `season` to inspect, `wait <n>` to advance, and `:dev wait-season` (if
launched with `--dev`) to skip to the next boundary.

---

## 6. Achievement strategy

A few playstyle flags worth chasing:

- **Polyglot** — switch between 4+ locales in one save (try
  `lang zh`, `lang ja`, `lang es`, `lang en`).
- **Night Shift** — survive 12 consecutive `night → dawn` transitions
  without your alignment dipping below its running minimum. Plan
  alignment-positive `talk` choices ahead of any night.
- **Merchant Friend** — gift `rare-stamp` x3 to `shop` to push affinity
  past 80. Easier in summer when the wandering merchant restocks.
- **Completionist** — finish 5 quests (built-in + community combined). The
  iter-15 pack alone earns 3 of these.
- **Silent Runner** — finish a quest **without ever** running `history`. A
  one-way gate: once you peek, the achievement is locked for that save.
- **Took the Tour** — granted automatically by running `tutorial`.

---

## 7. Optional text-to-speech

Terminal Quest ships an opt-in TTS mode for accessibility / vibes:

```bash
terminal-quest --tts          # enable from boot
```

In-game:

```
tts status     # show engine + on/off state
tts on         # enable (also speaks a short greeting)
tts off        # mute and kill any inflight speech
```

Engine detection:

- **macOS** → `say` (built-in)
- **Linux** → `espeak` or `espeak-ng` (install via your package manager)
- **Windows** → PowerShell `System.Speech.Synthesis.SpeechSynthesizer`
- **otherwise** → silent no-op

We never add a runtime dependency for TTS — it's pure `child_process` and
falls back gracefully if no engine is present. Speech is sanitised (ANSI
stripped, control bytes dropped, capped at 500 chars) before reaching the
shell, and we never use `shell: true`.

---

## 8. Save data

Saves live in `~/.terminal-quest/saves/<slot>.json`. The save envelope is
versioned and forward-compatible: new fields added in newer releases load
into older saves with their default values.

`--export-save` and `--import-save` are stable round-trip operations.
`--new` archives the existing slot to `<slot>.json.archived-<ts>` and also
keeps a `.bak` copy, so an accidental `--new` is recoverable.

---

## 9. Where to go next

- `docs/QUEST_FORMAT.md` — write your own community quests
- `docs/COMMANDS.md` — alphabetical command index
- `docs/CLOUD_SAVE.md` — the experimental Gist sync
- `docs/MANUAL_QA.md` — test plan if you want to contribute fixes
- `CHANGELOG.md` — what changed in each release

Happy exploring.
