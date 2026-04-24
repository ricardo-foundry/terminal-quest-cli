<div align="center">

# Terminal Quest CLI

**A bilingual RPG adventure that lives entirely in your terminal.**

[![npm version](https://img.shields.io/npm/v/terminal-quest-cli.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/terminal-quest-cli)
[![npm downloads](https://img.shields.io/npm/dm/terminal-quest-cli.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/terminal-quest-cli)
[![CI](https://github.com/Ricardo-M-L/terminal-quest-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Ricardo-M-L/terminal-quest-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >= 14](https://img.shields.io/badge/node-%3E%3D14-43853d?logo=node.js&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)](#)

```
    ██╗  ██╗██╗███╗   ███╗██╗      ██████╗ ███████╗
    ██║ ██╔╝██║████╗ ████║██║     ██╔═══██╗██╔════╝
    █████╔╝ ██║██╔████╔██║██║     ██║   ██║███████╗
    ██╔═██╗ ██║██║╚██╔╝██║██║     ██║   ██║╚════██║
    ██║  ██╗██║██║ ╚═╝ ██║███████╗╚██████╔╝███████║
    ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝ ╚═════╝ ╚══════╝
              Terminal Quest v2.0
```

</div>

## Demo

> A short asciinema recording will live at [`docs/demo.cast`](./docs/demo.cast) —
> rendered at the top of this README once captured. In the meantime, try it
> yourself without installing anything:

```bash
npx terminal-quest
```

## Features

- **Multi-slot saves** stored as plain JSON under `~/.terminal-quest/saves/`,
  with `schemaVersion` migrations so old saves still load.
- **Bilingual UI** — English and Chinese, switchable at runtime or via
  `--lang`.
- **Themeable** — `dark`, `light`, and `retro` palettes, or drop in your own.
- **RPG progression** — 7 levels, 34 achievements across 6 categories,
  12 main-story quests and a key-shard endgame.
- **8 built-in minigames** — snake, guess-the-number, matrix rain, pong,
  Wordle clone, reaction QTE, logic-circuit solver and morse decoder.
- **Zero new runtime deps** — just `chalk`, `figlet`, and `keypress`.
- **Tested** — 51 tests on Node's built-in test runner, run on Node 18 / 20 /
  22 across Ubuntu, macOS and Windows.

### v2.1 — content depth update

- New areas `/world/lab/` and `/shadow/archive/` with their own NPCs and
  lore, gated by the new in-game day/night cycle.
- NPCs now have mood-based greetings and branching dialog that shifts your
  kindness/ruthless alignment. Reach +5 or -5 for alignment-exclusive
  achievements.
- Shell-like command ergonomics: `alias`/`unalias`, `history`, `!!`, `!<n>`,
  a `complete <prefix>` helper and a categorised `inventory` table.
- `share` generates a paste-ready ASCII score card under
  `~/.terminal-quest/shares/` — perfect for screenshots.

## Install

```bash
# global install
npm install -g terminal-quest-cli
terminal-quest          # or: tq / adventure

# one-off with npx
npx terminal-quest

# from source
git clone https://github.com/Ricardo-M-L/terminal-quest-cli.git
cd terminal-quest-cli
npm install
npm start
```

## Usage

Once you are in the game, explore the world with familiar Unix-like commands.
The full reference lives in [`docs/COMMANDS.md`](./docs/COMMANDS.md); the table
below is a quick cheat sheet.

| Category   | Commands                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| Navigation | `ls`, `ls -a`, `cd <dir>`, `pwd`, `tree`, `map`                          |
| Inspect    | `cat <file>`, `scan`, `find <name>`, `grep <text>`, `analyze`            |
| Progress   | `status`, `inventory`, `quests`, `achievements`                          |
| Interact   | `talk <npc>`, `use <item>`, `decode <file>`, `hack`, `unlock master`     |
| Play       | `run snake`, `run guess`, `run matrix`, `run pong`, `run wordle`         |
| Meta       | `save`, `save <slot>`, `load`, `load <slot>`, `lang`, `theme`, `help`    |
| Fun        | `matrix`, `love`, `coffee`, `42`, `hello`                                |

### CLI flags

| Flag                | Description                                          | Example                         |
| ------------------- | ---------------------------------------------------- | ------------------------------- |
| `--slot <name>`     | Load or create a named save slot on startup.         | `terminal-quest --slot alice`   |
| `--lang <en\|zh>`   | Force a UI language.                                 | `terminal-quest --lang en`      |
| `--theme <name>`    | Pick a theme: `dark`, `light`, `retro`.              | `terminal-quest --theme retro`  |
| `--new`             | Start a fresh save (ignores auto-load).              | `terminal-quest --new`          |
| `--dev`             | Enable verbose dev logging.                          | `terminal-quest --dev`          |
| `--version`         | Print the package version and exit.                  | `terminal-quest --version`      |
| `--help`            | Show CLI help.                                       | `terminal-quest --help`         |

## Save locations

Saves are written to your home directory as plain JSON:

```
~/.terminal-quest/
└── saves/
    ├── default.json
    ├── alice.json
    └── speedrun.json
```

The on-disk format is documented in [`docs/SAVE_FORMAT.md`](./docs/SAVE_FORMAT.md).
The loader auto-migrates older formats (including the legacy
`~/.terminal-quest-save.json` single-file save) so upgrading never nukes your
progress.

## i18n

Bundled languages:

| Code | Language |
| ---- | -------- |
| `en` | English  |
| `zh` | 中文     |

Switch at any time with the in-game `lang` command, or launch with `--lang en`
/ `--lang zh`. New language packs only need to implement the keys in
`src/i18n.js`.

## Themes

Bundled themes live in `src/themes.js`:

- `dark` (default)
- `light`
- `retro` — green-on-black, CRT vibes

Switch with `theme retro` in-game or `--theme retro` on startup. Custom themes
are just an object of `chalk` color names.

## Roadmap

- [ ] Record `docs/demo.cast` and embed at the top of the README
- [ ] Publish 1st-class `tq` completions for bash / zsh / fish
- [ ] Mod API for third-party quests and zones
- [ ] More language packs (ja, fr, es)
- [ ] Cloud-save adapter (optional, opt-in)

## Contributing

Issues, PRs and new quest ideas are warmly welcome. Please read
[`CONTRIBUTING.md`](./CONTRIBUTING.md) first, and note that this project
follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

For security issues, please see [`SECURITY.md`](./SECURITY.md) and do **not**
open a public GitHub issue.

## License

[MIT](./LICENSE) © KIMI-AI and contributors.

---

## 中文速览

在真实终端里运行的 RPG 冒险解谜游戏。支持中英双语、多槽位存档、可切换主题、
5 个迷你游戏、18 个成就、12 个主线任务。

### 安装

```bash
npm install -g terminal-quest-cli
terminal-quest      # 启动游戏；或 tq / adventure
# 免安装
npx terminal-quest
```

### 常用命令

- 探索：`ls`、`ls -a`、`cd <目录>`、`tree`、`scan`
- 查看：`cat <文件>`、`find <名字>`、`grep <文本>`、`analyze`
- 角色：`status`、`inventory`、`quests`、`achievements`
- 互动：`talk <npc>`、`use <物品>`、`decode <文件>`、`unlock master`
- 小游戏：`run snake` / `run guess` / `run matrix` / `run pong` / `run wordle`
- 系统：`save <槽位>`、`load <槽位>`、`lang`、`theme`、`help`

### 存档位置

- 新格式：`~/.terminal-quest/saves/<slot>.json`
- 旧版单文件存档会自动迁移。

### 目标

找到 3 块密钥碎片（`AW4K3`、`_TH3_`、`4I`），合成主密钥 `AW4K3_TH3_4I`，
输入 `unlock master` 解锁最终秘密。
