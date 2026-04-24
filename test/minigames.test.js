'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  scoreGuess,
  evaluateCircuit,
  solveCircuit,
  morseEncode,
  morseDecode,
  MORSE_MAP,
  LOGIC_GATES
} = require('../src/minigames');

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

// ---- Logic circuit ----
test('LOGIC_GATES basic truth tables', () => {
  assert.equal(LOGIC_GATES.AND(1, 1), true);
  assert.equal(LOGIC_GATES.AND(1, 0), false);
  assert.equal(LOGIC_GATES.OR(0, 1),  true);
  assert.equal(LOGIC_GATES.XOR(1, 1), false);
  assert.equal(LOGIC_GATES.XOR(1, 0), true);
  assert.equal(LOGIC_GATES.NAND(1, 1), false);
  assert.equal(LOGIC_GATES.NOR(0, 0), true);
});

test('evaluateCircuit: three-gate composition', () => {
  const circuit = [
    { op: 'AND', in: ['A', 'B'], out: 'X' },
    { op: 'XOR', in: ['X', 'C'], out: 'Y' },
    { op: 'OR',  in: ['Y', 'A'], out: 'Z' }
  ];
  const env = evaluateCircuit(circuit, { A: true, B: false, C: false });
  // X = true AND false = false, Y = false XOR false = false, Z = false OR true = true
  assert.equal(env.X, false);
  assert.equal(env.Y, false);
  assert.equal(env.Z, true);
});

test('evaluateCircuit rejects unknown gate', () => {
  assert.throws(() => evaluateCircuit([{ op: 'FOO', in: [true, false], out: 'X' }], {}));
});

test('solveCircuit finds at least one valid assignment for sample puzzle', () => {
  const circuit = [
    { op: 'AND', in: ['A', 'B'], out: 'X' },
    { op: 'XOR', in: ['X', 'C'], out: 'Y' },
    { op: 'OR',  in: ['Y', 'A'], out: 'Z' }
  ];
  // Z=true is the puzzle's primary target
  const hits = solveCircuit(circuit, ['A', 'B', 'C'], 'Z', true);
  assert.ok(hits.length > 0, 'must have at least one solution');
  for (const h of hits) {
    const env = evaluateCircuit(circuit, h);
    assert.equal(env.Z, true);
  }
});

// ---- Morse ----
test('morseEncode/morseDecode: round-trip on KIMI', () => {
  const code = morseEncode('KIMI');
  assert.equal(code, '-.- .. -- ..');
  assert.equal(morseDecode(code), 'KIMI');
});

test('morseEncode handles multi-word strings', () => {
  const code = morseEncode('HI AI');
  assert.equal(morseDecode(code), 'HI AI');
});

test('MORSE_MAP covers A-Z and 0-9', () => {
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    assert.ok(MORSE_MAP[ch], `missing ${ch}`);
  }
  for (let d = 0; d <= 9; d++) {
    assert.ok(MORSE_MAP[String(d)], `missing ${d}`);
  }
});

test('morseDecode returns empty string for empty input', () => {
  assert.equal(morseDecode(''), '');
});

// ---- v2.4: chess puzzle ----
const {
  CHESS_PUZZLES,
  isChessMateSolution,
  caesarEncode,
  caesarDecode,
  scoreCipherGuess,
  CIPHER_DICT
} = require('../src/minigames');

test('CHESS_PUZZLES defines at least one puzzle with board + answer', () => {
  assert.ok(Array.isArray(CHESS_PUZZLES));
  assert.ok(CHESS_PUZZLES.length >= 1);
  const p = CHESS_PUZZLES[0];
  assert.ok(Array.isArray(p.board) && p.board.length > 0);
  assert.ok(typeof p.answer === 'string' && p.answer.length > 0);
});

test('isChessMateSolution accepts canonical + forgiving forms', () => {
  const p = CHESS_PUZZLES[0]; // answer is Rf8
  assert.equal(isChessMateSolution(p, 'Rf8'), true);
  assert.equal(isChessMateSolution(p, 'Rf8#'), true);
  assert.equal(isChessMateSolution(p, 'rook f8'), true);
  assert.equal(isChessMateSolution(p, 'f8'), true);
  assert.equal(isChessMateSolution(p, 'Ke2'), false);
  assert.equal(isChessMateSolution(p, ''), false);
});

// ---- v2.4: cipher decoder ----
test('caesarEncode is round-trip safe via caesarDecode', () => {
  const text = 'Hello KIMI';
  for (let shift = 0; shift < 26; shift++) {
    assert.equal(caesarDecode(caesarEncode(text, shift), shift), text, `shift=${shift}`);
  }
});

test('caesarEncode preserves non-alpha characters', () => {
  assert.equal(caesarEncode('abc 123!', 1), 'bcd 123!');
});

test('scoreCipherGuess scores plaintext by dictionary hits', () => {
  const hi = scoreCipherGuess('the dawn is near');
  const lo = scoreCipherGuess('zzz yyy xxx');
  assert.ok(hi > lo);
});

test('CIPHER_DICT is a non-empty string array', () => {
  assert.ok(Array.isArray(CIPHER_DICT));
  assert.ok(CIPHER_DICT.length >= 5);
  for (const w of CIPHER_DICT) assert.equal(typeof w, 'string');
});
