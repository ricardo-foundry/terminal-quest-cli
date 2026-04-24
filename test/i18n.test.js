'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { t, setLocale, getLocale, availableLocales } = require('../src/i18n');

test('availableLocales includes en and zh', () => {
  const locales = availableLocales();
  assert.ok(locales.includes('en'));
  assert.ok(locales.includes('zh'));
});

test('setLocale + t: english default', () => {
  assert.equal(setLocale('en'), true);
  assert.equal(getLocale(), 'en');
  assert.equal(t('cmd.unknown', { cmd: 'foo' }), 'Command not found: foo');
});

test('setLocale + t: chinese', () => {
  setLocale('zh');
  assert.equal(t('cmd.unknown', { cmd: '废'  }), '命令未找到: 废');
  setLocale('en'); // cleanup
});

test('setLocale rejects unknown codes', () => {
  assert.equal(setLocale('kr'), false);
});

test('t falls back to the key when missing in both locales', () => {
  setLocale('en');
  assert.equal(t('no.such.key'), 'no.such.key');
});
