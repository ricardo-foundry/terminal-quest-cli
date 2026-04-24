# Sample play session

> A real session captured by the maintainer on 2026-04-25 (macOS, Terminal.app,
> retro theme). Trimmed to ~50 lines and reproduced verbatim — copy/paste into
> a fresh `npx terminal-quest-cli` to follow along.

```text
$ npx terminal-quest-cli

[BIOS v2.1 - KIMI-OS]
[ok] Memory check
[ok] Initializing AI core
[ok] Mounting virtual file system
System ready.

  > Core modules loaded
  > Type "help" to start your adventure
  > Type "cat start_here.txt" for the tutorial

[🌅 06:00] [Lv.1] explorer@kimi-os:~$ ls
readme.txt  start_here.txt  diary.txt  notes/  .secret/

[🌅 06:00] [Lv.1] explorer@kimi-os:~$ cat start_here.txt
Welcome, explorer. Three key shards are scattered across the kimi-os
file system. Find them, combine them, then `unlock master`.
  +20 EXP (achievement: First Step)
  +50 EXP (quest: tutorial)

[🌅 07:00] [Lv.1] explorer@kimi-os:~$ scan
[scan] revealing hidden entries...
  .secret/    .keychain    .diary.bak

[🌅 08:00] [Lv.1] explorer@kimi-os:~$ cd /world
[🌅 09:00] [Lv.1] explorer@kimi-os:/world$ ls
nexus/  lab/  garden/

[🌅 09:00] [Lv.1] explorer@kimi-os:/world$ cd lab
[🌅 10:00] [Lv.1] explorer@kimi-os:/world/lab$ talk technician
technician (neutral): "If you came for the prototype, you'll need to
behave. The boss is watching."
  > [1] "I just want to look around."  (kindness +1)
  > [2] "Move aside."                   (ruthless +1)
  > [3] "Tell me about the boss."

[🌅 10:00] [Lv.1] explorer@kimi-os:/world/lab$ talk technician 1
technician (friendly): "Then take this. Found it under the bench."
  + obtained: cracked_chip
  +25 EXP (kindness +1)

[☀️ 12:00] [Lv.2] explorer@kimi-os:/world/lab$ run morse
Morse decode
Decode the message (single word). Type q to quit.

  -.- .. -- ..

answer 1/3 (or 'hint'): KIMI
decoded!
+80 EXP
*** ACHIEVEMENT UNLOCKED ***
  +-------------------------+
  | 📡  Morse Master        |
  | Decode without hints    |
  +-------------------------+

[☀️ 13:00] [Lv.2] explorer@kimi-os:/world/lab$ cd /shadow/archive
The archive doors are sealed during daylight.
  tip: try `wait` to advance the day/night cycle.

[☀️ 13:00] [Lv.2] explorer@kimi-os:/world/lab$ wait 6
time advances... 19:00 (Night)
*** ACHIEVEMENT UNLOCKED ***
  +-------------------------+
  | 🦉  Night Owl           |
  +-------------------------+

[🌙 19:00] [Lv.2] explorer@kimi-os:/shadow/archive$ share
share card written: ~/.terminal-quest/shares/card-explorer-2026-04-25T11-21-00Z.txt

[🌙 19:00] [Lv.2] explorer@kimi-os:/shadow/archive$ exit
goodbye, explorer
progress saved
```

If you want to record your own demo for asciinema, the maintainer uses:

```bash
asciinema rec docs/demo.cast \
  --idle-time-limit 1.5 \
  --command "npx --yes terminal-quest-cli --no-boot --theme retro"
```
