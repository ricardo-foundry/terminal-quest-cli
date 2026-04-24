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

// ---- Round 5: corruption + schema + size ----

test('load() quarantines a corrupted json file and returns null', () => {
  const p = saveMod.slotPath('broken');
  fs.writeFileSync(p, '{ this is not json ');
  const loaded = saveMod.load('broken');
  assert.equal(loaded, null);
  // the broken file should have been moved aside
  assert.ok(!fs.existsSync(p));
  const siblings = fs.readdirSync(saveMod.SAVE_DIR);
  assert.ok(siblings.some((f) => f.startsWith('broken.json.bak.')));
});

test('load() rejects envelope missing schema+state (treated as v1 wrap)', () => {
  // A plain object without schemaVersion is treated as v1 — migrate
  // wraps it. Ensure that is still valid (schema forward-fill).
  const p = saveMod.slotPath('v1-style');
  fs.writeFileSync(p, JSON.stringify({ level: 9, exp: 42 }));
  const loaded = saveMod.load('v1-style');
  assert.ok(loaded);
  assert.equal(loaded.schemaVersion, saveMod.SCHEMA_VERSION);
  assert.equal(loaded.state.level, 9);
});

test('isValidSave: schema validation is strict', () => {
  assert.equal(saveMod.isValidSave(null), false);
  assert.equal(saveMod.isValidSave('abc'), false);
  assert.equal(saveMod.isValidSave({}), false);
  assert.equal(saveMod.isValidSave({ schemaVersion: 2 }), false);
  assert.equal(saveMod.isValidSave({ schemaVersion: 2, state: null }), false);
  assert.equal(saveMod.isValidSave({ schemaVersion: 2, state: {} }), true);
});

test('save() returns warn string when payload > 1 MiB', () => {
  // build a very large state blob
  const huge = { stuff: 'x'.repeat(1024 * 1024 + 500) };
  const res = saveMod.save('huge-slot', huge);
  assert.ok(res);
  assert.ok(res.bytes > saveMod.MAX_SAVE_BYTES);
  assert.ok(res.warn && res.warn.includes('KiB'));
});

test('save() returns no warn under the limit', () => {
  const res = saveMod.save('tiny-slot', { level: 1 });
  assert.equal(res.warn, null);
});

test('exportSlot returns null for missing slot, JSON string otherwise', () => {
  assert.equal(saveMod.exportSlot('ghost-slot'), null);
  saveMod.save('exp-test', { level: 2 });
  const txt = saveMod.exportSlot('exp-test');
  assert.ok(typeof txt === 'string');
  const parsed = JSON.parse(txt);
  assert.equal(parsed.state.level, 2);
});

test('importSlot rejects oversize blobs outright', () => {
  const way_too_big = 'x'.repeat(saveMod.MAX_SAVE_BYTES * 4 + 1);
  assert.equal(saveMod.importSlot('huge', way_too_big), null);
});

test('migrate() bumps schema version on older envelopes', () => {
  const p = saveMod.slotPath('oldver');
  fs.writeFileSync(p, JSON.stringify({
    schemaVersion: 1,
    slot: 'oldver',
    savedAt: 1,
    state: { level: 3 }
  }));
  const loaded = saveMod.load('oldver');
  assert.equal(loaded.schemaVersion, saveMod.SCHEMA_VERSION);
  assert.equal(loaded.state.level, 3);
});

test('deleteSlot removes file, returns false on missing', () => {
  saveMod.save('dmtest', { level: 1 });
  assert.equal(saveMod.deleteSlot('dmtest'), true);
  assert.equal(saveMod.deleteSlot('dmtest'), false);
});

// ---- v2.5: --new keeps a .bak copy alongside the timestamped archive ----
test('--new archives the slot AND leaves a .bak so an oops is recoverable', () => {
  const { execSync } = require('node:child_process');
  const BIN = path.join(__dirname, '..', 'bin', 'terminal-quest.js');
  // Seed a slot in the temp HOME so the bin sees it.
  const slot = 'newbaktest';
  saveMod.save(slot, { level: 9, exp: 9999 });
  const slotFile = saveMod.slotPath(slot);
  assert.ok(fs.existsSync(slotFile));

  // Ask the bin to wipe + restart; pipe a quick "exit" so the REPL closes.
  const env = { ...process.env, HOME: TMP_HOME, USERPROFILE: TMP_HOME };
  try {
    execSync(`echo "exit" | node "${BIN}" --slot ${slot} --new --no-boot --no-color`, {
      env, stdio: ['pipe', 'pipe', 'pipe'], timeout: 8000
    });
  } catch (_) {
    // Ignore: the bin may exit non-zero from EPIPE/SIGPIPE on some platforms.
  }
  // The .bak copy should exist; the original .json may have been recreated
  // by the launching session, but the archived-* file must also be present.
  assert.ok(fs.existsSync(slotFile + '.bak'),
    `expected ${slotFile}.bak to exist after --new`);
  const dirEntries = fs.readdirSync(saveMod.SAVE_DIR);
  assert.ok(dirEntries.some((f) => f.startsWith(slot + '.json.archived-')),
    'expected an .archived-* sibling');
});
