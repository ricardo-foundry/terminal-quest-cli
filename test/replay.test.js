'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-replay-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const saveMod = require('../src/save');
const {
  ReplayRecorder,
  playReplay,
  formatEvent,
  sanitise,
  loadReplayFromSlot,
  DEFAULT_CAP
} = require('../src/replay');

after(() => {
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

test('ReplayRecorder initialises empty and appends events', () => {
  const gs = {};
  const rec = new ReplayRecorder(gs);
  assert.ok(Array.isArray(gs.replay));
  assert.equal(gs.replay.length, 0);
  rec.record('command', 'ls');
  rec.record('unlock', 'first_step');
  assert.equal(gs.replay.length, 2);
  assert.equal(gs.replay[0].type, 'command');
  assert.equal(gs.replay[1].payload, 'first_step');
});

test('ReplayRecorder respects the cap (oldest is evicted)', () => {
  const gs = {};
  const rec = new ReplayRecorder(gs, { cap: 50 });
  for (let i = 0; i < 80; i++) rec.record('command', 'cmd' + i);
  assert.equal(gs.replay.length, 50);
  assert.equal(gs.replay[0].payload, 'cmd30');
});

test('ReplayRecorder ignores calls with no type', () => {
  const gs = {};
  const rec = new ReplayRecorder(gs);
  rec.record('', 'x');
  rec.record(null, 'y');
  assert.equal(gs.replay.length, 0);
});

test('sanitise drops functions and caps array length', () => {
  const out = sanitise({
    ok: true,
    fn: () => 'nope',
    arr: new Array(100).fill('x'),
    nested: { a: 1, b: () => 1 }
  });
  assert.equal(out.ok, true);
  assert.equal('fn' in out, false);
  assert.ok(out.arr.length <= 32);
  assert.equal(out.nested.a, 1);
  assert.equal('b' in out.nested, false);
});

test('formatEvent produces stable tags per type', () => {
  assert.ok(/\$ ls/.test(formatEvent({ t: 0, type: 'command', payload: 'ls' })));
  assert.ok(/achievement first_step/.test(formatEvent({ t: 1000, type: 'unlock', payload: 'first_step' })));
  assert.ok(/level up -> 3/.test(formatEvent({ t: 2000, type: 'level', payload: 3 })));
});

test('playReplay writes one line per event plus a footer', async () => {
  const lines = [];
  const sleeps = [];
  const sleepFn = (n) => { sleeps.push(n); return Promise.resolve(); };
  const buffer = [
    { t: 0, type: 'command', payload: 'ls' },
    { t: 100, type: 'command', payload: 'cd /shadow' }
  ];
  const res = await playReplay(buffer, { write: (l) => lines.push(l), delay: 0, sleepFn });
  assert.equal(res.lines, 2);
  assert.equal(lines.length, 3); // 2 events + "end of replay"
  assert.ok(lines[lines.length - 1].includes('end of replay'));
});

test('playReplay: empty buffer writes a friendly placeholder', async () => {
  const lines = [];
  const res = await playReplay([], { write: (l) => lines.push(l), delay: 0 });
  assert.equal(res.lines, 0);
  assert.equal(lines.length, 1);
  assert.ok(/no replay/.test(lines[0]));
});

test('playReplay honours delay by invoking sleepFn', async () => {
  const sleeps = [];
  const buffer = [{ t: 0, type: 'command', payload: 'ls' }];
  await playReplay(buffer, {
    write: () => {},
    delay: 25,
    sleepFn: (n) => { sleeps.push(n); return Promise.resolve(); }
  });
  assert.deepEqual(sleeps, [25]);
});

test('loadReplayFromSlot reads events from a saved envelope', () => {
  saveMod.save('replay-slot', {
    level: 1,
    replay: [{ t: 0, type: 'command', payload: 'pwd' }]
  });
  const events = loadReplayFromSlot('replay-slot', saveMod);
  assert.ok(Array.isArray(events));
  assert.equal(events.length, 1);
  assert.equal(events[0].payload, 'pwd');
});

test('loadReplayFromSlot returns null for missing slot', () => {
  const r = loadReplayFromSlot('does-not-exist-anywhere', saveMod);
  assert.equal(r, null);
});

test('DEFAULT_CAP is within a sane range', () => {
  assert.ok(DEFAULT_CAP >= 100);
  assert.ok(DEFAULT_CAP <= 5000);
});
