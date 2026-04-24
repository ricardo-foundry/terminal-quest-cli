/**
 * @module wcwidth
 * @description East-Asian-Width aware visual width calculator.
 *
 * Terminals render characters in cells, not code units. Chinese, Japanese
 * and Korean (CJK) glyphs, along with most emoji, render across TWO cells;
 * zero-width joiners, combining accents and ANSI colour escape sequences
 * render across ZERO cells. JavaScript's `String.length` counts UTF-16
 * code units, which is wrong for both.
 *
 * This module ships:
 *   - `wcwidth(ch)`     : width for a single code point (0, 1, or 2)
 *   - `visualWidth(s)`  : width for a string, stripping ANSI first
 *   - `padVisual(s, n)` : right-pad to `n` visual columns
 *   - `truncateVisual`  : cut a string to N columns, ellipsis-aware
 *   - `wrapVisual(s, n)`: word-safe soft-wrap at N columns
 *
 * No external dependencies. Built against Unicode 15 EAW ranges.
 * We deliberately keep the table small and inlined; it costs a few
 * bytes of binary and spares us pulling in `wcwidth` / `string-width`
 * from npm for a small CLI game.
 *
 * @license MIT
 */

'use strict';

// ANSI CSI SGR pattern — \x1b[...m
// Also handles ESC-less terminals that pass through raw bytes.
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g; // CSI ESC-[ ... <letter>
// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\x00-\x08\x0b-\x1f\x7f]/g;

/**
 * Test whether a Unicode code point renders in 2 terminal cells.
 * Covers CJK unified ideographs, Hangul, kana, fullwidth forms, and
 * most of the emoji planes (including ZWJ sequences approximated by
 * their base glyphs — emoji width on real terminals is heuristic).
 *
 * @param {number} cp  Unicode code point.
 * @returns {boolean}
 */
function isWide(cp) {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||   // Hangul Jamo init
    (cp >= 0x2329 && cp <= 0x232a) ||   // angle brackets
    (cp >= 0x2e80 && cp <= 0x303e) ||   // CJK Radicals + Kangxi
    (cp >= 0x3041 && cp <= 0x33ff) ||   // Hiragana, Katakana, Bopomofo, Hangul compat
    (cp >= 0x3400 && cp <= 0x4dbf) ||   // CJK Ext A
    (cp >= 0x4e00 && cp <= 0x9fff) ||   // CJK Unified Ideographs
    (cp >= 0xa000 && cp <= 0xa4cf) ||   // Yi
    (cp >= 0xa960 && cp <= 0xa97f) ||   // Hangul Jamo Ext A
    (cp >= 0xac00 && cp <= 0xd7a3) ||   // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) ||   // CJK Compat Ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) ||   // CJK Compat Forms
    (cp >= 0xff00 && cp <= 0xff60) ||   // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||   // Fullwidth signs
    (cp >= 0x1f300 && cp <= 0x1f64f) || // Misc symbols + emoticons
    (cp >= 0x1f680 && cp <= 0x1f6ff) || // Transport + map
    (cp >= 0x1f900 && cp <= 0x1f9ff) || // Supplemental symbols
    (cp >= 0x1fa70 && cp <= 0x1faff) || // Symbols + pictographs ext
    (cp >= 0x20000 && cp <= 0x2fffd) || // CJK Ext B–F
    (cp >= 0x30000 && cp <= 0x3fffd)    // CJK Ext G
  );
}

/**
 * Test whether a code point is zero-width (combining marks, ZWJ, VS).
 *
 * @param {number} cp
 * @returns {boolean}
 */
function isZeroWidth(cp) {
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||   // combining diacriticals
    (cp >= 0x0483 && cp <= 0x0489) ||
    (cp >= 0x0591 && cp <= 0x05bd) ||
    (cp >= 0x200b && cp <= 0x200f) ||   // ZWSP, ZWJ, ZWNJ, LRM, RLM
    (cp >= 0x2028 && cp <= 0x202e) ||   // line/paragraph sep + bidi
    (cp >= 0xfe00 && cp <= 0xfe0f) ||   // variation selectors
    cp === 0xfeff ||                    // BOM
    (cp >= 0xe0100 && cp <= 0xe01ef)    // VS Supplement
  );
}

/**
 * Return visual width (in terminal cells) for a single code point.
 * Returns 0 for control characters and combining marks, 2 for wide
 * glyphs, and 1 otherwise.
 *
 * @param {number|string} chOrCp Either a code point or a single char.
 * @returns {number}
 */
function wcwidth(chOrCp) {
  const cp = typeof chOrCp === 'number' ? chOrCp : (chOrCp && chOrCp.codePointAt(0));
  if (cp == null) return 0;
  if (cp === 0) return 0;
  // C0 / C1 control
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (isZeroWidth(cp)) return 0;
  if (isWide(cp)) return 2;
  return 1;
}

/**
 * Strip ANSI CSI colour/SGR sequences.
 *
 * @param {string} s
 * @returns {string}
 */
function stripAnsi(s) {
  if (typeof s !== 'string') return '';
  return s.replace(ANSI_RE, '');
}

/**
 * Visual width of a string, ANSI-safe.
 *
 * @param {string} s
 * @returns {number} number of terminal cells
 */
function visualWidth(s) {
  if (typeof s !== 'string' || s.length === 0) return 0;
  const clean = stripAnsi(s);
  let w = 0;
  for (const ch of clean) {
    w += wcwidth(ch.codePointAt(0));
  }
  return w;
}

/**
 * Right-pad a string with `padChar` until it reaches `width` visual
 * columns. No-op if already wide enough.
 *
 * @param {string} s
 * @param {number} width
 * @param {string} [padChar=' ']
 * @returns {string}
 */
function padVisual(s, width, padChar = ' ') {
  const cur = visualWidth(s);
  if (cur >= width) return s;
  return s + padChar.repeat(width - cur);
}

/**
 * Left-pad to `width`.
 *
 * @param {string} s
 * @param {number} width
 * @param {string} [padChar=' ']
 * @returns {string}
 */
function padVisualStart(s, width, padChar = ' ') {
  const cur = visualWidth(s);
  if (cur >= width) return s;
  return padChar.repeat(width - cur) + s;
}

/**
 * Centre `s` in `width` columns.
 *
 * @param {string} s
 * @param {number} width
 * @returns {string}
 */
function centerVisual(s, width) {
  const cur = visualWidth(s);
  if (cur >= width) return s;
  const left = Math.floor((width - cur) / 2);
  const right = width - cur - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
}

/**
 * Truncate `s` to at most `width` visual columns. Appends `ellipsis`
 * if truncation occurred and there is room.
 *
 * @param {string} s
 * @param {number} width
 * @param {string} [ellipsis='...']
 * @returns {string}
 */
function truncateVisual(s, width, ellipsis = '...') {
  if (visualWidth(s) <= width) return s;
  const limit = Math.max(0, width - visualWidth(ellipsis));
  let out = '';
  let w = 0;
  for (const ch of stripAnsi(s)) {
    const cw = wcwidth(ch.codePointAt(0));
    if (w + cw > limit) break;
    out += ch;
    w += cw;
  }
  return out + ellipsis;
}

/**
 * Soft-wrap `s` at `width` visual columns. Breaks on whitespace when
 * possible, falls back to hard-breaks inside unbroken runs (e.g. long
 * Chinese text without spaces).
 *
 * @param {string} s
 * @param {number} width
 * @returns {string[]}
 */
function wrapVisual(s, width) {
  if (width <= 0) return [s];
  const paragraphs = String(s).split('\n');
  const out = [];
  for (const para of paragraphs) {
    if (visualWidth(para) <= width) { out.push(para); continue; }
    let line = '';
    let lw = 0;
    for (const ch of stripAnsi(para)) {
      const cw = wcwidth(ch.codePointAt(0));
      if (lw + cw > width) {
        out.push(line);
        line = ch;
        lw = cw;
      } else {
        line += ch;
        lw += cw;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

module.exports = {
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
};
