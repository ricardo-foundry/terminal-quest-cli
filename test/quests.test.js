'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  QUEST_SCHEMA_VERSION,
  validateQuest,
  loadQuestFile,
  loadQuests,
  reloadQuests,
  matchTrigger,
  isStepComplete,
  evaluateQuest,
  evalCustomPredicate,
  pickBranch
} = require('../src/quests');

const VALID = {
  schemaVersion: 1,
  id: 'demo',
  title: 'Demo',
  description: 'stub',
  steps: [
    { id: 'step1', description: 'go home', triggers: [ { type: 'visitDir', path: '/home/user' } ] }
  ],
  rewards: { exp: 10 },
  branches: { neutral: { default: true, text: 'ok' } }
};

test('validateQuest accepts a minimal valid quest', () => {
  const r = validateQuest(VALID);
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('validateQuest rejects missing id', () => {
  const r = validateQuest({ ...VALID, id: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /id/.test(e)));
});

test('validateQuest rejects wrong schemaVersion', () => {
  const r = validateQuest({ ...VALID, schemaVersion: 99 });
  assert.equal(r.ok, false);
});

test('validateQuest rejects duplicate step ids', () => {
  const dup = {
    ...VALID,
    steps: [
      { id: 's', description: 'a', triggers: [{ type: 'visitDir', path: '/a' }] },
      { id: 's', description: 'b', triggers: [{ type: 'visitDir', path: '/b' }] }
    ]
  };
  const r = validateQuest(dup);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /duplicate/.test(e)));
});

test('validateQuest rejects unknown trigger types', () => {
  const r = validateQuest({
    ...VALID,
    steps: [{ id: 'x', description: 'x', triggers: [{ type: 'nope' }] }]
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /unknown type/.test(e)));
});

test('validateQuest rejects empty steps array', () => {
  const r = validateQuest({ ...VALID, steps: [] });
  assert.equal(r.ok, false);
});

test('matchTrigger handles visitDir / visitFile / keyFragments', () => {
  const gs = { visitedDirs: ['/a'], visitedFiles: ['/a/f'], keyFragments: ['a','b','c'] };
  assert.equal(matchTrigger({ type: 'visitDir',  path: '/a' }, gs), true);
  assert.equal(matchTrigger({ type: 'visitDir',  path: '/b' }, gs), false);
  assert.equal(matchTrigger({ type: 'visitFile', path: '/a/f' }, gs), true);
  assert.equal(matchTrigger({ type: 'keyFragments', min: 3 }, gs), true);
  assert.equal(matchTrigger({ type: 'keyFragments', min: 4 }, gs), false);
});

test('matchTrigger: level / alignment', () => {
  assert.equal(matchTrigger({ type: 'level', min: 3 }, { level: 4 }), true);
  assert.equal(matchTrigger({ type: 'level', min: 3 }, { level: 2 }), false);
  assert.equal(matchTrigger({ type: 'alignment', min: -2, max: 2 }, { alignment: 0 }), true);
  assert.equal(matchTrigger({ type: 'alignment', min: 3 }, { alignment: 1 }), false);
});

test('matchTrigger: gamePlayed / achievementUnlocked / decodeFile', () => {
  const gs = {
    gamesList: ['snake', 'chess'],
    achievements: ['first_step'],
    decodedFiles: ['/shadow/archive/cipher.enc']
  };
  assert.equal(matchTrigger({ type: 'gamePlayed', name: 'chess' }, gs), true);
  assert.equal(matchTrigger({ type: 'achievementUnlocked', id: 'first_step' }, gs), true);
  assert.equal(matchTrigger({ type: 'decodeFile', file: 'cipher.enc' }, gs), true);
  assert.equal(matchTrigger({ type: 'decodeFile', file: 'missing.enc' }, gs), false);
});

test('evalCustomPredicate: allows safe arithmetic, blocks identifiers outside whitelist', () => {
  const gs = { level: 5, alignment: 3, keyFragments: ['a'] };
  assert.equal(evalCustomPredicate('level >= 5', gs), true);
  assert.equal(evalCustomPredicate('level >= 5 && alignment > 0', gs), true);
  assert.equal(evalCustomPredicate('keyFragments >= 1', gs), true);
  // disallowed identifier should return false, not throw
  assert.equal(evalCustomPredicate('process.exit(1)', gs), false);
  // non-strings never match
  assert.equal(evalCustomPredicate(null, gs), false);
});

test('isStepComplete requires every trigger to match', () => {
  const step = { id: 's', description: 'x', triggers: [
    { type: 'level', min: 3 },
    { type: 'visitDir', path: '/home/user' }
  ] };
  assert.equal(isStepComplete(step, { level: 3, visitedDirs: ['/home/user'] }), true);
  assert.equal(isStepComplete(step, { level: 3, visitedDirs: [] }), false);
});

test('evaluateQuest reports progress and picks first matching branch', () => {
  const q = {
    schemaVersion: 1, id: 'q', title: 't',
    steps: [
      { id: 's1', description: 'a', triggers: [{ type: 'level', min: 1 }] },
      { id: 's2', description: 'b', triggers: [{ type: 'level', min: 2 }] }
    ],
    branches: {
      good: { condition: 'alignment >= 3', text: 'G' },
      neutral: { default: true, text: 'N' }
    }
  };
  const lowAlign = evaluateQuest(q, { level: 2, alignment: 0 });
  assert.equal(lowAlign.done, true);
  assert.equal(lowAlign.completed, 2);
  assert.equal(lowAlign.currentBranch, 'neutral');

  const highAlign = evaluateQuest(q, { level: 2, alignment: 5 });
  assert.equal(highAlign.currentBranch, 'good');

  const partial = evaluateQuest(q, { level: 1 });
  assert.equal(partial.done, false);
  assert.equal(partial.completed, 1);
  assert.ok(partial.activeStep);
});

test('loadQuestFile: returns errors for malformed json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-quest-bad-'));
  const file = path.join(dir, 'quest.json');
  fs.writeFileSync(file, '{ not: json');
  const { quest, errors } = loadQuestFile(file);
  assert.equal(quest, null);
  assert.ok(errors.length > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadQuests: loads the two official quests from ./quests', () => {
  const { quests } = loadQuests();
  const ids = quests.map((q) => q.id).sort();
  assert.ok(ids.includes('starter-lab'), 'starter-lab missing: ' + ids.join(','));
  assert.ok(ids.includes('shadow-archive'), 'shadow-archive missing: ' + ids.join(','));
  for (const q of quests) {
    assert.equal(q.schemaVersion, QUEST_SCHEMA_VERSION);
    assert.ok(q.steps.length >= 1);
  }
});

test('loadQuests: skips folder whose id does not match folder name', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-quest-mismatch-'));
  const inner = path.join(tmp, 'expected-name');
  fs.mkdirSync(inner);
  fs.writeFileSync(path.join(inner, 'quest.json'), JSON.stringify({
    ...VALID,
    id: 'different-name'
  }));
  const { quests, report } = loadQuests(tmp);
  assert.equal(quests.length, 0);
  assert.ok(report.some((r) => !r.ok && r.errors.some((e) => /does not match/.test(e))));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadQuests on a missing dir returns empty quests + report entry', () => {
  const { quests, report } = loadQuests('/path/does/not/exist/for/tq');
  assert.equal(quests.length, 0);
  assert.equal(report.length, 1);
  assert.equal(report[0].ok, false);
});

test('reloadQuests is an alias and behaves identically', () => {
  const a = loadQuests();
  const b = reloadQuests();
  assert.deepEqual(a.quests.map((q) => q.id).sort(),
                   b.quests.map((q) => q.id).sort());
});

test('reloadQuests picks up newly added quest folders (hot-reload)', () => {
  // v2.5: --dev hot-reload depends on a fresh scan returning the latest
  // contents of the quests directory. We simulate the workflow against a
  // tmp dir to avoid touching the real ./quests pack.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-hotreload-'));
  try {
    // First scan: empty directory.
    const empty = reloadQuests(tmp);
    assert.equal(empty.quests.length, 0);

    // Drop a new quest in.
    const qid = 'fresh-quest';
    fs.mkdirSync(path.join(tmp, qid));
    fs.writeFileSync(
      path.join(tmp, qid, 'quest.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: qid,
        title: 'Fresh',
        description: 'added at runtime',
        steps: [
          { id: 'a', description: 'go', triggers: [{ type: 'level', min: 1 }] }
        ]
      })
    );

    // Re-scan returns the new quest.
    const after = reloadQuests(tmp);
    assert.equal(after.quests.length, 1);
    assert.equal(after.quests[0].id, qid);

    // Mutate the quest file - title change must be reflected on next reload.
    fs.writeFileSync(
      path.join(tmp, qid, 'quest.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: qid,
        title: 'Edited',
        description: 'updated',
        steps: [
          { id: 'a', description: 'go', triggers: [{ type: 'level', min: 1 }] }
        ]
      })
    );
    const edited = reloadQuests(tmp);
    assert.equal(edited.quests[0].title, 'Edited');

    // Removing the file makes the next reload drop the quest.
    fs.rmSync(path.join(tmp, qid), { recursive: true, force: true });
    const removed = reloadQuests(tmp);
    assert.equal(removed.quests.length, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('pickBranch chooses the first condition that matches, else default', () => {
  const branches = {
    kind: { condition: 'alignment >= 3', text: 'k' },
    mean: { condition: 'alignment <= -3', text: 'm' },
    neutral: { default: true, text: 'n' }
  };
  assert.equal(pickBranch(branches, { alignment: 5 }), 'kind');
  assert.equal(pickBranch(branches, { alignment: -5 }), 'mean');
  assert.equal(pickBranch(branches, { alignment: 0 }), 'neutral');
});

test('starter-lab quest has the expected structure', () => {
  const { quests } = loadQuests();
  const starter = quests.find((q) => q.id === 'starter-lab');
  assert.ok(starter);
  assert.equal(starter.schemaVersion, 1);
  assert.ok(Array.isArray(starter.steps));
  assert.ok(starter.steps.length >= 3);
  assert.ok(starter.rewards && typeof starter.rewards.exp === 'number');
});

test('shadow-archive quest uses a custom predicate step', () => {
  const { quests } = loadQuests();
  const q = quests.find((x) => x.id === 'shadow-archive');
  assert.ok(q);
  const custom = q.steps.find((s) => s.triggers.some((tr) => tr.type === 'custom'));
  assert.ok(custom, 'expected a custom-predicate step');
});

// ---- DX: --list-quests and --validate-quest ----
const { execSync } = require('node:child_process');
const BIN = path.join(__dirname, '..', 'bin', 'terminal-quest.js');

test('--list-quests CLI prints both official quests and exits 0', () => {
  const out = execSync(`node "${BIN}" --list-quests`, { encoding: 'utf8' });
  assert.ok(out.includes('[starter-lab]'));
  assert.ok(out.includes('[shadow-archive]'));
});

test('--validate-quest on a known-good file exits 0', () => {
  const good = path.join(__dirname, '..', 'quests', 'starter-lab', 'quest.json');
  const out = execSync(`node "${BIN}" --validate-quest "${good}"`, { encoding: 'utf8' });
  assert.ok(out.startsWith('ok'));
});

// ---- iter-12: new triggers ----
test('matchTrigger: season trigger with a single string', () => {
  // 0 turns = spring
  assert.equal(matchTrigger({ type: 'season', season: 'spring' }, { turn: 0 }), true);
  assert.equal(matchTrigger({ type: 'season', season: 'winter' }, { turn: 0 }), false);
});

test('matchTrigger: season trigger accepts an array', () => {
  assert.equal(matchTrigger({ type: 'season', season: ['summer', 'autumn'] }, { turn: 35 }), true);
  assert.equal(matchTrigger({ type: 'season', season: ['summer', 'autumn'] }, { turn: 95 }), false);
});

test('matchTrigger: affinity threshold', () => {
  const gs = { npcAffinity: { keeper: 30 } };
  assert.equal(matchTrigger({ type: 'affinity', npc: 'keeper', min: 20 }, gs), true);
  assert.equal(matchTrigger({ type: 'affinity', npc: 'keeper', min: 50 }, gs), false);
  // unknown npc defaults to 0
  assert.equal(matchTrigger({ type: 'affinity', npc: 'who', min: 1 }, gs), false);
});

test('matchTrigger: hasItem checks inventory', () => {
  const gs = { inventory: ['lab-badge', 'morse-card'] };
  assert.equal(matchTrigger({ type: 'hasItem', item: 'lab-badge' }, gs), true);
  assert.equal(matchTrigger({ type: 'hasItem', item: 'unknown' }, gs), false);
});

test('iter-12 quests load successfully', () => {
  const { quests } = loadQuests();
  const ids = quests.map((q) => q.id);
  assert.ok(ids.includes('clockwork-vault'));
  assert.ok(ids.includes('silicon-shrine'));
  assert.ok(ids.includes('wandering-merchant'));
});

test('--validate-quest on a malformed file exits non-zero', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-val-bad-'));
  const bad = path.join(tmp, 'quest.json');
  fs.writeFileSync(bad, '{ bad');
  let threw = false;
  try {
    execSync(`node "${BIN}" --validate-quest "${bad}"`, { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    threw = true;
    assert.ok(e.status !== 0);
  }
  assert.ok(threw, 'expected process to fail on malformed quest json');
  fs.rmSync(tmp, { recursive: true, force: true });
});
