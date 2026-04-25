'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// isolate save dir for game-backed command tests
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-cmd-'));
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

const { tokenize } = require('../src/commands');
const { TerminalGame } = require('../src/game');

test('tokenize: simple command', () => {
  assert.deepEqual(tokenize('ls -a /home/user'), ['ls', '-a', '/home/user']);
});

test('tokenize: collapses whitespace', () => {
  assert.deepEqual(tokenize('  ls    -a   '), ['ls', '-a']);
});

test('tokenize: double-quoted argument with spaces', () => {
  assert.deepEqual(tokenize('echo "hello world"'), ['echo', 'hello world']);
});

test('tokenize: single quotes', () => {
  assert.deepEqual(tokenize("grep 'needle in hay' file.txt"), ['grep', 'needle in hay', 'file.txt']);
});

test('tokenize: escape inside unquoted word', () => {
  assert.deepEqual(tokenize('echo a\\ b'), ['echo', 'a b']);
});

test('tokenize: empty input yields empty list', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize('   '), []);
});

test('tokenize: tabs are separators', () => {
  assert.deepEqual(tokenize('ls\t-a\thome'), ['ls', '-a', 'home']);
});

// ---- v2.1: aliases / history / completion ----
test('alias expansion: ll resolves to ls -la', async () => {
  const g = new TerminalGame({ slot: 'cmd-alias-' + Date.now() });
  // seed an inspectable ls dir
  g.currentPath = '/home/user';
  g.gameState.aliases = { ll: 'ls -la' };
  await g.commandSystem.execute('ll');
  // visited dir recorded -> means ls ran
  assert.ok(g.gameState.visitedDirs.includes('/home/user'));
});

test('!! repeats the last command', async () => {
  const g = new TerminalGame({ slot: 'cmd-bang-' + Date.now() });
  g.currentPath = '/home/user';
  await g.commandSystem.execute('pwd');
  const sess1 = g.gameState.sessionCommands;
  await g.commandSystem.execute('!!');
  assert.equal(g.gameState.sessionCommands, sess1 + 1);
});

test('!<n> runs the n-th history entry', async () => {
  const g = new TerminalGame({ slot: 'cmd-bangN-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) });
  await g.commandSystem.execute('pwd');    // 1
  await g.commandSystem.execute('status'); // 2
  // v2.5 (iter-10): the persisted history may now contain entries seeded
  // from a previous TerminalGame instance with the same slot (we restore
  // history across sessions). Snapshot just our own commands here.
  const ownStart = g.commandSystem.history.length - 2;
  await g.commandSystem.execute('!' + (ownStart + 1));
  const tail = g.gameState.commandHistory[g.gameState.commandHistory.length - 1];
  assert.equal(tail, 'pwd');
});

test('commandHistory is capped at 50 entries', async () => {
  const g = new TerminalGame({ slot: 'cmd-hist-' + Date.now() });
  for (let i = 0; i < 60; i++) await g.commandSystem.execute('pwd');
  assert.ok(g.gameState.commandHistory.length <= 50);
});

test('completionsFor: known command prefix', () => {
  const g = new TerminalGame({ slot: 'cmd-comp-' + Date.now() });
  const hits = g.commandSystem.completionsFor('stat');
  assert.ok(hits.includes('status'));
});

test('completionsFor: includes aliases', () => {
  const g = new TerminalGame({ slot: 'cmd-compA-' + Date.now() });
  g.gameState.aliases = { ...g.gameState.aliases, zzfoo: 'status' };
  const hits = g.commandSystem.completionsFor('zz');
  assert.ok(hits.includes('zzfoo'));
});

test('completionsFor: includes children of current dir', () => {
  const g = new TerminalGame({ slot: 'cmd-compD-' + Date.now() });
  g.currentPath = '/home/user';
  const hits = g.commandSystem.completionsFor('rea'); // readme.txt
  assert.ok(hits.some((h) => h.startsWith('readme')));
});

test('alias add via cmdAlias persists key', () => {
  const g = new TerminalGame({ slot: 'cmd-addA-' + Date.now() });
  g.commandSystem.cmdAlias(['myls=ls', '-a']);
  // alias value joins remaining args
  assert.equal(g.gameState.aliases.myls, 'ls -a');
});

test('unalias removes an alias', () => {
  const g = new TerminalGame({ slot: 'cmd-unA-' + Date.now() });
  g.gameState.aliases = { foo: 'bar' };
  g.commandSystem.cmdUnalias(['foo']);
  assert.equal(g.gameState.aliases.foo, undefined);
});

// ---- Round 5: input hardening ----

test('execute: null bytes are stripped from input', async () => {
  const g = new TerminalGame({ slot: 'cmd-nul-' + Date.now() });
  // should not throw, should effectively run pwd
  await g.commandSystem.execute('p\x00w\x00d');
  assert.ok(g.gameState.sessionCommands >= 1);
});

test('execute: oversize input is truncated to 1000 chars', async () => {
  const g = new TerminalGame({ slot: 'cmd-huge-' + Date.now() });
  const huge = 'echo ' + 'a'.repeat(5000);
  await g.commandSystem.execute(huge);
  // the recorded entry must not exceed the truncation cap
  const last = g.gameState.commandHistory[g.gameState.commandHistory.length - 1];
  assert.ok(last.length <= 1000);
});

test('execute: empty and whitespace-only input is a no-op', async () => {
  const g = new TerminalGame({ slot: 'cmd-empty-' + Date.now() });
  const before = g.gameState.sessionCommands || 0;
  await g.commandSystem.execute('');
  await g.commandSystem.execute('   ');
  await g.commandSystem.execute('\t\t');
  assert.equal(g.gameState.sessionCommands || 0, before);
});

test('execute: alias cycle a->b->a does not infinite-loop', async () => {
  const g = new TerminalGame({ slot: 'cmd-cycle-' + Date.now() });
  g.gameState.aliases = { aaa: 'bbb', bbb: 'aaa' };
  // If the cycle guard fails this test will hang forever under node:test.
  const start = Date.now();
  await g.commandSystem.execute('aaa');
  assert.ok(Date.now() - start < 2000);
});

test('grep: pathological pattern does not crash or hang', async () => {
  const g = new TerminalGame({ slot: 'cmd-redos-' + Date.now() });
  g.currentPath = '/home/user';
  // even if we fed `(a+)+$` into a naive regex, we now use `includes`
  // so ReDoS cannot happen. Should just say `no matches`.
  const start = Date.now();
  g.commandSystem.cmdGrep(['(a+)+$', 'readme.txt']);
  assert.ok(Date.now() - start < 500);
});

test('grep: overlong pattern is rejected', () => {
  const g = new TerminalGame({ slot: 'cmd-longpat-' + Date.now() });
  const pat = 'x'.repeat(500);
  // should not throw
  g.commandSystem.cmdGrep([pat, 'readme.txt']);
});

test('find: tolerates empty pattern', () => {
  const g = new TerminalGame({ slot: 'cmd-find-' + Date.now() });
  g.commandSystem.cmdFind([]);
  g.commandSystem.cmdFind(['']);
});

test('commandHistory trimmed in persisted state at 50', async () => {
  const g = new TerminalGame({ slot: 'cmd-trim-' + Date.now() });
  for (let i = 0; i < 80; i++) await g.commandSystem.execute('pwd');
  assert.ok(g.gameState.commandHistory.length <= 50);
});

test('tokenize handles unicode words', () => {
  const { tokenize } = require('../src/commands');
  assert.deepEqual(tokenize('talk 你好'), ['talk', '你好']);
});

// ---- v2.5 iter-10 ----
test(':theme dark works as a meta-prefixed command', async () => {
  const g = new TerminalGame({ slot: 'cmd-meta-' + Date.now() });
  await g.commandSystem.execute(':theme dark');
  assert.equal(g.gameState.theme, 'dark');
});

test(':help is identical to help', async () => {
  const g = new TerminalGame({ slot: 'cmd-metahelp-' + Date.now() });
  const before = g.gameState.helpCount || 0;
  await g.commandSystem.execute(':help');
  assert.equal(g.gameState.helpCount, before + 1);
});

test('history seeds from persisted commandHistory across sessions', async () => {
  const slot = 'cmd-seed-' + Date.now();
  const g1 = new TerminalGame({ slot });
  await g1.commandSystem.execute('pwd');
  await g1.commandSystem.execute('status');
  g1.saveGameState();
  // simulate fresh launch with same slot
  const g2 = new TerminalGame({ slot });
  // history should be seeded with the prior commands
  assert.ok(g2.commandSystem.history.length >= 2);
  assert.ok(g2.commandSystem.history.includes('pwd'));
  assert.ok(g2.commandSystem.history.includes('status'));
});

test('wait warns when capped over 24 turns', async () => {
  const g = new TerminalGame({ slot: 'cmd-waitcap-' + Date.now() });
  const origWarn = console.warn;
  let warned = '';
  console.warn = (msg) => { warned += String(msg); };
  try {
    await g.commandSystem.execute('wait 9999');
  } finally {
    console.warn = origWarn;
  }
  assert.ok(/capped/i.test(warned), 'expected wait to warn about capping; got: ' + warned);
});

test('wait without big number does NOT warn', async () => {
  const g = new TerminalGame({ slot: 'cmd-waitok-' + Date.now() });
  const origWarn = console.warn;
  let warned = '';
  console.warn = (msg) => { warned += String(msg); };
  try {
    await g.commandSystem.execute('wait 5');
  } finally {
    console.warn = origWarn;
  }
  assert.ok(!/capped/i.test(warned), 'wait 5 should not warn; got: ' + warned);
});

// ---- iter-12: bookmark / goto / season / gift / cheat sheet ----

test('bookmark + bookmarks records a name -> path mapping', async () => {
  const g = new TerminalGame({ slot: 'cmd-bm-' + Date.now() });
  g.currentPath = '/home/user';
  await g.commandSystem.execute('bookmark home');
  assert.equal(g.gameState.bookmarks.home, '/home/user');
});

test('bookmark rejects invalid names', async () => {
  const slot = 'cmd-bmbad-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  const g = new TerminalGame({ slot });
  g.currentPath = '/home/user';
  // start from a known-empty state
  g.gameState.bookmarks = {};
  await g.commandSystem.execute('bookmark "has spaces"');
  // tokenize collapses to one arg; regex rejects spaces -> nothing stored
  assert.equal(Object.keys(g.gameState.bookmarks || {}).length, 0);
});

test('goto jumps to a saved bookmark and burns one turn', async () => {
  const g = new TerminalGame({ slot: 'cmd-go-' + Date.now() });
  g.currentPath = '/home/user';
  await g.commandSystem.execute('bookmark home');
  // walk somewhere else, then jump back
  await g.commandSystem.execute('cd /system');
  const turnBefore = g.gameState.turn;
  await g.commandSystem.execute('goto home');
  assert.equal(g.currentPath, '/home/user');
  assert.equal(g.gameState.turn, turnBefore + 1);
});

test('goto on unknown bookmark errors gracefully', async () => {
  const g = new TerminalGame({ slot: 'cmd-go2-' + Date.now() });
  await g.commandSystem.execute('goto missing');
  // currentPath unchanged
  assert.equal(g.currentPath, '/home/user');
});

test('? prints a cheat sheet (no error)', async () => {
  const g = new TerminalGame({ slot: 'cmd-q-' + Date.now() });
  // capture console.log output
  let buf = '';
  const orig = console.log;
  console.log = (line) => { buf += String(line) + '\n'; };
  try {
    await g.commandSystem.execute('?');
  } finally {
    console.log = orig;
  }
  assert.match(buf, /quick reference/i);
});

test('season command is callable and references current season', async () => {
  const g = new TerminalGame({ slot: 'cmd-season-' + Date.now() });
  let buf = '';
  const orig = console.log;
  console.log = (line) => { buf += String(line) + '\n'; };
  try {
    await g.commandSystem.execute('season');
  } finally {
    console.log = orig;
  }
  assert.match(buf, /Spring|Summer|Autumn|Winter/);
});

test('advanceTime crosses season boundary and records seasonsSeen', () => {
  const g = new TerminalGame({ slot: 'cmd-advseason-' + Date.now() });
  g.gameState.turn = 25;
  g.gameState.seasonsSeen = ['spring'];
  g.advanceTime(10); // crosses into summer at 30
  assert.ok(g.gameState.seasonsSeen.includes('summer'));
});

test('gift requires the npc to be present and item in inventory', async () => {
  const g = new TerminalGame({ slot: 'cmd-gift-' + Date.now() });
  g.currentPath = '/home/user';
  g.gameState.inventory = ['lab-badge'];
  // researcher is not at /home/user
  await g.commandSystem.execute('gift lab-badge to researcher');
  // affinity should still be 0
  const rel = require('../src/relationships');
  assert.equal(rel.getAffinity(g.gameState, 'researcher'), 0);
  // item NOT consumed (since gift failed)
  assert.ok(g.gameState.inventory.includes('lab-badge'));
});

test('completionsFor with talk context returns NPC names', () => {
  const g = new TerminalGame({ slot: 'cmd-ctxtalk-' + Date.now() });
  // Move to /world/nexus where the guide.npc is.
  g.gameState.level = 5;
  g.currentPath = '/world/nexus';
  const hits = g.commandSystem.completionsFor('', { verb: 'talk', argIndex: 1 });
  // hits should mention "guide" (the npc id, with .npc stripped)
  assert.ok(hits.some((h) => h.includes('guide')), 'expected guide in talk completions: ' + hits.join(','));
});

test('completionsFor with use context returns inventory items only', () => {
  const g = new TerminalGame({ slot: 'cmd-ctxuse-' + Date.now() });
  g.gameState.inventory = ['lab-badge', 'rare-stamp'];
  const hits = g.commandSystem.completionsFor('lab', { verb: 'use', argIndex: 1 });
  assert.deepEqual(hits, ['lab-badge']);
  // commands should NOT show up under context completion
  const noCmd = g.commandSystem.completionsFor('s', { verb: 'use', argIndex: 1 });
  assert.ok(!noCmd.includes('status'));
});

test('completionsFor with goto context returns bookmarks only', () => {
  const g = new TerminalGame({ slot: 'cmd-ctxgoto-' + Date.now() });
  g.gameState.bookmarks = { home: '/home/user', vault: '/world/nexus' };
  const hits = g.commandSystem.completionsFor('', { verb: 'goto', argIndex: 1 });
  assert.deepEqual(hits.sort(), ['home', 'vault']);
});
