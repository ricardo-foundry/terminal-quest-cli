# Terminal Quest CLI - Documentation

This folder holds the long-form reference material that does not fit in the
top-level `README.md`.

## Contents

- [`COMMANDS.md`](./COMMANDS.md) - Every in-game command, grouped by category.
- [`SAVE_FORMAT.md`](./SAVE_FORMAT.md) - On-disk save file layout and the
  `schemaVersion` migration rules.

## Demo recording

A terminal session recording should live at `docs/demo.cast`. Capture it with
[asciinema](https://asciinema.org/):

```bash
asciinema rec docs/demo.cast -c "npx terminal-quest --lang en --theme retro"
```

The top-level README links to this file so it appears as an animated preview
on GitHub and the npm page once the recording is committed.

> The `.cast` artifact is intentionally not included in the npm tarball -
> it only needs to ship on GitHub / in the docs site.
