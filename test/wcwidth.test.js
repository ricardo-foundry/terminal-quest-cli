'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  wcwidth,
  visualWidth,
  padVisual,
  padVisualStart,
  centerVisual,
  truncateVisual,
  wrapVisual,
  stripAnsi,
  isWide,
  isZeroWidth
} = require('../src/wcwidth');

test('wcwidth: ASCII letters are width 1', () => {
  assert.equal(wcwidth('a'.codePointAt(0)), 1);
  assert.equal(wcwidth('Z'.codePointAt(0)), 1);
  assert.equal(wcwidth('0'.codePointAt(0)), 1);
  assert.equal(wcwidth(' '.codePointAt(0)), 1);
});

test('wcwidth: control characters are width 0', () => {
  assert.equal(wcwidth(0x00), 0);    // NUL
  assert.equal(wcwidth(0x07), 0);    // BEL
  assert.equal(wcwidth(0x1b), 0);    // ESC
  assert.equal(wcwidth(0x7f), 0);    // DEL
});

test('wcwidth: CJK unified ideographs are width 2', () => {
  assert.equal(wcwidth('中'.codePointAt(0)), 2);
  assert.equal(wcwidth('文'.codePointAt(0)), 2);
  assert.equal(wcwidth('日'.codePointAt(0)), 2);
  assert.equal(wcwidth('한'.codePointAt(0)), 2); // Hangul
  assert.equal(wcwidth('あ'.codePointAt(0)), 2); // Hiragana
});

test('wcwidth: fullwidth forms are width 2', () => {
  assert.equal(wcwidth('Ａ'.codePointAt(0)), 2); // FF A
  assert.equal(wcwidth('！'.codePointAt(0)), 2); // FF !
});

test('wcwidth: emoji are width 2', () => {
  assert.equal(wcwidth(0x1F600), 2); // grinning face
  assert.equal(wcwidth(0x1F680), 2); // rocket
});

test('wcwidth: zero-width marks are width 0', () => {
  assert.equal(wcwidth(0x0301), 0); // combining acute
  assert.equal(wcwidth(0x200D), 0); // zero-width joiner
  assert.equal(wcwidth(0xFE0F), 0); // variation selector-16
});

test('visualWidth: mixed ASCII + CJK', () => {
  assert.equal(visualWidth('hi 你好'), 2 + 1 + 2 + 2); // 7
  assert.equal(visualWidth('Lv.3 勇者'), 4 + 1 + 2 + 2); // 9
});

test('visualWidth: ANSI escapes do not count', () => {
  const red = '\x1b[31mhello\x1b[0m';
  assert.equal(visualWidth(red), 5);
});

test('visualWidth: empty and non-string inputs', () => {
  assert.equal(visualWidth(''), 0);
  assert.equal(visualWidth(null), 0);
  assert.equal(visualWidth(undefined), 0);
});

test('stripAnsi removes CSI sequences', () => {
  assert.equal(stripAnsi('\x1b[31mA\x1b[0m'), 'A');
  assert.equal(stripAnsi('no ansi'), 'no ansi');
});

test('padVisual pads CJK correctly', () => {
  const padded = padVisual('你好', 8);
  assert.equal(visualWidth(padded), 8);
});

test('padVisual no-op when already wide enough', () => {
  assert.equal(padVisual('abc', 3), 'abc');
  assert.equal(padVisual('abcdef', 3), 'abcdef');
});

test('padVisualStart left-pads to correct visual width', () => {
  const padded = padVisualStart('hi', 6);
  assert.equal(visualWidth(padded), 6);
  assert.ok(padded.endsWith('hi'));
});

test('centerVisual centres within a field', () => {
  const c = centerVisual('hi', 6);
  assert.equal(visualWidth(c), 6);
  assert.ok(c.includes('hi'));
});

test('truncateVisual cuts to target width with ellipsis', () => {
  const t = truncateVisual('Hello World', 8);
  assert.ok(visualWidth(t) <= 8);
  assert.ok(t.endsWith('...'));
});

test('truncateVisual keeps short strings intact', () => {
  assert.equal(truncateVisual('abc', 10), 'abc');
});

test('truncateVisual handles CJK boundary', () => {
  const t = truncateVisual('一二三四五', 6);
  assert.ok(visualWidth(t) <= 6);
});

test('wrapVisual: short string returns single line', () => {
  assert.deepEqual(wrapVisual('hello', 20), ['hello']);
});

test('wrapVisual: hard-wraps long runs', () => {
  const lines = wrapVisual('你好世界欢迎光临', 4);
  for (const l of lines) assert.ok(visualWidth(l) <= 4);
  assert.ok(lines.length >= 4);
});

test('wrapVisual preserves explicit newlines', () => {
  const lines = wrapVisual('line1\nline2', 20);
  assert.equal(lines.length, 2);
});

test('isWide true for CJK, false for ASCII', () => {
  assert.equal(isWide(0x4e2d), true);  // 中
  assert.equal(isWide(0x61), false);   // a
});

test('isZeroWidth true for combining mark', () => {
  assert.equal(isZeroWidth(0x0301), true);
  assert.equal(isZeroWidth(0x61), false);
});
