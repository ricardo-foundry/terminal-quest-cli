'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { scoreGuess } = require('../src/minigames');

test('wordle scoreGuess: exact match is all greens', () => {
  assert.deepEqual(scoreGuess('KIMI', 'KIMI'), ['G', 'G', 'G', 'G']);
});

test('wordle scoreGuess: full miss', () => {
  assert.deepEqual(scoreGuess('KIMI', 'XXXX'), ['-', '-', '-', '-']);
});

test('wordle scoreGuess: all letters wrong position -> all yellow', () => {
  // IMKI vs KIMI: I->K? pos0 I vs K no; pos1 M vs I no; pos2 K vs M no; pos3 I vs I yes.
  // After greens used=[F,F,F,T]. yellows: pos0 I -> find j(not used)==I: j=1 (target[1]=I) -> Y.
  // pos1 M -> find j: j=2 (target[2]=M) -> Y.  pos2 K -> find j: j=0 (target[0]=K) -> Y.
  const r = scoreGuess('KIMI', 'IMKI');
  assert.deepEqual(r, ['Y', 'Y', 'Y', 'G']);
});

test('wordle scoreGuess: duplicates are not double-counted', () => {
  // target KIMI (one I at pos 1, one I at pos 3)
  // guess IIII: pos1 and pos3 become greens (used=[F,T,F,T])
  // pos0 I -> no unused I left -> -
  // pos2 I -> no unused I left -> -
  const r = scoreGuess('KIMI', 'IIII');
  assert.deepEqual(r, ['-', 'G', '-', 'G']);
});
