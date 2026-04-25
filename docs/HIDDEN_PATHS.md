# Hidden Paths Reference

> **SPOILER WARNING**
> This document lists every hidden directory and file in the
> Terminal Quest world. It exists so contributors who write walkthroughs,
> quests, or accessibility tooling can audit the map.
>
> If you are playing the game for the first time, **stop reading now**.
> The fun is in finding these yourself with `scan`, `analyze`, `hack`,
> or the `abyss-gazer-eye` item.

---

## How players normally discover hidden paths

In-game, the only built-in ways to reveal a hidden entry are:

| Mechanism                  | Persistence              | Where it comes from                       |
| -------------------------- | ------------------------ | ----------------------------------------- |
| `scan`                     | Session-only (`scanMode`) | Top-level command                         |
| `hack`                     | Session-only             | Top-level command, also bumps level       |
| `analyze` (hint)           | Suggestion only          | Top-level command                         |
| `ls -a`                    | Per-listing flag          | Standard Unix-style flag                  |
| `use abyss-gazer-eye`      | Session-only             | Item dropped in `/shadow/realm/.void/`    |

None of these reveal the hidden paths in your save state directly — they
all just flip in-memory toggles. That keeps the discovery loop intact for
fresh playthroughs even if a friend with a save points the way.

## Hidden directories

| Path                          | Notes                                                    |
| ----------------------------- | -------------------------------------------------------- |
| `/.hidden_root`               | Hub — only reachable from `/`                            |
| `/home/user/.secret`          | Holds key fragment 1                                     |
| `/shadow`                     | Whole shadow realm hub                                   |
| `/shadow/archive`             | Cipher quest hub                                         |
| `/shadow/realm`               | **Lv.5 gated** — terminal area, holds master key         |
| `/shadow/realm/.void`         | Drops `abyss-gazer-eye` on first read of `whisper.txt`   |
| `/station/lost_property`      | Side path off `/station`                                 |

## Hidden files

| Path                                       | Notes                              |
| ------------------------------------------ | ---------------------------------- |
| `/home/user/notes.txt`                     | Flavour                            |
| `/home/user/.bash_history`                 | Flavour                            |
| `/home/guest/visitor_log.txt`              | Foreshadowing                      |
| `/system/core/ai_logs.txt`                 | Flavour                            |
| `/system/core/key_fragment_2.txt`          | **Key fragment 2 of 3**            |
| `/system/logs/chat.log`                    | Flavour                            |
| `/system/games/pong.exe`                   | Hidden minigame entry              |
| `/world/lab/core_sample.bin`               | Flavour                            |
| `/shadow/realm/key_fragment_3.txt`         | **Key fragment 3 of 3** (Lv.5)     |
| `/bin/hack`                                | Hidden tool                        |
| `/etc/credits.txt`                         | Easter egg                         |

## Auto-generated check

You can re-derive this list at any time:

```js
const { FILE_SYSTEM } = require('./src/data');
function walk(node, p, out) {
  if (!node.children) return;
  for (const [name, child] of Object.entries(node.children)) {
    const full = p + '/' + name;
    if (child.hidden) out.push({ path: full, type: child.type });
    if (child.type === 'dir') walk(child, full, out);
  }
}
const out = [];
walk(FILE_SYSTEM.root, '', out);
console.table(out);
```

Diffs between this table and the script output should be the only signal
needed when the world map changes.
