# Cross-platform support matrix

Terminal Quest is designed to behave identically across macOS, Linux and
Windows. The notes below document the verified combinations, the
degradation strategy for limited terminals, and the handful of known
limitations so new contributors do not have to rediscover them.

## Verified platforms

| OS                      | Shell / Terminal            | Node | Status |
| ----------------------- | --------------------------- | ---- | ------ |
| macOS 14 (arm64)        | iTerm2, Terminal.app        | 18 / 20 / 22 | primary dev target |
| Ubuntu 22.04            | gnome-terminal, xterm       | 18 / 20 / 22 | CI |
| Ubuntu 22.04            | tmux + alacritty            | 20           | works |
| Windows 11              | Windows Terminal (cmd + PS) | 18 / 20 / 22 | CI |
| Windows 10 >= 1809      | cmd.exe, PowerShell 5.1     | 18 / 20      | works (ANSI enabled) |
| Windows 10 < 1809       | cmd.exe                     | 18           | ASCII fallback |
| Alpine 3.19 (musl)      | busybox ash                 | 20           | works |
| WSL2 (Ubuntu)           | wsl.exe + Windows Terminal  | 20 / 22      | works |
| CI: macos-latest        | bash                        | 18 / 20 / 22 | green |
| CI: ubuntu-latest       | bash                        | 18 / 20 / 22 | green |
| CI: windows-latest      | bash + pwsh                 | 18 / 20 / 22 | green |

## Colour degradation chain

The `src/terminal.js` detector walks the env in this order and stops
at the first match:

1. `--no-color` flag or `NO_COLOR` env var      -> level 0 (plaintext)
2. `FORCE_COLOR=<n>`                            -> level n (override)
3. `TERM=dumb`                                  -> level 0
4. not a TTY (piped, redirected, CI)            -> level 0
5. `COLORTERM=truecolor` or `24bit`             -> level 3 (16M colours)
6. `TERM` matches `-256(color)?`                -> level 2
7. `TERM` matches `xterm|screen|rxvt|vt…`       -> level 1
8. Windows >= 10 (build 10+)                    -> level 2
9. fallback                                     -> level 1 (TTY) or 0

At level 0 the palette swaps to an ASCII decorator set (`[WARN]`,
`[ERROR]`, `[OK]`, `>>`, `*`) so piping the game's output through
`less`, `tee` or a CI log remains legible.

## Wide-character handling

CJK glyphs, Hangul, Hiragana, fullwidth forms and emoji all render in
two terminal cells. JavaScript's `String.length` counts UTF-16 code
units and returns the wrong number for every one of them. `src/wcwidth.js`
provides a self-contained replacement (`visualWidth`, `padVisual`,
`centerVisual`, `truncateVisual`, `wrapVisual`) which every table,
panel and progress bar in the game uses.

Combining marks, variation selectors (emoji skin tones, VS-16) and
zero-width joiners are counted as width 0 — matching every compliant
terminal we tested.

## Path handling

Two distinct path vocabularies:

- **Host filesystem** (save files, config, export/import): uses the
  OS-native `path` module. On Windows this means backslash
  separators, drive letters and 260-char `MAX_PATH` still apply.
- **Virtual filesystem** inside the game (`/home/user`, `/shadow/realm`,
  ...): always forward-slash, always posix-rooted. `normalizePath()`
  in `src/game.js` uses `path.posix` so that a Windows host never leaks
  backslashes into the game world. It also coerces any `\` the player
  pastes into `/` so `cd ..\diary.txt` works on every platform.

## Known limitations

- **Legacy Windows CMD (< 1809)** does not support ANSI by default.
  We fall back to ASCII decorators automatically, but the retro
  amber theme will look monochrome orange in `cmd.exe`. Use Windows
  Terminal or PowerShell 7 for the full experience.
- **Emoji rendering** varies across fonts. `visualWidth` always
  treats emoji as width 2, but if your terminal font renders them
  at width 1 (rare — Windows Terminal pre-1.18 did this) you may see
  trailing padding inside boxes. Install a patched Nerd Font or the
  Windows Terminal UTF-8 config to fix.
- **Ctrl+C** is intentionally single-press-warning, double-press-exit
  on every platform. On Windows CMD some shell launchers intercept
  the first SIGINT before our handler — press Ctrl+C twice in that
  case.
- **Save files > 1 MiB** emit a warning. The game still works but we
  recommend `terminal-quest --export-save <slot> > backup.json` and a
  trim via `saves` + `load`.
- **NPM global install on Windows** may require elevation the first
  time; `npx terminal-quest-cli` bypasses that entirely.

## Opt-outs and overrides

| env var         | effect |
| --------------- | ------ |
| `NO_COLOR=1`    | force plaintext output |
| `FORCE_COLOR=2` | pretend 256-colour even in CI |
| `FORCE_COLOR=3` | pretend truecolor |
| `TERM=dumb`     | force plaintext (FORCE_COLOR wins if set) |

| CLI flag        | effect |
| --------------- | ------ |
| `--no-color`    | same as `NO_COLOR=1` |
| `--no-boot`     | skip the BIOS boot animation |
| `--new`         | archive previous save, start a fresh game |
| `--export-save <slot>` | print slot JSON to stdout |
| `--import-save <file> <slot>` | import JSON into a slot |

## Testing a new platform

```sh
npm ci
npm test           # must be 100+ tests, all green
node bin/terminal-quest.js --no-boot --no-color <<< 'help'
```

The CI matrix (`.github/workflows/ci.yml`) runs on
`ubuntu-latest`, `macos-latest` and `windows-latest` with Node 18, 20
and 22 on every push to `main`.
