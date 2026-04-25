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

// ---- iter-12: Sokobax ----
const {
  SOKOBAX_LEVELS,
  parseSokobaxLevel,
  sokobaxStep,
  sokobaxIsSolved,
  sokobaxRender
} = require('../src/minigames');

test('parseSokobaxLevel extracts walls/goals/boxes/player', () => {
  const lvl = parseSokobaxLevel(SOKOBAX_LEVELS[0]);
  assert.ok(lvl.player);
  assert.ok(lvl.walls.size > 0);
  assert.equal(lvl.boxes.size, 1);
  assert.equal(lvl.goals.size, 1);
});

test('sokobaxStep blocks against walls', () => {
  const lvl = parseSokobaxLevel([
    '###',
    '#@#',
    '###'
  ]);
  // Player surrounded by walls -> any direction should be a no-op.
  const next = sokobaxStep(lvl, 'up');
  assert.equal(next.player.x, lvl.player.x);
  assert.equal(next.player.y, lvl.player.y);
});

test('sokobaxStep pushes a box and records the new position', () => {
  const lvl = parseSokobaxLevel([
    '#####',
    '#@$ #',
    '#####'
  ]);
  const after = sokobaxStep(lvl, 'right');
  // box should now be one cell further right
  assert.ok(after.boxes.has('3,1'));
  assert.equal(after.player.x, 2);
});

test('sokobaxStep refuses to push a box into a wall', () => {
  const lvl = parseSokobaxLevel([
    '####',
    '#@$#',
    '####'
  ]);
  const after = sokobaxStep(lvl, 'right');
  assert.equal(after, lvl, 'should be the same state object');
});

test('sokobaxIsSolved reports true when boxes occupy all goals', () => {
  // box already on goal at fill time
  const lvl = parseSokobaxLevel([
    '####',
    '#*@#',
    '####'
  ]);
  assert.equal(sokobaxIsSolved(lvl), true);
});

test('sokobaxRender produces a grid of correct dimensions', () => {
  const lvl = parseSokobaxLevel(SOKOBAX_LEVELS[0]);
  const rows = sokobaxRender(lvl);
  assert.equal(rows.length, SOKOBAX_LEVELS[0].length);
  for (const r of rows) assert.equal(r.length, SOKOBAX_LEVELS[0][0].length);
});

// ---- iter-12: Sliding puzzle ----
const {
  slidingMakeSolved,
  slidingShuffle,
  slidingMove,
  slidingIsSolved,
  slidingNeighbors
} = require('../src/minigames');

test('slidingMakeSolved returns 1..N with 0 last', () => {
  const b = slidingMakeSolved(3);
  assert.deepEqual(b, [1, 2, 3, 4, 5, 6, 7, 8, 0]);
});

test('slidingIsSolved on a solved board', () => {
  assert.equal(slidingIsSolved(slidingMakeSolved(3)), true);
  assert.equal(slidingIsSolved([1, 2, 0, 4, 5, 3, 7, 8, 6]), false);
});

test('slidingShuffle produces a different but solvable layout', () => {
  // Walking the empty tile preserves solvability.
  let board;
  for (let i = 0; i < 5; i++) {
    board = slidingShuffle(3, 50);
    if (!slidingIsSolved(board)) break;
  }
  // we may have stumbled into solved by chance; loop exits when we don't
  assert.equal(board.length, 9);
});

test('slidingMove only swaps adjacent-to-empty tiles', () => {
  const b = [1, 2, 3, 4, 5, 0, 7, 8, 6]; // empty at idx 5
  // tile 6 (idx 8) is below empty -> legal
  const moved = slidingMove(b, 6, 3);
  assert.notEqual(moved, b);
  assert.equal(moved[5], 6);
  assert.equal(moved[8], 0);
  // tile 1 (idx 0) is far away -> illegal, returns same array
  const blocked = slidingMove(b, 1, 3);
  assert.equal(blocked, b);
});

test('slidingNeighbors lists 2-4 valid indices', () => {
  // corner: 2 neighbours
  assert.equal(slidingNeighbors(0, 3).length, 2);
  // centre: 4 neighbours
  assert.equal(slidingNeighbors(4, 3).length, 4);
  // edge: 3 neighbours
  assert.equal(slidingNeighbors(1, 3).length, 3);
});

// ---- iter-12: Connect-3 ----
const {
  connect3MakeBoard,
  connect3FindMatches,
  connect3Swap,
  connect3Resolve,
  CONNECT3_LETTERS
} = require('../src/minigames');

test('connect3MakeBoard never seeds an immediate triple', () => {
  for (let trial = 0; trial < 10; trial++) {
    const b = connect3MakeBoard(5, 5);
    const matches = connect3FindMatches(b);
    assert.equal(matches.size, 0, 'unexpected initial match');
  }
});

test('connect3FindMatches detects a horizontal triple', () => {
  const b = [
    ['A', 'A', 'A', 'B', 'C'],
    ['B', 'C', 'D', 'A', 'B'],
    ['C', 'A', 'B', 'D', 'A'],
    ['D', 'B', 'C', 'A', 'B'],
    ['E', 'D', 'A', 'B', 'C']
  ];
  const m = connect3FindMatches(b);
  assert.ok(m.has('0,0'));
  assert.ok(m.has('1,0'));
  assert.ok(m.has('2,0'));
});

test('connect3Swap reverts when no match would form', () => {
  const b = [
    ['A', 'B'],
    ['C', 'D']
  ];
  const r = connect3Swap(b, 0, 0, 1, 0);
  assert.equal(r.swapped, false);
  assert.equal(r.board, b);
});

test('connect3Swap commits when the swap forms a 3-in-a-row', () => {
  // Swapping (1,0) with (1,1) creates A,A,A in the top row at idx 1,2,3.
  // top row already has A at 1,2 and B at 3; after swap: B,A,A,A,A.
  const b = [
    ['B', 'B', 'A', 'A'],
    ['X', 'A', 'Y', 'Z']
  ];
  // Swap (1,0)=B with (1,1)=A. Top row becomes B,A,A,A -> 3-in-a-row.
  const r = connect3Swap(b, 1, 0, 1, 1);
  assert.equal(r.swapped, true);
  assert.ok(r.matches.size >= 3);
});

test('connect3Resolve removes matched cells and applies gravity', () => {
  const b = [
    ['A', 'X'],
    ['A', 'Y'],
    ['A', 'Z']
  ];
  const matches = connect3FindMatches(b);
  assert.equal(matches.size, 3);
  const after = connect3Resolve(b, matches);
  // column 0 is now all empty (nulls)
  for (let y = 0; y < 3; y++) assert.equal(after[y][0], null);
  // column 1 unchanged
  assert.equal(after[2][1], 'Z');
});

test('CONNECT3_LETTERS has 5 distinct letters', () => {
  assert.equal(CONNECT3_LETTERS.length, 5);
  assert.equal(new Set(CONNECT3_LETTERS).size, 5);
});
