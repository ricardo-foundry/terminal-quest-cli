'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildQuestInteractive } = require('../src/quest-builder');
const { validateQuest } = require('../src/quests');

/**
 * Build an io stub from a list of canned answers. The `ask()` helper
 * pops one answer per call so order matches the prompt order in the
 * builder. `lines` collects every write() so tests can assert prompts
 * happened.
 */
function fakeIO(answers) {
  const remaining = answers.slice();
  const lines = [];
  return {
    ask: () => Promise.resolve(remaining.length > 0 ? remaining.shift() : ''),
    write: (s) => lines.push(s),
    lines,
    leftover: () => remaining.length
  };
}

test('buildQuestInteractive: minimal quest is valid and round-trips', async () => {
  const io = fakeIO([
    'forest-trial',           // id
    'Forest Trial',            // title
    'A walk in the woods',     // description
    'tester',                  // author
    'intro,nature',            // tags
    '1',                       // step count
    'enter_forest',            // step id
    'Enter the woods',         // step desc
    '1',                       // trigger count
    'visitDir',                // trigger type
    '/world/forest',           // path
    '50',                      // exp
    'leaf-token'               // items
  ]);
  const { quest, errors } = await buildQuestInteractive(io);
  assert.equal(errors.length, 0, errors.join(', '));
  assert.equal(quest.id, 'forest-trial');
  assert.equal(quest.title, 'Forest Trial');
  assert.equal(quest.steps.length, 1);
  assert.equal(quest.steps[0].id, 'enter_forest');
  assert.equal(quest.steps[0].triggers[0].type, 'visitDir');
  assert.equal(quest.steps[0].triggers[0].path, '/world/forest');
  assert.equal(quest.rewards.exp, 50);
  assert.deepEqual(quest.rewards.items, ['leaf-token']);
  // round-trip through the loader's validator
  const verdict = validateQuest(quest);
  assert.equal(verdict.ok, true, verdict.errors.join(', '));
});

test('buildQuestInteractive: defaults kick in for blank answers', async () => {
  const io = fakeIO([
    'tiny',          // id
    '',              // title (-> "tiny" fallback)
    '',              // description default
    '',              // author default
    '',              // tags
    '',              // step count default 1
    '',              // step id default
    '',              // step description default
    '',              // trigger count default 1
    'level',         // trigger type
    '3',             // min level
    '',              // exp default
    ''               // items
  ]);
  const { quest, errors } = await buildQuestInteractive(io);
  assert.equal(errors.length, 0, errors.join(', '));
  assert.equal(quest.title, 'tiny'); // falls back to id
  assert.equal(quest.steps[0].triggers[0].type, 'level');
  assert.equal(quest.steps[0].triggers[0].min, 3);
  assert.equal(quest.rewards.exp, 50); // default
  assert.deepEqual(quest.rewards.items, []);
});

test('buildQuestInteractive: unknown trigger type falls back to visitDir', async () => {
  const io = fakeIO([
    'fallback', 'Fallback', 'd', 'a', '',
    '1', 's1', 'go', '1',
    'totally-bogus',  // unknown -> visitDir
    '/somewhere',
    '0', ''
  ]);
  const { quest, errors } = await buildQuestInteractive(io);
  assert.equal(errors.length, 0, errors.join(', '));
  assert.equal(quest.steps[0].triggers[0].type, 'visitDir');
});

test('buildQuestInteractive: handles all supported trigger types', async () => {
  const io = fakeIO([
    'multi', 'Multi', 'd', 'a', '',
    '5',                         // 5 steps
    // step 1: keyFragments
    's1', 'collect 2 frags', '1', 'keyFragments', '2',
    // step 2: alignment
    's2', 'be aligned', '1', 'alignment', '1', '5',
    // step 3: gamePlayed
    's3', 'play snake', '1', 'gamePlayed', 'snake',
    // step 4: achievementUnlocked
    's4', 'unlock first_step', '1', 'achievementUnlocked', 'first_step',
    // step 5: custom predicate
    's5', 'custom predicate', '1', 'custom', 'level >= 2',
    '0', ''
  ]);
  const { quest, errors } = await buildQuestInteractive(io);
  assert.equal(errors.length, 0, errors.join(', '));
  assert.equal(quest.steps[0].triggers[0].min, 2);
  assert.equal(quest.steps[1].triggers[0].min, 1);
  assert.equal(quest.steps[1].triggers[0].max, 5);
  assert.equal(quest.steps[2].triggers[0].name, 'snake');
  assert.equal(quest.steps[3].triggers[0].id, 'first_step');
  assert.equal(quest.steps[4].triggers[0].predicate, 'level >= 2');
});

// ---- CLI smoke test ----
const { execSync } = require('node:child_process');
const BIN = path.join(__dirname, '..', 'bin', 'terminal-quest.js');

test('--validate-quest=new --interactive writes JSON to stdout', () => {
  // Twelve newlines covers id/title/desc/author/tags/stepcount/stepid/
  // stepdesc/trigcount/type/path/exp/items
  const stdin =
    'cli-test\n' +
    'CLI Test\n' +
    '\n' +    // description default
    '\n' +    // author default
    '\n' +    // tags
    '1\n' +
    'go\n' +
    'go places\n' +
    '1\n' +
    'visitDir\n' +
    '/home/user\n' +
    '\n' +    // exp default 50
    '\n';     // items default
  const out = execSync(`node "${BIN}" --validate-quest=new --interactive`, {
    input: stdin,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  // last JSON document on stdout — strip prompt echoes
  const jsonStart = out.indexOf('{');
  const jsonEnd = out.lastIndexOf('}');
  assert.ok(jsonStart >= 0 && jsonEnd > jsonStart, 'no JSON in output: ' + out);
  const parsed = JSON.parse(out.slice(jsonStart, jsonEnd + 1));
  assert.equal(parsed.id, 'cli-test');
  assert.equal(parsed.title, 'CLI Test');
  assert.equal(parsed.steps.length, 1);
  // round-trip through loader validator
  assert.equal(validateQuest(parsed).ok, true);
});

test('--validate-quest <existing> --interactive refuses to clobber', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-builder-'));
  const target = path.join(tmp, 'quest.json');
  fs.writeFileSync(target, '{}');
  let threw = false;
  try {
    execSync(`node "${BIN}" --validate-quest "${target}" --interactive`, {
      input: '\n'.repeat(20),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (e) {
    threw = true;
    assert.notEqual(e.status, 0);
    assert.ok(/refusing to overwrite/i.test((e.stderr || '').toString()));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  assert.ok(threw, 'expected non-zero exit on existing target');
});
