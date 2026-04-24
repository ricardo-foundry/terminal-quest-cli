'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// isolate save dir per test run
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-game-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

// silence stdout writes from animations / banners
const origWrite = process.stdout.write.bind(process.stdout);
before(() => {
  process.stdout.write = () => true;
  // keep console.log silent too
  console.log = () => {};
});
after(() => {
  process.stdout.write = origWrite;
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

const { TerminalGame } = require('../src/game');

test('resolves . and ~ relative paths correctly', () => {
  const g = new TerminalGame({ slot: 'unit-' + Date.now() });
  g.currentPath = '/home/user';
  assert.equal(g.normalizePath('.'), '/home/user');
  assert.equal(g.normalizePath('~'), '/home/user');
  assert.equal(g.normalizePath('~/.secret'), '/home/user/.secret');
  assert.equal(g.normalizePath('.secret'), '/home/user/.secret');
  assert.equal(g.normalizePath('../guest'), '/home/guest');
});

test('cd .. from root stays at root', () => {
  const g = new TerminalGame({ slot: 'unit-' + Date.now() });
  g.currentPath = '/';
  assert.equal(g.normalizePath('..'), '/');
});

test('resolvePath returns null for non-existent paths', () => {
  const g = new TerminalGame({ slot: 'unit-' + Date.now() });
  g.currentPath = '/home/user';
  assert.equal(g.resolvePath('/nope/does/not/exist'), null);
});

test('addExp triggers a level-up at the threshold', async () => {
  const g = new TerminalGame({ slot: 'unit-' + Date.now() });
  g.gameState.level = 1;
  g.gameState.exp = 0;
  await g.addExp(150);
  assert.equal(g.gameState.level, 2, 'should level up past 100 EXP');
});

test('unlockAchievement is idempotent', async () => {
  const g = new TerminalGame({ slot: 'unit-' + Date.now() });
  await g.unlockAchievement('first_step');
  const n1 = g.gameState.achievements.length;
  await g.unlockAchievement('first_step');
  assert.equal(g.gameState.achievements.length, n1);
});

test('checkQuests marks tutorial complete when start_here.txt is read', () => {
  const g = new TerminalGame({ slot: 'unit-' + Date.now() });
  g.gameState.visitedFiles.push('/home/user/start_here.txt');
  g.checkQuests();
  assert.equal(g.quests.tutorial.completed, true);
});

test('saved state survives a new instance', () => {
  const slot = 'persist-' + Date.now();
  const g1 = new TerminalGame({ slot });
  g1.gameState.level = 4;
  g1.gameState.exp = 777;
  g1.gameState.visitedDirs.push('/system/core');
  g1.saveGameState();
  const g2 = new TerminalGame({ slot });
  assert.equal(g2.gameState.level, 4);
  assert.equal(g2.gameState.exp, 777);
  assert.ok(g2.gameState.visitedDirs.includes('/system/core'));
});
