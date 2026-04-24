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
