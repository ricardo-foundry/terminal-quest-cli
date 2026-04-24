'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// redirect HOME before requiring save module
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-test-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const saveMod = require('../src/save');

before(() => {
  // make sure we use the temp dir
  assert.ok(saveMod.SAVE_DIR.startsWith(TMP_HOME));
});

after(() => {
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

test('save + load round-trip', () => {
  const state = { level: 3, exp: 321, visitedDirs: ['/home/user'] };
  saveMod.save('slot-a', state);
  const loaded = saveMod.load('slot-a');
  assert.equal(loaded.slot, 'slot-a');
  assert.equal(loaded.schemaVersion, saveMod.SCHEMA_VERSION);
  assert.deepEqual(loaded.state.visitedDirs, ['/home/user']);
  assert.equal(loaded.state.level, 3);
});

test('missing slot returns null', () => {
  assert.equal(saveMod.load('does-not-exist'), null);
});

test('listSlots returns slots sorted by savedAt desc', async () => {
  saveMod.save('older', { level: 1, exp: 0 });
  // small delay to ensure distinct mtime
  await new Promise((r) => setTimeout(r, 10));
  saveMod.save('newer', { level: 2, exp: 10 });
  const slots = saveMod.listSlots().map((s) => s.slot);
  assert.ok(slots.includes('older'));
  assert.ok(slots.includes('newer'));
  // newer must come first
  assert.ok(slots.indexOf('newer') < slots.indexOf('older'));
});

test('invalid slot names are sanitised', () => {
  const p = saveMod.slotPath('../../etc/passwd');
  assert.ok(!p.includes('..'));
  assert.ok(p.startsWith(saveMod.SAVE_DIR));
});

test('migrates legacy single-file save', () => {
  // wipe saves/ so migration path is exercised
  fs.rmSync(saveMod.SAVE_DIR, { recursive: true, force: true });
  const legacy = path.join(TMP_HOME, '.terminal-quest-save.json');
  fs.writeFileSync(legacy, JSON.stringify({ level: 4, exp: 600 }));
  const loaded = saveMod.load('default');
  assert.ok(loaded);
  assert.equal(loaded.state.level, 4);
  assert.equal(loaded.state.exp, 600);
  assert.equal(loaded.schemaVersion, saveMod.SCHEMA_VERSION);
});
