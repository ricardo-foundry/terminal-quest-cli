'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  TUTORIAL_STEPS,
  totalEstSeconds,
  renderStep,
  runTutorial
} = require('../src/tutorial');

test('tutorial: has 12 ordered steps with stable ids', () => {
  assert.equal(TUTORIAL_STEPS.length, 12);
  const ids = TUTORIAL_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids: ' + ids.join(','));
});

test('tutorial: target runtime is roughly 5 minutes (240..360s)', () => {
  const total = totalEstSeconds();
  assert.ok(total >= 240 && total <= 360, `total=${total}s outside 4-6 min`);
});

test('tutorial: every step has body + tryThis', () => {
  for (const step of TUTORIAL_STEPS) {
    assert.ok(typeof step.title === 'string' && step.title.length > 0, step.id);
    assert.ok(Array.isArray(step.body) && step.body.length >= 1, step.id);
    assert.ok(typeof step.tryThis === 'string' && step.tryThis.length > 0, step.id);
  }
});

test('tutorial: renderStep emits header + body + try-line', () => {
  const lines = renderStep(TUTORIAL_STEPS[0]);
  assert.ok(lines[0].includes(TUTORIAL_STEPS[0].id));
  assert.ok(lines.some((l) => l.startsWith('> try:')));
});

test('tutorial: runTutorial collects printed lines and returns step ids', () => {
  const captured = [];
  const fakeGame = { gameState: { achievements: [] } };
  const r = runTutorial(fakeGame, { print: (line) => captured.push(line) });
  assert.equal(r.printed, TUTORIAL_STEPS.length);
  assert.deepEqual(r.steps, TUTORIAL_STEPS.map((s) => s.id));
  // first line should be the intro blurb
  assert.ok(captured.some((l) => l && l.includes('5 minutes')),
    'expected intro to mention 5 minutes');
  // each step heading should appear
  for (const step of TUTORIAL_STEPS) {
    assert.ok(captured.some((l) => l && l.includes(`[${step.id}]`)),
      `step heading missing for ${step.id}`);
  }
});

test('tutorial: runTutorial flips tutorialSeen and grants took_the_tour', () => {
  const fakeGame = { gameState: { achievements: [], tutorialSeen: false } };
  runTutorial(fakeGame, { print: () => {} });
  assert.equal(fakeGame.gameState.tutorialSeen, true);
  assert.ok(fakeGame.gameState.achievements.includes('took_the_tour'));
});

test('tutorial: runTutorial is idempotent w.r.t. achievement list', () => {
  const fakeGame = { gameState: { achievements: ['took_the_tour'] } };
  runTutorial(fakeGame, { print: () => {} });
  // should still have exactly one entry
  const count = fakeGame.gameState.achievements.filter((a) => a === 'took_the_tour').length;
  assert.equal(count, 1);
});
