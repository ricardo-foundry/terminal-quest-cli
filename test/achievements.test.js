'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-ach-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const origWrite = process.stdout.write.bind(process.stdout);
before(() => {
  process.stdout.write = () => true;
  console.log = () => {};
});
after(() => {
  process.stdout.write = origWrite;
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

const { EXTRA_ACHIEVEMENTS, evaluateAutoUnlocks, groupByCategory } = require('../src/achievements');
const { TerminalGame } = require('../src/game');

test('EXTRA_ACHIEVEMENTS defines at least 15 entries', () => {
  const n = Object.keys(EXTRA_ACHIEVEMENTS).length;
  assert.ok(n >= 15, `expected >=15, got ${n}`);
});

test('every extra achievement has id/name/desc/check', () => {
  for (const [id, ach] of Object.entries(EXTRA_ACHIEVEMENTS)) {
    assert.equal(ach.id, id, `${id} must self-id`);
    assert.ok(ach.name, `${id} needs name`);
    assert.ok(ach.desc, `${id} needs desc`);
    assert.equal(typeof ach.check, 'function', `${id} needs check()`);
    assert.ok(ach.category, `${id} needs category`);
  }
});

test('evaluateAutoUnlocks triggers hoarder at >=8 items', () => {
  const fresh = JSON.parse(JSON.stringify(EXTRA_ACHIEVEMENTS));
  // re-attach checks (stripped by JSON clone)
  for (const id of Object.keys(fresh)) fresh[id].check = EXTRA_ACHIEVEMENTS[id].check;
  const ids = evaluateAutoUnlocks(fresh, { inventory: ['a','b','c','d','e','f','g','h'] });
  assert.ok(ids.includes('hoarder'));
});

test('evaluateAutoUnlocks: good_soul needs +5 alignment', () => {
  const fresh = { ...EXTRA_ACHIEVEMENTS };
  const ids4 = evaluateAutoUnlocks(fresh, { alignment: 4 });
  assert.ok(!ids4.includes('good_soul'));
  const ids5 = evaluateAutoUnlocks(fresh, { alignment: 5 });
  assert.ok(ids5.includes('good_soul'));
});

test('evaluateAutoUnlocks: cold_heart triggers at <=-5', () => {
  const ids = evaluateAutoUnlocks(EXTRA_ACHIEVEMENTS, { alignment: -5 });
  assert.ok(ids.includes('cold_heart'));
});

test('groupByCategory returns a non-empty exploration bucket', () => {
  const g = groupByCategory(EXTRA_ACHIEVEMENTS);
  assert.ok(Array.isArray(g.exploration));
  assert.ok(g.exploration.length >= 1);
});

test('game integrates extras with legacy achievements', () => {
  const g = new TerminalGame({ slot: 'ach-int-' + Date.now() });
  // must contain one legacy + one extra at minimum
  assert.ok(g.achievements.first_step, 'legacy first_step present');
  assert.ok(g.achievements.night_owl, 'extra night_owl present');
  assert.equal(typeof g.achievements.night_owl.check, 'function');
});

test('unlocking an extra achievement persists across instances', async () => {
  const slot = 'ach-persist-' + Date.now();
  const g1 = new TerminalGame({ slot });
  await g1.unlockAchievement('night_owl');
  assert.ok(g1.achievements.night_owl.unlocked);
  g1.saveGameState();
  const g2 = new TerminalGame({ slot });
  assert.ok(g2.achievements.night_owl.unlocked, 'reloaded as unlocked');
});

// ---- v2.4: five new achievements ----
test('v2.4 adds completionist/speedrunner/historian/pacifist/collector', () => {
  const ids = Object.keys(EXTRA_ACHIEVEMENTS);
  assert.ok(ids.includes('completionist_v24'));
  assert.ok(ids.includes('speedrunner_v24'));
  assert.ok(ids.includes('historian_v24'));
  assert.ok(ids.includes('pacifist'));
  assert.ok(ids.includes('collector_v24'));
});

test('completionist_v24 fires when every community quest is done', () => {
  const ids = evaluateAutoUnlocks(EXTRA_ACHIEVEMENTS, {
    questPackTotal: 2,
    questPackDone: 2
  });
  assert.ok(ids.includes('completionist_v24'));
});

test('historian_v24 needs both new scenes visited', () => {
  const half = evaluateAutoUnlocks(EXTRA_ACHIEVEMENTS, {
    visitedDirs: ['/library']
  });
  assert.ok(!half.includes('historian_v24'));
  const both = evaluateAutoUnlocks(EXTRA_ACHIEVEMENTS, {
    visitedDirs: ['/library', '/station']
  });
  assert.ok(both.includes('historian_v24'));
});

test('pacifist requires master unlocked AND minAlignment >= 0', () => {
  const nope = evaluateAutoUnlocks(EXTRA_ACHIEVEMENTS, {
    masterUnlocked: true,
    minAlignment: -1
  });
  assert.ok(!nope.includes('pacifist'));
  const yes = evaluateAutoUnlocks(EXTRA_ACHIEVEMENTS, {
    masterUnlocked: true,
    minAlignment: 0
  });
  assert.ok(yes.includes('pacifist'));
});

test('collector_v24 needs one item from each category', () => {
  const partial = evaluateAutoUnlocks(EXTRA_ACHIEVEMENTS, {
    inventory: ['key-shard-1', 'health-potion']
  });
  assert.ok(!partial.includes('collector_v24'));
  const full = evaluateAutoUnlocks(EXTRA_ACHIEVEMENTS, {
    inventory: ['key-shard-1', 'health-potion', 'torch', 'rare-stamp']
  });
  assert.ok(full.includes('collector_v24'));
});
