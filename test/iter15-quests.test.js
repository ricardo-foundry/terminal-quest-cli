'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadQuestFile, loadQuests, validateQuest, evaluateQuest } = require('../src/quests');

const ROOT = path.join(__dirname, '..', 'quests');

const NEW_QUESTS = ['cyber-bazaar', 'forgotten-archive', 'orbital-station'];

for (const id of NEW_QUESTS) {
  test(`iter-15: ${id} quest validates`, () => {
    const file = path.join(ROOT, id, 'quest.json');
    const { quest, errors } = loadQuestFile(file);
    assert.ok(quest, `expected ${id} to load: ${errors.join(', ')}`);
    assert.equal(quest.id, id);
    assert.equal(quest.schemaVersion, 1);
    const v = validateQuest(quest);
    assert.equal(v.ok, true, v.errors.join('\n'));
  });
}

test('iter-15: every new quest uses at least one of season/affinity/hasItem', () => {
  for (const id of NEW_QUESTS) {
    const { quest } = loadQuestFile(path.join(ROOT, id, 'quest.json'));
    const triggerTypes = new Set();
    for (const step of quest.steps) {
      for (const tr of step.triggers) triggerTypes.add(tr.type);
    }
    const hasNewTrigger =
      triggerTypes.has('season') ||
      triggerTypes.has('affinity') ||
      triggerTypes.has('hasItem');
    assert.ok(hasNewTrigger, `${id} missing season/affinity/hasItem trigger`);
  }
});

test('iter-15: every new quest has multi-branch endings', () => {
  for (const id of NEW_QUESTS) {
    const { quest } = loadQuestFile(path.join(ROOT, id, 'quest.json'));
    assert.ok(quest.branches && Object.keys(quest.branches).length >= 3,
      `${id} should have 3+ branches`);
    // exactly one default branch
    const defaults = Object.values(quest.branches).filter((b) => b && b.default);
    assert.equal(defaults.length, 1, `${id} should have exactly one default branch`);
  }
});

test('iter-15: loadQuests picks up all three new quests', () => {
  const { quests } = loadQuests();
  const ids = quests.map((q) => q.id);
  for (const id of NEW_QUESTS) {
    assert.ok(ids.includes(id), `loadQuests missing ${id}, got: ${ids.join(',')}`);
  }
});

test('iter-15: cyber-bazaar gates on summer season', () => {
  const { quest } = loadQuestFile(path.join(ROOT, 'cyber-bazaar', 'quest.json'));
  // turn 0 = spring -> bazaar incomplete
  const spring = evaluateQuest(quest, { turn: 0 });
  assert.equal(spring.done, false);
  // confirm at least one step requires season=summer
  const hasSummerGate = quest.steps.some((s) =>
    s.triggers.some((t) => t.type === 'season' && t.season === 'summer')
  );
  assert.ok(hasSummerGate);
});

test('iter-15: orbital-station endgame requires hasItem chain', () => {
  const { quest } = loadQuestFile(path.join(ROOT, 'orbital-station', 'quest.json'));
  const items = quest.steps
    .flatMap((s) => s.triggers)
    .filter((t) => t.type === 'hasItem')
    .map((t) => t.item);
  // it should require items earned from the other two new quests, chaining them
  assert.ok(items.includes('bazaar-pass'));
  assert.ok(items.includes('archive-stamp'));
});
