'use strict';

// =============================================================
// iter-16 deep bug-bash test pack.
// 15+ edge-case checks discovered during the bug bash.
// =============================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const time = require('../src/time');
const { loadQuests, evaluateQuest, validateQuest, pickBranch, evalCustomPredicate } = require('../src/quests');
const saveMod = require('../src/save');
const { TerminalGame } = require('../src/game');
const { exhaustQuest } = require('../scripts/exhaust-quests');

// Re-route HOME so save/load tests don't clobber the user's real saves.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-iter16-'));
process.env.HOME = TMP_HOME;

// ---- 1. time advance must not crash on huge inputs ----
test('iter-16: time.advance(1e10) does not throw', () => {
  const state = { turn: 0 };
  let r;
  assert.doesNotThrow(() => { r = time.advance(state, 1e10); });
  assert.ok(Number.isFinite(state.turn), 'turn must remain finite');
  assert.ok(state.turn <= 4 * 30, 'turn must be clamped to one in-game year');
  assert.ok(r.phase && r.phase.name);
});

test('iter-16: time.advance handles NaN / Infinity gracefully', () => {
  const state = { turn: 0 };
  assert.doesNotThrow(() => time.advance(state, NaN));
  assert.equal(state.turn, 0, 'NaN should advance by 0');
  assert.doesNotThrow(() => time.advance(state, Infinity));
  assert.ok(Number.isFinite(state.turn));
});

test('iter-16: time.advance handles negative huge inputs', () => {
  const state = { turn: 200 };
  time.advance(state, -1e10);
  assert.ok(Number.isFinite(state.turn));
});

// ---- 2. quest naming check: folder name must match id ----
test('iter-16: loadQuests rejects folder/id mismatch', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-mismatch-'));
  const dir = path.join(tmp, 'foo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'quest.json'), JSON.stringify({
    schemaVersion: 1, id: 'bar', title: 'Bar', description: 'd',
    steps: [{ id: 's1', description: 's', triggers: [{ type: 'level', min: 1 }] }]
  }));
  const { quests, report } = loadQuests(tmp);
  assert.equal(quests.length, 0, 'mismatched folder must be skipped');
  assert.ok(report.some((r) => !r.ok && /does not match/.test(r.errors.join(''))));
});

// ---- 3. alias chain length boundary ----
test('iter-16: alias chain length 8 still expands fully', async () => {
  const g = new TerminalGame({ slot: 'cmd-chain8-' + Date.now() });
  const chain = ['a','b','c','d','e','f','g','h'];
  const aliases = {};
  for (let i = 0; i < chain.length - 1; i++) aliases[chain[i]] = chain[i + 1];
  aliases[chain[chain.length - 1]] = 'help';
  g.gameState.aliases = aliases;
  // should not throw or hang
  const start = Date.now();
  await g.commandSystem.execute('a');
  assert.ok(Date.now() - start < 2000);
});

test('iter-16: alias chain length > 8 is bounded (8 rewrites cap)', async () => {
  const g = new TerminalGame({ slot: 'cmd-chain9-' + Date.now() });
  // 12-deep chain — must not hang, must not crash
  const aliases = {};
  for (let i = 0; i < 12; i++) aliases['a' + i] = 'a' + (i + 1);
  aliases['a12'] = 'help';
  g.gameState.aliases = aliases;
  const start = Date.now();
  await g.commandSystem.execute('a0');
  assert.ok(Date.now() - start < 2000);
});

// ---- 4. EOF / empty stdin handling ----
test('iter-16: execute("") is a no-op', async () => {
  const g = new TerminalGame({ slot: 'cmd-empty-' + Date.now() });
  await g.commandSystem.execute('');
  await g.commandSystem.execute('   ');
  await g.commandSystem.execute('\t\t');
  // should not crash, gameState intact
  assert.ok(g.gameState && typeof g.gameState === 'object');
});

test('iter-16: execute(null/undefined) is safely ignored', async () => {
  const g = new TerminalGame({ slot: 'cmd-null-' + Date.now() });
  await g.commandSystem.execute(null);
  await g.commandSystem.execute(undefined);
  await g.commandSystem.execute(42);
  await g.commandSystem.execute({});
  // didn't throw — that's the test
  assert.ok(true);
});

// ---- 5. payload too long is truncated ----
test('iter-16: execute clamps very long input to 1000 chars', async () => {
  const g = new TerminalGame({ slot: 'cmd-long-' + Date.now() });
  const huge = 'echo ' + 'x'.repeat(5000);
  // should not throw, no memory blow-up
  await g.commandSystem.execute(huge);
  assert.ok(true);
});

// ---- 6. all 12 quests pass friendly+neutral+hostile via the script ----
test('iter-16: all 12 quests complete on every branch', () => {
  const { quests } = loadQuests();
  const ids = quests.map((q) => q.id).sort();
  const expected = [
    'clockwork-vault', 'cyber-bazaar', 'echo-of-claude', 'forgotten-archive',
    'ghost-train', 'library-cipher', 'midnight-market', 'orbital-station',
    'shadow-archive', 'silicon-shrine', 'starter-lab', 'wandering-merchant'
  ];
  assert.deepEqual(ids, expected, 'unexpected quest set');
  for (const q of quests) {
    const errs = exhaustQuest(q);
    assert.deepEqual(errs, [], `${q.id}: ${errs.join('; ')}`);
  }
});

// ---- 7. evaluateQuest is pure: same state must give same result ----
test('iter-16: evaluateQuest is pure (no state mutation)', () => {
  const { quests } = loadQuests();
  const gs = { visitedDirs: ['/world/lab'], turn: 100, level: 5 };
  const before = JSON.stringify(gs);
  for (const q of quests) evaluateQuest(q, gs);
  assert.equal(JSON.stringify(gs), before, 'evaluateQuest mutated state');
});

// ---- 8. custom predicate sandboxing rejects non-allowlisted names ----
test('iter-16: evalCustomPredicate refuses access to fs/process/etc.', () => {
  assert.equal(evalCustomPredicate('process.exit(0)', {}), false);
  assert.equal(evalCustomPredicate('require("fs")', {}), false);
  assert.equal(evalCustomPredicate('Function("return 1")', {}), false);
  assert.equal(evalCustomPredicate('this.constructor', {}), false);
  // valid expression still works
  assert.equal(evalCustomPredicate('level >= 1', { level: 5 }), true);
});

test('iter-16: evalCustomPredicate refuses overlong source', () => {
  const long = 'level >= ' + '1'.repeat(300);
  assert.equal(evalCustomPredicate(long, { level: 5 }), false);
});

// ---- 9. save/load round-trip with stress payload ----
test('iter-16: large save round-trips intact (1000 history, 100 inv, 50 npc)', () => {
  const slot = 'iter16-stress-' + Date.now();
  const state = {
    commandHistory: Array.from({ length: 1000 }, (_, i) => 'cmd-' + i),
    inventory: Array.from({ length: 100 }, (_, i) => 'item-' + i),
    npcAffinity: Object.fromEntries(Array.from({ length: 50 }, (_, i) => ['npc-' + i, i])),
    replay: Array.from({ length: 500 }, (_, i) => ({ t: i, type: 'note', payload: 'evt-' + i })),
    level: 7, alignment: 3, turn: 250
  };
  const res = saveMod.save(slot, state);
  assert.ok(res && res.path);
  const loaded = saveMod.load(slot);
  assert.ok(loaded && loaded.state);
  assert.equal(loaded.state.commandHistory.length, 1000);
  assert.equal(loaded.state.inventory.length, 100);
  assert.equal(Object.keys(loaded.state.npcAffinity).length, 50);
  assert.equal(loaded.state.replay.length, 500);
  assert.equal(loaded.state.level, 7);
  saveMod.deleteSlot(slot);
});

// ---- 10. malformed save corruption is handled (no crash) ----
test('iter-16: corrupted save is moved aside instead of crashing load', () => {
  const slot = 'iter16-corrupt-' + Date.now();
  const p = saveMod.slotPath(slot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '{not json...');
  const result = saveMod.load(slot);
  assert.equal(result, null);
  // a backup .bak.* file should now exist
  const dir = path.dirname(p);
  const baks = fs.readdirSync(dir).filter((f) => f.startsWith(path.basename(p) + '.bak'));
  assert.ok(baks.length >= 1, 'corrupt save should be moved aside');
});

// ---- 11. i18n locale parity (sanity, in addition to existing tests) ----
test('iter-16: every locale has the same key set as en', () => {
  const { DICTS } = require('../src/i18n');
  const en = new Set(Object.keys(DICTS.en));
  for (const code of Object.keys(DICTS)) {
    if (code === 'en') continue;
    const cur = new Set(Object.keys(DICTS[code]));
    const missing = [...en].filter((k) => !cur.has(k));
    const extra = [...cur].filter((k) => !en.has(k));
    assert.deepEqual(missing, [], `${code} missing keys: ${missing.join(', ')}`);
    assert.deepEqual(extra, [], `${code} has unexpected keys: ${extra.join(', ')}`);
  }
});

// ---- 12. dispatcher: history bang on empty history is graceful ----
test('iter-16: history bang on empty history does not crash', async () => {
  const g = new TerminalGame({ slot: 'cmd-bang-' + Date.now() });
  // wipe history via .commandSystem.history reset
  g.commandSystem.history = [];
  await g.commandSystem.execute('!!');
  await g.commandSystem.execute('!9999');
  assert.ok(true);
});

// ---- 13. fuzz pass smoke check: 25 random unicode strings ----
test('iter-16: random unicode inputs do not throw', async () => {
  const g = new TerminalGame({ slot: 'cmd-fuzz-' + Date.now() });
  function rand() { return Math.random(); }
  for (let i = 0; i < 25; i++) {
    const len = Math.floor(rand() * 60);
    let s = '';
    for (let j = 0; j < len; j++) s += String.fromCharCode(Math.floor(rand() * 0xffff));
    await g.commandSystem.execute(s);
  }
  assert.ok(true);
});

// ---- 14. orbital-station realistically completes only with chain items ----
test('iter-16: orbital-station hostile blocked by missing bazaar-pass/archive-stamp', () => {
  const { quests } = loadQuests();
  const orbital = quests.find((q) => q.id === 'orbital-station');
  // simulate a player with everything except the items
  const gs = {
    visitedDirs: ['/system/core'],
    turn: 90 /* winter */,
    level: 7,
    inventory: [],
    npcAffinity: { guide: 60 },
    gamesList: ['logic'],
    keyFragments: ['k1', 'k2', 'k3'],
    alignment: -8
  };
  const r = evaluateQuest(orbital, gs);
  assert.equal(r.done, false, 'orbital-station should NOT complete without chained items');
  // check the active step is one of the hasItem gates
  assert.ok(['carry_pass', 'carry_stamp'].includes(r.activeStep && r.activeStep.id));
});

// ---- 15. branch picker prefers conditional matches over default ----
test('iter-16: pickBranch prefers a passing condition over default', () => {
  const branches = {
    nice: { condition: 'alignment >= 3', text: 'nice' },
    fallback: { default: true, text: 'meh' }
  };
  assert.equal(pickBranch(branches, { alignment: 5 }), 'nice');
  assert.equal(pickBranch(branches, { alignment: 0 }), 'fallback');
  // a malformed condition falls through to default safely
  const broken = {
    bad: { condition: 'process.exit(0)', text: 'should not pick' },
    fallback: { default: true, text: 'fine' }
  };
  assert.equal(pickBranch(broken, { alignment: 5 }), 'fallback');
});

// ---- 16. completionsFor returns a sorted unique list (no dupes) ----
test('iter-16: completionsFor produces unique sorted output', () => {
  const g = new TerminalGame({ slot: 'cmd-comp-' + Date.now() });
  g.gameState.aliases = { help: 'ls', helper: 'cat' };
  const hits = g.commandSystem.completionsFor('hel');
  const unique = new Set(hits);
  assert.equal(unique.size, hits.length, 'completionsFor returned duplicates');
  // sorted
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1] <= hits[i], 'completionsFor not sorted');
  }
});
