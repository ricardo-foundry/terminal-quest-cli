'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-xplat-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

// Silence the game while it boots in constructor paths.
const origWrite = process.stdout.write.bind(process.stdout);
const origLog = console.log;
before(() => {
  process.stdout.write = () => true;
  console.log = () => {};
});
after(() => {
  process.stdout.write = origWrite;
  console.log = origLog;
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

const saveMod = require('../src/save');
const { TerminalGame } = require('../src/game');

test('SAVE_DIR is anchored under HOME', () => {
  assert.ok(saveMod.SAVE_DIR.startsWith(TMP_HOME));
});

test('slotPath strips path traversal attempts', () => {
  const p = saveMod.slotPath('../../etc/passwd');
  assert.ok(!p.includes('..'));
  assert.ok(p.startsWith(saveMod.SAVE_DIR));
});

test('slotPath accepts unicode names after sanitisation', () => {
  // Non-[A-Za-z0-9_-] chars are replaced with `_`. The sanitised
  // name must never be empty or escape SAVE_DIR.
  const p = saveMod.slotPath('存档一号');
  assert.ok(p.startsWith(saveMod.SAVE_DIR));
  assert.ok(p.endsWith('.json'));
});

test('normalizePath collapses .. and . in virtual FS', () => {
  const g = new TerminalGame({ slot: 'xp-norm-' + Date.now() });
  g.currentPath = '/home/user';
  assert.equal(g.normalizePath('./a/../b'), '/home/user/b');
  assert.equal(g.normalizePath('../..'), '/');
  assert.equal(g.normalizePath('/abs/path'), '/abs/path');
});

test('normalizePath coerces windows backslashes', () => {
  const g = new TerminalGame({ slot: 'xp-slash-' + Date.now() });
  g.currentPath = '/home/user';
  assert.equal(g.normalizePath('a\\b'), '/home/user/a/b');
});

test('normalizePath handles ~ expansion', () => {
  const g = new TerminalGame({ slot: 'xp-tilde-' + Date.now() });
  assert.equal(g.normalizePath('~'), '/home/user');
  assert.equal(g.normalizePath('~/diary.txt'), '/home/user/diary.txt');
});

test('virtual FS paths are posix regardless of host os', () => {
  const g = new TerminalGame({ slot: 'xp-posix-' + Date.now() });
  g.currentPath = '/home/user';
  const n = g.normalizePath('sub');
  assert.ok(!n.includes('\\'));
  assert.ok(n.startsWith('/'));
});

test('exportSlot round-trips with importSlot', () => {
  saveMod.save('exp-src', { level: 7, exp: 999, inventory: ['torch'] });
  const json = saveMod.exportSlot('exp-src');
  assert.ok(json && json.length > 0);
  const res = saveMod.importSlot('exp-dst', json);
  assert.ok(res);
  const loaded = saveMod.load('exp-dst');
  assert.equal(loaded.state.level, 7);
  assert.equal(loaded.state.exp, 999);
});

test('importSlot rejects malformed JSON', () => {
  assert.equal(saveMod.importSlot('bad', '{not json'), null);
  assert.equal(saveMod.importSlot('bad', ''), null);
  assert.equal(saveMod.importSlot('bad', null), null);
});

test('importSlot rejects envelope missing state', () => {
  const bogus = JSON.stringify({ schemaVersion: 2 });
  assert.equal(saveMod.importSlot('bad', bogus), null);
});
