'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate the save dir for these tests.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-lb-'));
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

const saveMod = require('../src/save');
const lb = require('../src/leaderboard');

function seedSlot(slot, state) {
  saveMod.save(slot, {
    level: 1,
    exp: 0,
    achievements: [],
    questsState: {},
    questPackDone: 0,
    inventory: [],
    visitedDirs: [],
    npcAffinity: {},
    localesUsed: ['en'],
    startTime: Date.now() - 5 * 60 * 1000,
    ...state
  });
}

test('collectEntries returns one entry per saved slot', () => {
  seedSlot('alice', { level: 5, exp: 200, achievements: ['a', 'b'], questPackDone: 2 });
  seedSlot('bob',   { level: 3, exp: 80,  achievements: ['a'],      questPackDone: 1 });
  const entries = lb.collectEntries();
  const names = entries.map((e) => e.slot).sort();
  assert.ok(names.includes('alice'));
  assert.ok(names.includes('bob'));
});

test('topN sorts descending by score', () => {
  // alice has more EXP and achievements -> higher score
  const top = lb.topN(10);
  assert.ok(top.length >= 2);
  // Find alice and bob — assert alice ranks above bob.
  const idxA = top.findIndex((e) => e.slot === 'alice');
  const idxB = top.findIndex((e) => e.slot === 'bob');
  assert.ok(idxA < idxB, 'alice should rank above bob');
});

test('topN respects size cap (default 10, max 50)', () => {
  // seed 12 slots
  for (let i = 0; i < 12; i++) {
    seedSlot('dummy-' + i, { level: 1, exp: i });
  }
  const def = lb.topN();
  assert.equal(def.length, 10);
  const wide = lb.topN(50);
  assert.ok(wide.length >= 12);
});

test('exportText -> importText round trip', () => {
  const text = lb.exportText();
  assert.ok(text.includes('TERMINAL-QUEST LEADERBOARD'));
  assert.ok(text.includes('LBE '));
  const r = lb.importText(text);
  assert.equal(r.ok, true);
  assert.ok(r.imported >= 2);
  assert.equal(r.skipped, 0);
});

test('importText is tolerant of surrounding chatter', () => {
  const text = `hey check out my run\n\n${lb.exportText()}\n\nthoughts?`;
  const r = lb.importText(text);
  assert.equal(r.ok, true);
  assert.ok(r.imported >= 1);
});

test('importText rejects empty input', () => {
  assert.equal(lb.importText('').ok, false);
  assert.equal(lb.importText(null).ok, false);
});

test('fmtPlaytime formats hours/minutes/seconds', () => {
  assert.equal(lb.fmtPlaytime(45 * 1000), '45s');
  assert.equal(lb.fmtPlaytime(125 * 1000), '2m 05s');
  assert.equal(lb.fmtPlaytime(3 * 3600 * 1000 + 4 * 60 * 1000), '3h 04m');
});
