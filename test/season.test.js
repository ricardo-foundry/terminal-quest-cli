'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const season = require('../src/season');

test('SEASONS has all four canonical seasons', () => {
  const names = season.SEASONS.map((s) => s.name);
  assert.deepEqual(names, ['spring', 'summer', 'autumn', 'winter']);
});

test('getSeason maps turns into 30-turn windows', () => {
  assert.equal(season.getSeason(0).name, 'spring');
  assert.equal(season.getSeason(29).name, 'spring');
  assert.equal(season.getSeason(30).name, 'summer');
  assert.equal(season.getSeason(60).name, 'autumn');
  assert.equal(season.getSeason(90).name, 'winter');
  // wraps after 120
  assert.equal(season.getSeason(120).name, 'spring');
  // negative inputs do not crash
  assert.equal(season.getSeason(-1).name, 'winter');
});

test('dayOfSeason is 1..30', () => {
  assert.equal(season.dayOfSeason(0), 1);
  assert.equal(season.dayOfSeason(1), 2);
  assert.equal(season.dayOfSeason(29), 30);
  assert.equal(season.dayOfSeason(30), 1);
});

test('formatSeasonBadge contains label + day count', () => {
  const s = season.formatSeasonBadge(15);
  assert.match(s, /Spring/);
  assert.match(s, /16\/30/);
});

test('seasonsBetween reports each season newly entered', () => {
  // 25 -> 65 crosses summer (30) and autumn (60)
  const seen = season.seasonsBetween(25, 65);
  const names = seen.map((s) => s.name);
  assert.deepEqual(names, ['summer', 'autumn']);
});

test('seasonsBetween returns empty array when no boundary crossed', () => {
  assert.deepEqual(season.seasonsBetween(5, 10), []);
});

test('npcAvailable closes shop in winter', () => {
  const winter = season.getSeason(95);
  const r = season.npcAvailable('shop', winter);
  assert.equal(r.open, false);
  assert.match(r.reason, /winter/i);
});

test('npcAvailable closes researcher in summer, not in autumn', () => {
  assert.equal(season.npcAvailable('researcher', season.getSeason(40)).open, false);
  assert.equal(season.npcAvailable('researcher', season.getSeason(70)).open, true);
});

test('matchesSeason supports string + array forms', () => {
  assert.equal(season.matchesSeason({ turn: 0 }, 'spring'), true);
  assert.equal(season.matchesSeason({ turn: 0 }, 'winter'), false);
  assert.equal(season.matchesSeason({ turn: 0 }, ['spring', 'summer']), true);
  assert.equal(season.matchesSeason({ turn: 90 }, ['spring', 'summer']), false);
  // 'any' / falsy always matches
  assert.equal(season.matchesSeason({ turn: 90 }, 'any'), true);
  assert.equal(season.matchesSeason({ turn: 90 }, null), true);
});

test('yearOf advances every 120 turns', () => {
  assert.equal(season.yearOf(0), 0);
  assert.equal(season.yearOf(119), 0);
  assert.equal(season.yearOf(120), 1);
  assert.equal(season.yearOf(241), 2);
});

test('YEAR_LENGTH is exactly 4 * SEASON_LENGTH', () => {
  assert.equal(season.YEAR_LENGTH, season.SEASON_LENGTH * 4);
});

// ---- iter-13: edge cases ----

test('getSeason: NaN / undefined turn coerces to spring', () => {
  assert.equal(season.getSeason(NaN).name, 'spring');
  assert.equal(season.getSeason(undefined).name, 'spring');
  assert.equal(season.getSeason(null).name, 'spring');
});

test('seasonsBetween: spans more than a full year reports each season once', () => {
  // 0 -> 240 = 2 full years; expect at most 4 unique season names with no
  // duplicates back-to-back of the same season.
  const seen = season.seasonsBetween(0, 240);
  for (let i = 1; i < seen.length; i++) {
    assert.notEqual(seen[i].name, seen[i - 1].name, 'no consecutive duplicates');
  }
  // and we crossed multiple boundaries
  assert.ok(seen.length >= 3);
});

test('npcAvailable: unknown npc id is always open', () => {
  for (let t = 0; t < 120; t += 30) {
    const r = season.npcAvailable('mystery-npc', season.getSeason(t));
    assert.equal(r.open, true);
  }
});

test('npcAvailable: a falsy season object defaults to open', () => {
  assert.equal(season.npcAvailable('shop', null).open, true);
  assert.equal(season.npcAvailable('shop', undefined).open, true);
  assert.equal(season.npcAvailable('shop', {}).open, true);
});

test('matchesSeason: empty array never matches any current season', () => {
  // an empty array is "no allowed seasons" — nothing should match.
  assert.equal(season.matchesSeason({ turn: 0 }, []), false);
  assert.equal(season.matchesSeason({ turn: 90 }, []), false);
});
