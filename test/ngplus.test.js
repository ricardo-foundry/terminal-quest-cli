'use strict';

// Tests for the v2.9 (iter-19) New Game+ rollover and idle/AFK timer.
//
// These tests are pure-state; no readline / no real timers fire because
// createIdleTimer is fed a fake `now()` and `schedule()` shim. The NG+
// flow re-uses TerminalGame to verify save-load round-trips include the
// new fields and that NPC dialogue picks up the `ngPlus` flag.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate $HOME so we don't trample real saves.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-ngplus-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

// Silence any banners game.js prints during construction.
const origLog = console.log;
const origWrite = process.stdout.write.bind(process.stdout);
before(() => {
  process.stdout.write = () => true;
  console.log = () => {};
});
after(() => {
  process.stdout.write = origWrite;
  console.log = origLog;
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

const ngplusMod = require('../src/ngplus');
const saveMod = require('../src/save');
const { DEFAULT_STATE, TerminalGame } = require('../src/game');
const { EXTRA_ACHIEVEMENTS } = require('../src/achievements');

// 1.
test('ngplus: hasUnlockedNgPlus accepts masterUnlocked, quest, or legacy ach', () => {
  assert.equal(ngplusMod.hasUnlockedNgPlus({}), false);
  assert.equal(ngplusMod.hasUnlockedNgPlus({ masterUnlocked: true }), true);
  assert.equal(
    ngplusMod.hasUnlockedNgPlus({ questsState: { unlock_master: { completed: true } } }),
    true
  );
  assert.equal(
    ngplusMod.hasUnlockedNgPlus({ achievements: ['unlock_master'] }),
    true
  );
});

// 2.
test('ngplus: buildNgPlusState carries achievements/affinity/totals and resets world', () => {
  const prev = {
    ...DEFAULT_STATE,
    achievements: ['first_step', 'recurring_soul'],
    achievementsState: { first_step: { unlocked: true }, recurring_soul: { unlocked: true } },
    npcAffinity: { shop: 80, guide: 40 },
    npcTalkCount: { shop: 12 },
    localesUsed: ['en', 'zh'],
    inventory: ['torch', 'health-potion'],
    visitedDirs: ['/home/user', '/world/nexus'],
    sessionCommands: 25,
    playtimeMs: 60_000,
    masterUnlocked: true,
    communityQuestState: { 'cyber-bazaar': { done: true, branch: 'broker_friend' } },
    ngCount: 1
  };
  const next = ngplusMod.buildNgPlusState(prev, { ...DEFAULT_STATE });
  // Carry-overs:
  assert.deepEqual(next.achievements, ['first_step', 'recurring_soul']);
  assert.deepEqual(next.npcAffinity, { shop: 80, guide: 40 });
  assert.equal(next.npcTalkCount.shop, 12);
  assert.deepEqual(next.localesUsed, ['en', 'zh']);
  assert.equal(next.totalCommands, 25);
  assert.equal(next.totalPlaytimeMs, 60_000);
  assert.equal(next.ngCount, 2, 'ngCount should increment');
  assert.equal(next.ngPlus, true);
  // Resets:
  assert.deepEqual(next.inventory, []);
  assert.deepEqual(next.visitedDirs, ['/home/user']);
  assert.equal(next.masterUnlocked, false);
  // unlockedQuestIds picked up from communityQuestState
  assert.ok(next.unlockedQuestIds.includes('cyber-bazaar'));
});

// 3.
test('ngplus: ngGreeting decorates only when ngPlus flag is set', () => {
  assert.equal(ngplusMod.ngGreeting('Hello there', { ngPlus: false }), 'Hello there');
  assert.equal(ngplusMod.ngGreeting('Hello there', null), 'Hello there');
  const out = ngplusMod.ngGreeting('Hello there', { ngPlus: true, ngCount: 1 });
  assert.match(out, /Welcome back, traveler\.\.\./);
  assert.match(out, /Hello there$/);
  const out3 = ngplusMod.ngGreeting('Hi', { ngPlus: true, ngCount: 4 });
  assert.match(out3, /cycle 4/);
});

// 4.
test('ngplus: idle timer fires soft + hard with mocked clock (no real timers)', () => {
  let nowVal = 0;
  let soft = 0;
  let hard = 0;
  const timer = ngplusMod.createIdleTimer({
    softMs: 1000,
    hardMs: 3000,
    now: () => nowVal,
    schedule: () => null, // do not arm real timers
    cancel: () => {},
    onSoft: () => { soft++; },
    onHard: () => { hard++; }
  });
  timer.bump();          // lastActivity = 0
  nowVal = 500;
  timer.notify();
  assert.equal(soft, 0, 'should not fire below softMs');
  nowVal = 1500;
  timer.notify();
  assert.equal(soft, 1, 'soft should fire after 1500ms');
  assert.equal(hard, 0);
  nowVal = 3500;
  timer.notify();
  assert.equal(hard, 1, 'hard should fire after 3500ms');
  // bumping resets fired flags; checking again right after bump should NOT
  // fire (only 0ms elapsed since lastActivity was just updated to 3500).
  timer.bump();             // lastActivity = 3500
  nowVal = 4000;            // 500ms elapsed -- still under softMs (1000)
  timer.notify();
  assert.equal(soft, 1, 'after bump, no fire while elapsed < softMs');
  // Cross softMs again -> fires a second time.
  nowVal = 4600;            // 1100ms elapsed
  timer.notify();
  assert.equal(soft, 2, 'soft re-fires after a fresh bump cycle');
});

// 5.
test('ngplus: idle each callback only fires once until next bump', () => {
  let nowVal = 0;
  let soft = 0;
  const timer = ngplusMod.createIdleTimer({
    softMs: 100,
    hardMs: 200,
    now: () => nowVal,
    schedule: () => null,
    cancel: () => {},
    onSoft: () => { soft++; }
  });
  timer.bump();
  nowVal = 150;
  timer.notify();
  timer.notify();
  timer.notify();
  assert.equal(soft, 1, 'soft should only have fired once');
});

// 6.
test('ngplus: 5 NG+ achievements exist and have ngplus category', () => {
  const ids = ['recurring_soul', 'echo_of_past', 'second_dawn', 'ouroboros', 'mentor_to_self'];
  for (const id of ids) {
    assert.ok(EXTRA_ACHIEVEMENTS[id], `missing ${id}`);
    assert.equal(EXTRA_ACHIEVEMENTS[id].category, 'ngplus');
    assert.equal(typeof EXTRA_ACHIEVEMENTS[id].check, 'function');
  }
});

// 7.
test('ngplus: recurring_soul check fires only when ngPlus is true', () => {
  const a = EXTRA_ACHIEVEMENTS.recurring_soul;
  assert.equal(a.check({}), false);
  assert.equal(a.check({ ngPlus: true }), true);
});

// 8.
test('ngplus: ouroboros requires ngCount >= 3', () => {
  const a = EXTRA_ACHIEVEMENTS.ouroboros;
  assert.equal(a.check({ ngPlus: true, ngCount: 1 }), false);
  assert.equal(a.check({ ngPlus: true, ngCount: 2 }), false);
  assert.equal(a.check({ ngPlus: true, ngCount: 3 }), true);
  assert.equal(a.check({ ngPlus: false, ngCount: 5 }), false);
});

// 9.
test('ngplus: full save -> NG+ rollover -> reload retains achievements & flags', () => {
  const slot = 'ng-test-' + Date.now();
  // Seed an existing run with the milestone achievement.
  const seed = {
    ...DEFAULT_STATE,
    masterUnlocked: true,
    achievements: ['first_step'],
    achievementsState: { first_step: { unlocked: true } },
    npcAffinity: { shop: 50 },
    sessionCommands: 7,
    playtimeMs: 1234
  };
  saveMod.save(slot, seed);
  // Apply rollover.
  const payload = saveMod.load(slot);
  const next = ngplusMod.buildNgPlusState(payload.state, { ...DEFAULT_STATE });
  saveMod.save(slot, next);
  // Reload via the actual game class; its loadGameState merges defaults.
  const game = new TerminalGame({ slot, skipBoot: true });
  assert.equal(game.gameState.ngPlus, true);
  assert.equal(game.gameState.ngCount, 1);
  assert.equal(game.gameState.totalCommands, 7);
  assert.equal(game.gameState.totalPlaytimeMs, 1234);
  assert.deepEqual(game.gameState.npcAffinity, { shop: 50 });
  assert.ok(game.gameState.achievements.includes('first_step'));
  // World resets:
  assert.equal(game.gameState.masterUnlocked, false);
  assert.deepEqual(game.gameState.inventory, []);
});

// 10.
test('ngplus: cumulative totals add across multiple cycles', () => {
  const cycle1 = {
    ...DEFAULT_STATE,
    ngPlus: true,
    ngCount: 1,
    totalCommands: 100,
    totalPlaytimeMs: 50_000,
    sessionCommands: 30,
    playtimeMs: 10_000,
    masterUnlocked: true
  };
  const cycle2 = ngplusMod.buildNgPlusState(cycle1, { ...DEFAULT_STATE });
  assert.equal(cycle2.totalCommands, 130);
  assert.equal(cycle2.totalPlaytimeMs, 60_000);
  assert.equal(cycle2.ngCount, 2);
});
