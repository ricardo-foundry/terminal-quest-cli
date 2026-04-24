# Cloud saves (experimental)

Terminal Quest is a single-player, offline-first game.  We do not want
to turn it into a service you have to trust with anything.  So cloud
save is:

- **off by default** — nothing phones home unless you pass `--cloud`
- **BYO backend** — we ship one optional reference backend (GitHub
  Gist) and an abstract `CloudBackend` you can subclass
- **opt-in per operation** — `--cloud push`, `--cloud pull`,
  `--cloud list` are explicit
- **env-scoped credentials** — the Gist backend reads `GH_TOKEN` from
  the environment only, never from your save file or home directory

## Why we are not enabling it by default

1. **Privacy.**  Your save contains every path you visited, every
   command you ran (via replay) and your alignment.  That is nobody
   else's business.
2. **Complexity.**  Cloud sync conflicts are hard.  We would rather
   stay simple and let you script your own sync.
3. **Trust.**  We do not want you to have to trust us with credentials
   or inferences about your play style.

## Usage

### Push the default slot to a private gist

```sh
export GH_TOKEN=<a fine-grained token with `gist` scope>
terminal-quest --cloud push default
```

### List your cloud slots

```sh
terminal-quest --cloud list
```

### Pull a slot back to disk

```sh
terminal-quest --cloud pull default
```

The pulled payload is piped back through `importSlot` so the on-disk
schema validator still runs — a broken gist cannot brick your local
save.

## Security model

- **Tokens never enter the save file.**  They live in `GH_TOKEN` and
  are used only for outbound HTTPS requests to `api.github.com`.
- **Private gists only.**  `push()` sets `public: false`.  If you
  want public sharing, use `--export-save` and paste the JSON yourself.
- **No auto-sync.**  The game will never call a cloud backend on its
  own — every sync is an explicit CLI invocation.
- **Minimum scope.**  A fine-grained token with `gist` read/write is
  enough.  We do not need `repo`.

## Writing a new backend

```js
const { CloudBackend } = require('terminal-quest-cli/src/cloud');

class MyBackend extends CloudBackend {
  async push(slot) { /* ... return { ok, id?, url?, error? } */ }
  async pull(slot) { /* ... return { ok, bytes, json?, error? } */ }
  async list()     { /* ... return { ok, items: [], error? } */ }
}
```

Then fork the CLI entry point and swap `GistBackend` for your class.
There is no registry — we are keeping it minimal until we are sure
people actually use this.

## Known limitations

- One gist per slot per push.  There is no current "update in place"
  for a single gist across pushes — pulls always fetch the most recent
  match by filename.  Roadmap.
- No encryption-at-rest in the reference backend.  Treat the gist as
  the same threat surface as your local `~/.terminal-quest/` folder.
- Rate limiting is on you.  We do not back off automatically.
