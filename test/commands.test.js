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
  const g = new TerminalGame({ slot: 'cmd-bangN-' + Date.now() });
  await g.commandSystem.execute('pwd');    // 1
  await g.commandSystem.execute('status'); // 2
  const beforeLen = g.gameState.commandHistory.length;
  await g.commandSystem.execute('!1');
  const tail = g.gameState.commandHistory[g.gameState.commandHistory.length - 1];
  assert.equal(tail, 'pwd');
  assert.equal(g.gameState.commandHistory.length, beforeLen + 1);
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
