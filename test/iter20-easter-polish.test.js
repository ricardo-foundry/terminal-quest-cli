'use strict';

// =============================================================
// iter-20 — easter egg + polish coverage.
// 5 tests:
//   1. echo-of-claude quest validates and discovers
//   2. echo-of-claude branches by alignment (3-way)
//   3. ghost_in_the_machine achievement unlocks on quest completion
//   4. credits roll content includes Ricardo + Claude Code + ASCII art
//   5. cmdHelp output sections are alphabetised
// =============================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  loadQuestFile, loadQuests, evaluateQuest, pickBranch, validateQuest
} = require('../src/quests');
const { EXTRA_ACHIEVEMENTS, evaluateAutoUnlocks } = require('../src/achievements');
const { creditsLines, rollCredits } = require('../src/credits');
const { HELP_TEXT } = require('../src/ui');

const ROOT = path.join(__dirname, '..', 'quests');

// ---- 1. quest validates and is discovered by loadQuests ----
test('iter-20: echo-of-claude quest validates and loads', () => {
  const file = path.join(ROOT, 'echo-of-claude', 'quest.json');
  const { quest, errors } = loadQuestFile(file);
  assert.ok(quest, `quest failed to load: ${errors.join('; ')}`);
  assert.equal(quest.id, 'echo-of-claude');
  const v = validateQuest(quest);
  assert.equal(v.ok, true, v.errors.join('\n'));
  // discovered by loadQuests too
  const { quests } = loadQuests();
  assert.ok(quests.some((q) => q.id === 'echo-of-claude'),
    'echo-of-claude must show up in the loaded pack');
});

// ---- 2. quest has a 3-branch ending keyed off alignment ----
test('iter-20: echo-of-claude has merge / dismiss / thanks branches', () => {
  const { quest } = loadQuestFile(path.join(ROOT, 'echo-of-claude', 'quest.json'));
  assert.ok(quest.branches);
  const names = Object.keys(quest.branches);
  assert.deepEqual(names.sort(), ['dismiss', 'merge', 'thanks']);
  // exactly one default
  const defaults = Object.values(quest.branches).filter((b) => b && b.default);
  assert.equal(defaults.length, 1);

  // build a state that satisfies every step
  const baseState = {
    visitedDirs: ['/var/log/sessions'],
    visitedFiles: [
      '/var/log/sessions/ghost.log',
      '/var/log/sessions/ghost.npc'
    ],
    decodedFiles: [], inventory: [], gamesList: [], achievements: [],
    keyFragments: [], npcAffinity: {}, level: 1, exp: 0, turn: 0, alignment: 0
  };

  // friendly path -> merge
  const friendly = { ...baseState, alignment: 8 };
  const f = evaluateQuest(quest, friendly);
  assert.equal(f.done, true);
  assert.equal(pickBranch(quest.branches, friendly), 'merge');

  // hostile path -> dismiss
  const hostile = { ...baseState, alignment: -8 };
  assert.equal(evaluateQuest(quest, hostile).done, true);
  assert.equal(pickBranch(quest.branches, hostile), 'dismiss');

  // neutral path -> default thanks
  const neutral = { ...baseState, alignment: 0 };
  assert.equal(evaluateQuest(quest, neutral).done, true);
  assert.equal(pickBranch(quest.branches, neutral), 'thanks');
});

// ---- 3. hidden achievement fires on quest completion ----
test('iter-20: ghost_in_the_machine unlocks on echo-of-claude done', () => {
  const ach = EXTRA_ACHIEVEMENTS.ghost_in_the_machine;
  assert.ok(ach, 'ghost_in_the_machine must exist');
  assert.equal(ach.hidden, true, 'achievement must be hidden by default');
  assert.equal(ach.category, 'hidden');

  // not yet completed -> no unlock
  const before = evaluateAutoUnlocks(
    { ghost_in_the_machine: { ...ach, unlocked: false } },
    { communityQuestState: {} }
  );
  assert.ok(!before.includes('ghost_in_the_machine'));

  // completed -> unlock
  const after = evaluateAutoUnlocks(
    { ghost_in_the_machine: { ...ach, unlocked: false } },
    { communityQuestState: { 'echo-of-claude': { done: true, branch: 'merge' } } }
  );
  assert.ok(after.includes('ghost_in_the_machine'),
    'completing echo-of-claude should unlock ghost_in_the_machine');
});

// ---- 4. credits roll ----
test('iter-20: credits roll lists Ricardo + Claude Code + ASCII art', async () => {
  const lines = creditsLines();
  assert.ok(Array.isArray(lines));
  assert.ok(lines.length >= 20, 'credits should have substantial body');
  const blob = lines.join('\n');
  assert.ok(/Ricardo/.test(blob), 'Ricardo missing from credits');
  assert.ok(/Claude Code/.test(blob), 'Claude Code missing from credits');
  assert.ok(/benevolent assistant/.test(blob),
    'flavour line "benevolent assistant" missing');
  // ASCII art proxy: at least one line of pure ASCII box / underscore /
  // bracket characters, with no high-codepoint glyphs.
  const hasArt = lines.some((l) =>
    /[_\\\/\[\]|]/.test(l) && /^[\x20-\x7e]*$/.test(l)
  );
  assert.ok(hasArt, 'expected an ASCII art line');

  // rollCredits with fast=true must finish synchronously and return line count
  const captured = [];
  const n = await rollCredits({ fast: true, write: (s) => captured.push(s) });
  assert.equal(n, lines.length);
  assert.equal(captured.length, lines.length);
});

// ---- 5. cmdHelp sections are alphabetised ----
test('iter-20: cmdHelp sections list commands alphabetically', () => {
  // For each section, extract the verb tokens (first word per line) and
  // assert they're alphabetised. We strip ANSI colour codes AND the
  // theme-specific decorator prefixes (e.g. retro theme prepends ">> ")
  // so the assertion works regardless of which theme is active.
  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const verbsOf = (text) => {
    const lines = stripAnsi(text).split('\n');
    const verbs = [];
    for (const line of lines) {
      // strip leading whitespace + any decorator-ish prefix, then grab the
      // first run of [a-z0-9?] characters as the verb.
      const m = line.match(/^[\s>*\-]+([a-zA-Z0-9?]+)/);
      if (m) verbs.push(m[1]);
    }
    return verbs;
  };

  for (const sec of ['basic', 'advanced', 'rpg', 'meta']) {
    const verbs = verbsOf(HELP_TEXT[sec]());
    assert.ok(verbs.length >= 3,
      `${sec} section should list verbs, got: ${verbs.join(',')}`);
    const sorted = [...verbs].sort();
    assert.deepEqual(verbs, sorted,
      `${sec} verbs not sorted: ${verbs.join(',')} vs ${sorted.join(',')}`);
  }
});
