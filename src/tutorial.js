/**
 * @module tutorial
 * @description Pure tutorial-flow generator + REPL-friendly runner.
 *
 * The tutorial is a sequence of 12 short steps that introduces the player
 * to: navigation, scanning, decoding, talking to NPCs, gifting, seasons,
 * bookmarks, quests, achievements and the share/replay loop. Each step has:
 *
 *   id          stable string id (used by tests and progress checks)
 *   title       short heading printed in bold
 *   body        2-4 line explanation
 *   tryThis     a concrete one-line command to try
 *   estSeconds  rough pacing target (sum ~= 300s = 5 min)
 *
 * The runner is intentionally simple: it prints all steps in order with a
 * blank line and an `> tryThis` cue between each. We do NOT block the
 * readline loop — the player is free to skip ahead.
 *
 * `runTutorial(game, opts)` returns a summary object so callers (and tests)
 * can verify how many steps printed.
 */

'use strict';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Terminal Quest',
    body: [
      'You are an explorer logged into KIMI-OS, a virtual UNIX-like world.',
      'Your goal: walk the filesystem, decode hidden files, befriend NPCs,',
      'and finish quests. Everything is text — there is no GUI to find.'
    ],
    tryThis: 'help',
    estSeconds: 25
  },
  {
    id: 'looking_around',
    title: 'Look around',
    body: [
      'The world is a virtual filesystem. `look` shows what is in the',
      'current directory; `ls` lists files; `tree` zooms out.'
    ],
    tryThis: 'look',
    estSeconds: 25
  },
  {
    id: 'navigate',
    title: 'Move between directories',
    body: [
      'Use `cd <path>` to walk. Hidden directories start with a dot.',
      'Try `cd .secret` after `ls -a` reveals it.'
    ],
    tryThis: 'cd /home/user',
    estSeconds: 25
  },
  {
    id: 'reading',
    title: 'Read files',
    body: [
      '`cat <file>` reads a file. Plain text files show story; .enc files',
      'are encrypted and need `decode <file>`.'
    ],
    tryThis: 'cat start_here.txt',
    estSeconds: 25
  },
  {
    id: 'scan_decode',
    title: 'Scan and decode',
    body: [
      '`scan` flips on detection mode (hidden objects show up),',
      '`decode <file>` decrypts .enc files, sometimes giving key fragments.'
    ],
    tryThis: 'scan',
    estSeconds: 30
  },
  {
    id: 'talk_npcs',
    title: 'Talk to NPCs',
    body: [
      '`talk <npc> [choice]` opens a dialog. Choices change `alignment`.',
      'High alignment unlocks friendlier endings; low alignment unlocks',
      'thief endings. Both are valid.'
    ],
    tryThis: 'talk guide',
    estSeconds: 30
  },
  {
    id: 'gifts',
    title: 'Gifts and affinity',
    body: [
      'Each NPC has a -100..+100 affinity counter. `gift <item> to <npc>`',
      'consumes the item and bumps affinity. Adoring NPCs sometimes',
      'hand you a one-time special item.'
    ],
    tryThis: 'affinity',
    estSeconds: 30
  },
  {
    id: 'seasons_time',
    title: 'Seasons and time',
    body: [
      'Time flows: 24 turns = 1 day, 30 days = 1 season, 4 seasons = 1 year.',
      'Some quests are season-locked. `time` shows the clock; `season`',
      'shows the current season. `wait <n>` advances time.'
    ],
    tryThis: 'season',
    estSeconds: 30
  },
  {
    id: 'bookmarks',
    title: 'Bookmarks',
    body: [
      '`bookmark <name>` saves the current path. `goto <name>` jumps back.',
      'A jump costs 1 turn — cheaper than re-walking.'
    ],
    tryThis: 'bookmarks',
    estSeconds: 20
  },
  {
    id: 'quests_progress',
    title: 'Quests and achievements',
    body: [
      '`quests` lists built-in quests. `communityquests` lists pluggable',
      'quests from `./quests/`. Both reward EXP + items. `achievements`',
      'shows your trophies.'
    ],
    tryThis: 'quests',
    estSeconds: 30
  },
  {
    id: 'meta',
    title: 'Meta and sharing',
    body: [
      '`save [slot]`, `load <slot>` and `saves` manage progress.',
      '`top` shows a local leaderboard across slots; `report` writes a',
      'Markdown war story; `share` prints a copy-paste card.'
    ],
    tryThis: 'top',
    estSeconds: 20
  },
  {
    id: 'wrap',
    title: 'You are ready',
    body: [
      'Type `?` any time for the cheat sheet, or `help` for the long list.',
      'There is no time limit, no game over: explore at your own pace.',
      'Good luck, explorer.'
    ],
    tryThis: '?',
    estSeconds: 10
  }
];

/**
 * Total estimated runtime in seconds — handy for the "5 minutes" badge.
 *
 * @returns {number}
 */
function totalEstSeconds() {
  return TUTORIAL_STEPS.reduce((s, step) => s + (step.estSeconds || 0), 0);
}

/**
 * Render a single step as plain text. UI/colour wrapping is done by the
 * caller so this function stays unit-testable.
 *
 * @param {object} step
 * @returns {string[]} lines (no trailing blank)
 */
function renderStep(step) {
  const out = [];
  out.push(`[${step.id}] ${step.title}`);
  out.push('-'.repeat(Math.min(60, (step.title.length + step.id.length + 4))));
  for (const b of step.body) out.push(b);
  out.push('');
  out.push(`> try: ${step.tryThis}`);
  return out;
}

/**
 * Run the tutorial against a game instance. We do NOT execute the
 * `tryThis` commands — that would surprise the player and step on
 * their save state. We only print the guidance.
 *
 * @param {object} game            TerminalGame instance (or compatible)
 * @param {object} [opts]
 * @param {Function} [opts.print]  defaults to console.log
 * @param {Array}    [opts.steps]  override step list (used by tests)
 * @returns {{ printed: number, totalSeconds: number, steps: string[] }}
 */
function runTutorial(game, opts) {
  const o = opts || {};
  const steps = Array.isArray(o.steps) ? o.steps : TUTORIAL_STEPS;
  const print = typeof o.print === 'function' ? o.print : (line) => console.log(line);
  let printed = 0;
  print('');
  print('Tutorial - 12 steps, ~5 minutes.');
  print('You can stop any time by typing a real command. Your save will not');
  print('be touched until you actually run something.');
  print('');
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const head = `(${i + 1}/${steps.length})`;
    print(head);
    for (const line of renderStep(step)) print(line);
    print('');
    printed++;
  }
  print('Tutorial complete. Press Enter or type a command to begin.');
  // Mark that the player saw the tutorial. This drives a future
  // achievement and lets us suppress the "type cat start_here.txt"
  // hint on the next boot.
  if (game && game.gameState) {
    game.gameState.tutorialSeen = true;
    if (Array.isArray(game.gameState.achievements) &&
        !game.gameState.achievements.includes('took_the_tour')) {
      // Soft-grant the achievement. Saves don't carry it pre-iter-15
      // so the entry is harmless if the achievement never lands in
      // ACHIEVEMENTS map.
      game.gameState.achievements.push('took_the_tour');
    }
  }
  return {
    printed,
    totalSeconds: totalEstSeconds(),
    steps: steps.map((s) => s.id)
  };
}

module.exports = {
  TUTORIAL_STEPS,
  totalEstSeconds,
  renderStep,
  runTutorial
};
