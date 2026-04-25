/**
 * @module quest-builder
 * @description Interactive quest authoring helper.
 *
 * Walks a contributor through prompts on stdin and emits a JSON object
 * that matches `src/quests.js` schemaVersion 1. The output is then run
 * through the same `validateQuest()` the loader uses, so anything this
 * module emits is guaranteed to round-trip through the loader.
 *
 * Used by `bin/terminal-quest.js --validate-quest <path> --interactive`
 * (or with `--validate-quest=new` to skip the path) to make first-time
 * quest contributions easier — see docs/QUEST_FORMAT.md.
 *
 * Pure I/O is injected so the unit test can exercise the builder with
 * a scripted answer stream and inspect the produced quest.
 */

'use strict';

const { TRIGGER_TYPES, validateQuest } = require('./quests');

/**
 * Build a quest interactively. Pure function over an answer iterator
 * — no readline, no fs. The CLI wrapper hooks readline up to this.
 *
 * @param {{ ask:(prompt:string)=>Promise<string>, write?:(line:string)=>void }} io
 * @returns {Promise<{ quest: object, errors: string[] }>}
 */
async function buildQuestInteractive(io) {
  const ask = io.ask;
  const write = io.write || ((s) => process.stdout.write(s + '\n'));

  write('Terminal Quest -- interactive quest builder');
  write('Press <enter> to accept the default in [brackets].');
  write('');

  const id = (await ask('quest id (folder name, e.g. forest-trial): ')).trim();
  const title = (await ask('title: ')).trim() || (id || 'Untitled');
  const description = (await ask('one-line description: ')).trim() || 'TODO: describe this quest';
  const author = (await ask('author handle [anonymous]: ')).trim() || 'anonymous';
  const tagsRaw = (await ask('tags (comma-separated, blank for none): ')).trim();
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const stepCountRaw = (await ask('how many steps? [1]: ')).trim();
  const stepCount = Math.max(1, Math.min(20, parseInt(stepCountRaw, 10) || 1));

  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    write('');
    write(`-- step ${i + 1} of ${stepCount} --`);
    const sid = (await ask(`step id [step_${i + 1}]: `)).trim() || `step_${i + 1}`;
    const sdesc = (await ask('step description: ')).trim() || 'TODO: describe this step';

    const triggerCountRaw = (await ask('how many triggers for this step? [1]: ')).trim();
    const triggerCount = Math.max(1, Math.min(8, parseInt(triggerCountRaw, 10) || 1));
    const triggers = [];
    for (let j = 0; j < triggerCount; j++) {
      write('');
      write(`  trigger ${j + 1} of ${triggerCount}`);
      write(`  available types: ${[...TRIGGER_TYPES].join(', ')}`);
      let type = (await ask('  type: ')).trim();
      if (!TRIGGER_TYPES.has(type)) {
        write(`  (unknown type "${type}", defaulting to "visitDir")`);
        type = 'visitDir';
      }
      triggers.push(await readTriggerFields(ask, type));
    }
    steps.push({ id: sid, description: sdesc, triggers });
  }

  write('');
  const expRaw = (await ask('reward EXP [50]: ')).trim();
  const exp = Math.max(0, parseInt(expRaw, 10) || 50);
  const itemsRaw = (await ask('reward items (comma-separated, blank for none): ')).trim();
  const items = itemsRaw ? itemsRaw.split(',').map((x) => x.trim()).filter(Boolean) : [];

  const quest = {
    schemaVersion: 1,
    id,
    title,
    description,
    author,
    tags,
    steps,
    rewards: { exp, items },
    branches: {
      neutral: { default: true, text: 'You finish the quest.' }
    }
  };

  const verdict = validateQuest(quest);
  return { quest, errors: verdict.errors };
}

/**
 * Read the type-specific fields for a trigger. Kept tiny on purpose so
 * the prompts mirror the documented schema. Unknown fields fall back to
 * sensible defaults so the validator is happy.
 */
async function readTriggerFields(ask, type) {
  const base = { type };
  switch (type) {
    case 'visitDir':
    case 'visitFile':
      base.path = (await ask('  path (e.g. /world/lab): ')).trim() || '/home/user';
      return base;
    case 'decodeFile':
      base.file = (await ask('  file basename (e.g. cipher.enc): ')).trim() || 'message.enc';
      return base;
    case 'keyFragments':
      base.min = parseInt((await ask('  min fragments [1]: ')).trim(), 10) || 1;
      return base;
    case 'level':
      base.min = parseInt((await ask('  min level [2]: ')).trim(), 10) || 2;
      return base;
    case 'alignment': {
      const minRaw = (await ask('  min alignment (blank for none): ')).trim();
      const maxRaw = (await ask('  max alignment (blank for none): ')).trim();
      if (minRaw !== '') base.min = parseInt(minRaw, 10) || 0;
      if (maxRaw !== '') base.max = parseInt(maxRaw, 10) || 0;
      return base;
    }
    case 'gamePlayed':
      base.name = (await ask('  game name (e.g. snake): ')).trim() || 'snake';
      return base;
    case 'achievementUnlocked':
      base.id = (await ask('  achievement id (e.g. first_step): ')).trim() || 'first_step';
      return base;
    case 'custom':
      base.predicate = (await ask('  predicate (e.g. level >= 3 && alignment > 0): ')).trim() || 'level >= 1';
      return base;
    default:
      base.path = '/home/user';
      base.type = 'visitDir';
      return base;
  }
}

/**
 * Convenience helper: use Node's readline against process.stdin/stdout.
 * Returns an `io` object compatible with `buildQuestInteractive()`.
 *
 * Uses a queued `line` listener so it works equally well when stdin is
 * a TTY *and* when it is a piped fd (we want the same builder to drive
 * scripted contributions in CI).
 *
 * @param {object} [opts] passthrough to readline.createInterface
 * @returns {{ ask: (q:string)=>Promise<string>, write: (s:string)=>void, close: ()=>void }}
 */
function readlineIO(opts = {}) {
  const readline = require('readline');
  const input = opts.input || process.stdin;
  const output = opts.output || process.stdout;
  const rl = readline.createInterface({ input, output, terminal: false });

  const buffered = [];
  const waiters = [];
  let closed = false;
  rl.on('line', (line) => {
    if (waiters.length > 0) waiters.shift()(line);
    else buffered.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length > 0) waiters.shift()('');
  });

  return {
    ask(q) {
      output.write(q);
      return new Promise((resolve) => {
        if (buffered.length > 0) return resolve(buffered.shift());
        if (closed) return resolve('');
        waiters.push(resolve);
      });
    },
    write(line) { output.write(line + '\n'); },
    close() { rl.close(); }
  };
}

module.exports = { buildQuestInteractive, readlineIO };
