'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { detectEngine, createTTS, sanitise } = require('../src/tts');

test('tts: sanitise strips ANSI escape sequences', () => {
  const dirty = '\x1b[31mhello\x1b[0m world';
  assert.equal(sanitise(dirty), 'hello world');
});

test('tts: sanitise drops control bytes and caps length', () => {
  const dirty = 'a\x00b\x01c\x07d';
  assert.equal(sanitise(dirty), 'a b c d');
  const long = 'x'.repeat(2000);
  const out = sanitise(long);
  assert.ok(out.length <= 510, `expected truncation, got ${out.length}`);
});

test('tts: sanitise handles non-string input', () => {
  assert.equal(sanitise(null), '');
  assert.equal(sanitise(undefined), '');
  assert.equal(sanitise(42), '42');
});

test('tts: detectEngine returns a known shape', () => {
  const e = detectEngine();
  assert.ok(e && typeof e.name === 'string');
  assert.ok(['say', 'espeak', 'sapi', 'none'].includes(e.name));
});

test('tts: createTTS with disabled flag is a no-op', () => {
  const tts = createTTS({ enabled: false, engine: { name: 'none' } });
  assert.equal(tts.enabled, false);
  const r = tts.speak('hello');
  assert.equal(r.spoken, false);
});

test('tts: mock engine receives sanitised text', () => {
  const seen = [];
  const tts = createTTS({
    enabled: true,
    engine: { name: 'mock', spawn: (text) => seen.push(text) }
  });
  assert.equal(tts.enabled, true);
  const r = tts.speak('\x1b[31mhi there\x1b[0m');
  assert.equal(r.spoken, true);
  assert.equal(r.engine, 'mock');
  assert.deepEqual(seen, ['hi there']);
});

test('tts: empty input is a soft-skip, not a crash', () => {
  const tts = createTTS({
    enabled: true,
    engine: { name: 'mock', spawn: () => { throw new Error('should not reach'); } }
  });
  const r = tts.speak('   ');
  assert.equal(r.spoken, false);
  assert.equal(r.reason, 'empty');
});

test('tts: close() never throws even with no inflight children', () => {
  const tts = createTTS({ enabled: false, engine: { name: 'none' } });
  // should not throw
  tts.close();
  assert.ok(true);
});
