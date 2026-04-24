# In-game Commands

Every command is case-insensitive and accepts shell-style arguments. Anything
not listed here is simply ignored with a friendly hint.

## Navigation

| Command       | Purpose                                                  |
| ------------- | -------------------------------------------------------- |
| `ls`          | List files and directories in the current location.     |
| `ls -a`       | Like `ls`, but include hidden entries (starting with `.`).|
| `cd <dir>`    | Change into a directory. `cd ..` goes up, `cd /` goes home.|
| `pwd`         | Print the current in-game path.                          |
| `tree`        | Show a tree view of the current directory.              |
| `map`         | Show the world map and unlock progress.                 |

## Inspection

| Command          | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `cat <file>`     | Read the contents of a file.                                |
| `scan`           | Scan the area for hidden files and clues.                   |
| `find <name>`    | Search the world for a filename or directory name.          |
| `grep <text>`    | Search readable files for a piece of text.                  |
| `analyze`        | Deep-inspect the current area (may reveal secrets).         |

## Progress

| Command          | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `status`         | Show your level, EXP, title and current zone.              |
| `inventory`      | List items you are carrying.                                |
| `quests`         | Show active and completed quests.                           |
| `achievements`   | Show unlocked / locked achievements.                        |

## Interaction

| Command                | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `talk <npc>`           | Start a conversation. Known NPCs: `guide`, `shop`.     |
| `use <item>`           | Use an item from your inventory.                       |
| `decode <file>`        | Decrypt an encoded file.                               |
| `hack`                 | Enter hacker mode in the current area.                 |
| `unlock master`        | Attempt to unlock the endgame with the master key.     |

## Minigames

| Command          | Game                                                        |
| ---------------- | ----------------------------------------------------------- |
| `run snake`      | Classic snake. WASD or arrow keys, `P` pause, `Q` quit.     |
| `run guess`      | Guess a number between 1 and 100.                           |
| `run matrix`     | Matrix-style digital rain. Press any key to exit.           |
| `run pong`       | Single-player pong. First to 5 wins.                        |
| `run wordle`     | Wordle clone. 6 tries, standard letter coloring.            |

## Save & settings

| Command              | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `save`               | Save to the current slot (`default` unless changed).    |
| `save <slot>`        | Save to the named slot.                                 |
| `load`               | Reload the current slot.                                |
| `load <slot>`        | Load a different slot (starts fresh if missing).        |
| `slots`              | List all save slots with timestamps and levels.         |
| `lang`               | Toggle between supported languages (`en` / `zh`).       |
| `lang <code>`        | Force a specific language.                              |
| `theme`              | Cycle through available themes.                         |
| `theme <name>`       | Switch to `dark`, `light` or `retro`.                   |
| `help`               | Show contextual help.                                   |
| `clear`              | Clear the screen.                                       |
| `exit` / `quit`      | Leave the game (progress auto-saves first).             |

## Fun

| Command     | Effect                                                             |
| ----------- | ------------------------------------------------------------------ |
| `matrix`    | Shortcut for `run matrix`.                                         |
| `love`      | Prints a tiny ASCII heart.                                         |
| `coffee`    | Brews a virtual cup of coffee.                                     |
| `42`        | Answers the ultimate question.                                     |
| `hello`     | Say hi - the game may say hi back.                                 |

## Objective

1. Explore the filesystem and read the story files you find.
2. Use `scan` to reveal hidden files and directories.
3. Collect the **three key fragments**:
   - `AW4K3` somewhere under `/home/user/.secret/`
   - `_TH3_` deep inside `/system/core/`
   - `4I`    in `/shadow/realm/`
4. Combine them into the master key `AW4K3_TH3_4I`.
5. Run `unlock master` to reveal the ending.
