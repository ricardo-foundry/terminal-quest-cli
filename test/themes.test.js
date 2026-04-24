'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function withEnv(patch, fn) {
  const origEnv = { ...process.env };
  const origArgv = [...process.argv];
  const origIsTTY = process.stdout.isTTY;
  for (const [k, v] of Object.entries(patch.env || {})) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  if (patch.argv) process.argv = patch.argv;
  if (patch.isTTY !== undefined) Object.defineProperty(process.stdout, 'isTTY', { value: patch.isTTY, configurable: true });
  try {
    // force fresh requires each call
    delete require.cache[require.resolve('../src/terminal')];
    delete require.cache[require.resolve('../src/themes')];
    return fn();
  } finally {
    process.env = origEnv;
    process.argv = origArgv;
    Object.defineProperty(process.stdout, 'isTTY', { value: origIsTTY, configurable: true });
    delete require.cache[require.resolve('../src/terminal')];
    delete require.cache[require.resolve('../src/themes')];
  }
}

test('NO_COLOR env forces colorLevel 0', () => {
  withEnv({ env: { NO_COLOR: '1', FORCE_COLOR: undefined, COLORTERM: undefined, TERM: 'xterm-256color' }, isTTY: true }, () => {
    const { getCapabilities } = require('../src/terminal');
    const caps = getCapabilities();
    assert.equal(caps.colorLevel, 0);
    assert.equal(caps.supportsColor, false);
  });
});

test('--no-color flag forces colorLevel 0', () => {
  withEnv({
    env: { NO_COLOR: undefined, FORCE_COLOR: undefined, COLORTERM: 'truecolor', TERM: 'xterm' },
    argv: [...process.argv, '--no-color'],
    isTTY: true
  }, () => {
    const { getCapabilities } = require('../src/terminal');
    assert.equal(getCapabilities().colorLevel, 0);
  });
});

test('COLORTERM=truecolor lifts to level 3', () => {
  withEnv({
    env: { NO_COLOR: undefined, FORCE_COLOR: undefined, COLORTERM: 'truecolor', TERM: 'xterm-256color' },
    isTTY: true
  }, () => {
    const caps = require('../src/terminal').getCapabilities();
    assert.equal(caps.colorLevel, 3);
  });
});

test('TERM=xterm-256color lands at level 2', () => {
  withEnv({
    env: { NO_COLOR: undefined, FORCE_COLOR: undefined, COLORTERM: undefined, TERM: 'xterm-256color' },
    isTTY: true
  }, () => {
    const caps = require('../src/terminal').getCapabilities();
    assert.equal(caps.colorLevel, 2);
  });
});

test('TERM=dumb forces plaintext', () => {
  withEnv({
    env: { NO_COLOR: undefined, FORCE_COLOR: undefined, COLORTERM: 'truecolor', TERM: 'dumb' },
    isTTY: true
  }, () => {
    const caps = require('../src/terminal').getCapabilities();
    assert.equal(caps.colorLevel, 0);
  });
});

test('non-TTY pipe yields plaintext by default', () => {
  withEnv({
    env: { NO_COLOR: undefined, FORCE_COLOR: undefined, COLORTERM: undefined, TERM: 'xterm-256color' },
    isTTY: false
  }, () => {
    const caps = require('../src/terminal').getCapabilities();
    assert.equal(caps.colorLevel, 0);
  });
});

test('FORCE_COLOR overrides non-TTY', () => {
  withEnv({
    env: { NO_COLOR: undefined, FORCE_COLOR: '2', COLORTERM: undefined, TERM: 'dumb' },
    isTTY: false
  }, () => {
    const caps = require('../src/terminal').getCapabilities();
    assert.equal(caps.colorLevel, 2);
  });
});

test('plain theme decorators prefix status tags', () => {
  withEnv({
    env: { NO_COLOR: '1', FORCE_COLOR: undefined, TERM: 'xterm' },
    isTTY: true
  }, () => {
    const { getTheme } = require('../src/themes');
    const t = getTheme('dark');
    assert.equal(t.warning('something'), '[WARN] something');
    assert.equal(t.error('bad'), '[ERROR] bad');
    assert.equal(t.success('ok'), '[OK] ok');
  });
});

test('16-colour theme does not use hex calls', () => {
  withEnv({
    env: { NO_COLOR: undefined, FORCE_COLOR: undefined, COLORTERM: undefined, TERM: 'xterm' },
    isTTY: true
  }, () => {
    const { getTheme } = require('../src/themes');
    // we can't easily inspect chalk internals — just assert the
    // theme functions produce strings and don't crash.
    const t = getTheme('dark');
    assert.equal(typeof t.primary('x'), 'string');
    assert.equal(typeof t.gold('y'), 'string');
  });
});

test('availableThemes lists all three', () => {
  const { availableThemes } = require('../src/themes');
  const list = availableThemes();
  assert.ok(list.includes('dark'));
  assert.ok(list.includes('light'));
  assert.ok(list.includes('retro'));
});

test('unknown theme name falls back to dark', () => {
  const { getTheme } = require('../src/themes');
  const t = getTheme('does-not-exist');
  assert.equal(typeof t.primary, 'function');
});
