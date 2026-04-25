# Tweet drafts (v2.4 launch)

Five angles.  Pick whichever lands best with the audience you have;
cross-post sparingly.

## 1. Nostalgia

Remember when a text adventure was a single .exe and your imagination?
Terminal Quest is that, minus the .exe.  `npx terminal-quest-cli` and
you are inside a tiny retro world: ls, cd, cat, solve, sneak into
/shadow/realm.  MIT, 0 analytics, bilingual.

https://github.com/ricardo-foundry/terminal-quest-cli

## 2. Zero install

Unpopular opinion: the best way to try a game is the way that does
not ask for anything.  Terminal Quest: `npx terminal-quest-cli`.
No account, no launcher, no 200MB download.  A text adventure, a
retro prompt, ten minigames, one terminal.

## 3. Bilingual

I wanted a text adventure my Chinese friends and my English friends
could both enjoy without a translation layer.  Terminal Quest ships
with an English + 简体中文 UI (`lang en` / `lang zh`).  Every
narrative line, every prompt, every achievement.  `npx
terminal-quest-cli`.

## 4. Day/night cycle

Terminal Quest has an in-game clock.  Some rooms only open at night.
The lab researcher speaks differently at dawn.  There is an
achievement for witnessing every phase in one playthrough and one
for only ever playing at 3 AM.  `run morse`, wait, `cd /shadow`,
repeat.

## 5. Community quests

v2.4 ships a quest format that is just JSON.  Drop
`quests/your-id/quest.json` into the repo, list the steps + triggers
(visitDir, decodeFile, alignment...), add branching endings, open
a PR.  No engine changes, no plugin SDK.  Terminal Quest's world
should grow with the community, not with me.
