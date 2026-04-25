'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const rel = require('../src/relationships');

test('getAffinity returns 0 for unknown npc / unset state', () => {
  assert.equal(rel.getAffinity({}, 'guide'), 0);
  assert.equal(rel.getAffinity({ npcAffinity: { guide: 5 } }, 'guide'), 5);
});

test('adjustAffinity clamps between -100 and +100', () => {
  const gs = {};
  rel.adjustAffinity(gs, 'guide', 999);
  assert.equal(rel.getAffinity(gs, 'guide'), 100);
  rel.adjustAffinity(gs, 'guide', -9999);
  assert.equal(rel.getAffinity(gs, 'guide'), -100);
});

test('moodFor maps affinity to one of 5 buckets', () => {
  const gs = {};
  assert.equal(rel.moodFor(gs, 'x'), 'neutral');
  rel.adjustAffinity(gs, 'x', 25);
  assert.equal(rel.moodFor(gs, 'x'), 'friendly');
  rel.adjustAffinity(gs, 'x', 50);  // 75 total
  assert.equal(rel.moodFor(gs, 'x'), 'adoring');
  rel.adjustAffinity(gs, 'x', -100); // -25
  assert.equal(rel.moodFor(gs, 'x'), 'cold');
  rel.adjustAffinity(gs, 'x', -50); // -75
  assert.equal(rel.moodFor(gs, 'x'), 'hostile');
});

test('giftEffect returns table values for known items, default for unknown', () => {
  const known = rel.giftEffect('rare-stamp');
  assert.equal(typeof known.delta, 'number');
  assert.ok(known.delta > 0);
  const unknown = rel.giftEffect('made-up-doodad');
  assert.equal(unknown.delta, 1);
  // bad input safe
  assert.equal(rel.giftEffect(null).delta, 0);
});

test('giveGift records log + clamps affinity + does not pop inventory', () => {
  const gs = { inventory: ['rare-stamp'] };
  const r = rel.giveGift(gs, 'archivist', 'rare-stamp');
  assert.equal(r.ok, true);
  assert.ok(r.delta > 0);
  assert.equal(rel.getAffinity(gs, 'archivist'), r.delta);
  // module does NOT touch inventory itself
  assert.deepEqual(gs.inventory, ['rare-stamp']);
  assert.equal(gs.giftLog.length, 1);
});

test('recordTalk caps gain after TALK_DAILY_CAP repeats', () => {
  const gs = {};
  for (let i = 0; i < 100; i++) rel.recordTalk(gs, 'guide');
  assert.equal(rel.getAffinity(gs, 'guide'), rel.TALK_DAILY_CAP * rel.TALK_TICK);
});

test('specialDialog only fires when adoring', () => {
  const gs = {};
  rel.adjustAffinity(gs, 'guide', 30);
  assert.equal(rel.specialDialog(gs, 'guide'), null);
  rel.adjustAffinity(gs, 'guide', 50);  // 80 total -> adoring
  assert.equal(rel.moodFor(gs, 'guide'), 'adoring');
  assert.ok(typeof rel.specialDialog(gs, 'guide') === 'string');
});

test('specialItem grants once and never repeats', () => {
  const gs = {};
  rel.adjustAffinity(gs, 'guide', 80);
  const first = rel.specialItem(gs, 'guide');
  assert.ok(first, 'expected an item');
  const second = rel.specialItem(gs, 'guide');
  assert.equal(second, null);
});

test('giving a forbidden gift drops affinity', () => {
  const gs = { inventory: ['key-shard-1'] };
  rel.adjustAffinity(gs, 'archivist', 50);
  rel.giveGift(gs, 'archivist', 'key-shard-1');
  assert.ok(rel.getAffinity(gs, 'archivist') < 50, 'should have dropped');
});

test('GIFT_TABLE has at least 5 entries with sane shape', () => {
  const keys = Object.keys(rel.GIFT_TABLE);
  assert.ok(keys.length >= 5);
  for (const k of keys) {
    const e = rel.GIFT_TABLE[k];
    assert.equal(typeof e.delta, 'number');
    assert.equal(typeof e.ack, 'string');
  }
});

// ---- iter-13: edge cases ----

test('giveGift: missing arguments fail gracefully', () => {
  assert.equal(rel.giveGift(null, 'guide', 'rare-stamp').ok, false);
  assert.equal(rel.giveGift({}, '', 'rare-stamp').ok, false);
  assert.equal(rel.giveGift({}, 'guide', '').ok, false);
});

test('giveGift: log is capped to 50 entries even after many gifts', () => {
  const gs = {};
  for (let i = 0; i < 80; i++) {
    rel.giveGift(gs, 'guide', 'rare-stamp');
  }
  assert.ok(Array.isArray(gs.giftLog));
  assert.ok(gs.giftLog.length <= 50, `log grew to ${gs.giftLog.length}`);
});

test('moodFor: exact boundary values land in the expected bucket', () => {
  const gs = {};
  rel.adjustAffinity(gs, 'a', 60);
  assert.equal(rel.moodFor(gs, 'a'), 'adoring');
  rel.adjustAffinity(gs, 'a', -1);
  assert.equal(rel.moodFor(gs, 'a'), 'friendly');
  rel.adjustAffinity(gs, 'b', 19);
  assert.equal(rel.moodFor(gs, 'b'), 'neutral');
  rel.adjustAffinity(gs, 'b', 1);
  assert.equal(rel.moodFor(gs, 'b'), 'friendly');
  rel.adjustAffinity(gs, 'c', -60);
  assert.equal(rel.moodFor(gs, 'c'), 'hostile');
});

test('specialItem: mood drops below adoring before granting -> returns null', () => {
  const gs = {};
  rel.adjustAffinity(gs, 'guide', 50);
  // friendly, not adoring -> no item
  assert.equal(rel.specialItem(gs, 'guide'), null);
  rel.adjustAffinity(gs, 'guide', 30); // now 80 -> adoring
  const got = rel.specialItem(gs, 'guide');
  assert.ok(typeof got === 'string');
});

test('adjustAffinity: non-number deltas are coerced (NaN -> +0)', () => {
  const gs = {};
  rel.adjustAffinity(gs, 'guide', 'not-a-number');
  assert.equal(rel.getAffinity(gs, 'guide'), 0);
  rel.adjustAffinity(gs, 'guide', NaN);
  assert.equal(rel.getAffinity(gs, 'guide'), 0);
  rel.adjustAffinity(gs, 'guide', 7);
  assert.equal(rel.getAffinity(gs, 'guide'), 7);
});
