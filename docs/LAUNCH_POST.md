# I built a text adventure that lives in your terminal — and never leaves it

Some games you download.  Some games you install.  Terminal Quest is
different: it runs one `npx` away.  Open a terminal, type
`npx terminal-quest-cli`, and a retro boot sequence hands you a shell
inside a small, bilingual, filesystem-shaped world.

I grew up on text adventures.  They taught me that a good world only
needs a few nouns and a lot of care.  I wanted to remake that feeling
without the ceremony — no launcher, no accounts, no 200 MB of Unity.
Just Node.js, your terminal font, and a command prompt that happens
to belong to a fictional AI called KIMI-OS.

There are 10 minigames (Snake, Wordle, Morse, chess puzzles, Caesar
ciphers and more), 23 achievements across speedrun / puzzle /
collection tracks, a day/night cycle that gates certain rooms, and an
alignment system that remembers whether you spoke kindly to the
archivist three hours ago.

The thing I am proudest of is the **community quest format**.  Quests
are plain JSON files — drop one into `quests/<your-id>/quest.json`
and the game loads it at startup.  No plugin API, no DLL loading,
no build step.  A quest is a title, a list of steps, a list of
triggers for each step, and optional branching endings.  The trigger
system is tiny (`visitDir`, `visitFile`, `level`, `alignment`, etc.)
but that seems to be enough for writers to do surprising things.

v2.4 also adds replay recording (every command you type is saved and
can be played back frame-by-frame) and experimental cloud saves via
private GitHub Gists — opt-in, BYO token, nothing phones home by
default.

If you ever built a fort out of your bedroom furniture because the
floor was lava, you already understand how to play Terminal Quest.
It is free, MIT-licensed, 0 runtime dependencies added in v2.4, and
it genuinely tries to be the nicest thing in your terminal today.

`npx terminal-quest-cli`.  Say hi to KIMI for me.
