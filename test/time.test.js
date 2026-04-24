'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-time-'));
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

const timeMod = require('../src/time');
const { TerminalGame } = require('../src/game');

test('getPhase maps turn ranges to the right phase', () => {
  assert.equal(timeMod.getPhase(0).name, 'dawn');
  assert.equal(timeMod.getPhase(5).name, 'dawn');
  assert.equal(timeMod.getPhase(6).name, 'day');
  assert.equal(timeMod.getPhase(12).name, 'dusk');
  assert.equal(timeMod.getPhase(18).name, 'night');
  assert.equal(timeMod.getPhase(23).name, 'night');
});

test('normalizeTurn wraps correctly at 24', () => {
  assert.equal(timeMod.normalizeTurn(24), 0);
  assert.equal(timeMod.normalizeTurn(25), 1);
  assert.equal(timeMod.normalizeTurn(-1), 23);
});

test('advance records phases crossed', () => {
  const state = { turn: 5 };
  const res = timeMod.advance(state, 4); // 5 -> 9 crosses dawn -> day
  assert.equal(res.turn, 9);
  assert.equal(res.phase.name, 'day');
  assert.ok(res.newPhases.some((p) => p.name === 'day'));
});

test('advance with 0 returns no phase change', () => {
  const state = { turn: 5 };
  const res = timeMod.advance(state, 0);
  assert.equal(res.turn, 5);
  assert.deepEqual(res.newPhases, []);
});

test('accessRule locks lab at night', () => {
  const night = timeMod.getPhase(20);
  const r = timeMod.accessRule('/world/lab', night);
  assert.equal(r.allowed, false);
});

test('accessRule locks archive during day', () => {
  const day = timeMod.getPhase(10);
  const r = timeMod.accessRule('/shadow/archive', day);
  assert.equal(r.allowed, false);
});

test('game.advanceTime records visited phases', () => {
  const g = new TerminalGame({ slot: 'time-' + Date.now() });
  g.gameState.turn = 5;
  g.gameState.phasesSeen = ['dawn'];
  g.advanceTime(2); // 5 -> 7 crosses into day
  assert.ok(g.gameState.phasesSeen.includes('day'));
});

test('game.getNpcMood follows alignment thresholds', () => {
  const g = new TerminalGame({ slot: 'mood-' + Date.now() });
  g.gameState.alignment = 4;
  assert.equal(g.getNpcMood(), 'friendly');
  g.gameState.alignment = 0;
  assert.equal(g.getNpcMood(), 'neutral');
  g.gameState.alignment = -4;
  assert.equal(g.getNpcMood(), 'hostile');
});

test('adjustAlignment clamps between -10 and +10', () => {
  const g = new TerminalGame({ slot: 'align-' + Date.now() });
  g.gameState.alignment = 0;
  g.adjustAlignment(100);
  assert.equal(g.gameState.alignment, 10);
  g.adjustAlignment(-999);
  assert.equal(g.gameState.alignment, -10);
});

test('formatClock produces a 5-char HH:00 string', () => {
  const s = timeMod.formatClock(7);
  assert.match(s, /^\d\d:00$/);
});
