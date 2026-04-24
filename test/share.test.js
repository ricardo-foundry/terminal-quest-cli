'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-share-'));
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

const shareMod = require('../src/share');
const { TerminalGame } = require('../src/game');

test('formatDuration: seconds, minutes, hours', () => {
  assert.equal(shareMod.formatDuration(5000), '5s');
  assert.equal(shareMod.formatDuration(90 * 1000), '1m 30s');
  assert.equal(shareMod.formatDuration(3600 * 1000 + 60 * 1000), '1h 1m');
});

test('describeAlignment maps properly', () => {
  assert.ok(shareMod.describeAlignment(5).includes('Kind'));
  assert.ok(shareMod.describeAlignment(-5).includes('Ruthless'));
  assert.ok(shareMod.describeAlignment(0).includes('Neutral'));
});

test('buildCard contains handle, level, repo link', () => {
  const card = shareMod.buildCard({
    handle: 'ricardo',
    level: 4,
    title: 'Code Wizard',
    exp: 777,
    playtimeMs: 90_000,
    achievementsUnlocked: 5,
    achievementsTotal: 30,
    dirsVisited: 12,
    gamesPlayed: 3,
    alignment: 3,
    signature: 'hello'
  });
  assert.ok(card.includes('ricardo'));
  assert.ok(card.includes('Lv.4'));
  assert.ok(card.includes('Code Wizard'));
  assert.ok(card.includes(shareMod.REPO_URL));
  assert.ok(card.includes('TERMINAL QUEST'));
});

test('buildCard has no ANSI escape sequences', () => {
  const card = shareMod.buildCard({
    handle: 'u', level: 1, title: '', exp: 0, playtimeMs: 0,
    achievementsUnlocked: 0, achievementsTotal: 1,
    dirsVisited: 0, gamesPlayed: 0, alignment: 0, signature: 'x'
  });
  // eslint-disable-next-line no-control-regex
  assert.ok(!/\[/.test(card));
});

test('generate writes a card file and bumps shareCount', () => {
  const g = new TerminalGame({ slot: 'share-' + Date.now() });
  g.gameState.level = 2;
  g.gameState.exp = 150;
  const before = g.gameState.shareCount || 0;
  const out = shareMod.generate(g, { handle: 'tester' });
  assert.ok(fs.existsSync(out.file), 'file exists');
  const body = fs.readFileSync(out.file, 'utf8');
  assert.ok(body.includes('tester'));
  assert.ok(body.includes('Lv.2'));
  assert.equal(g.gameState.shareCount, before + 1);
});

test('collectStats uses running game state', () => {
  const g = new TerminalGame({ slot: 'share-stats-' + Date.now() });
  g.gameState.level = 3;
  g.gameState.exp = 420;
  g.gameState.visitedDirs = ['/a', '/b'];
  g.gameState.alignment = -2;
  const s = shareMod.collectStats(g, { handle: 'abc' });
  assert.equal(s.handle, 'abc');
  assert.equal(s.level, 3);
  assert.equal(s.exp, 420);
  assert.equal(s.dirsVisited, 2);
  assert.equal(s.alignment, -2);
});
