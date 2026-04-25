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

// ---- v2.5 iter-10: Japanese locale ----
test('availableLocales now includes ja', () => {
  assert.ok(availableLocales().includes('ja'));
});

test('setLocale + t: japanese basics', () => {
  setLocale('ja');
  assert.equal(t('cmd.unknown', { cmd: 'foo' }), 'コマンドが見つかりません: foo');
  assert.equal(t('boot.ready'), 'システム起動完了。');
  setLocale('en');
});

test('ja covers every en key (no silent fallback)', () => {
  const { DICTS } = require('../src/i18n');
  const en = Object.keys(DICTS.en);
  const missing = en.filter((k) => !(k in DICTS.ja));
  assert.equal(missing.length, 0, 'ja missing keys: ' + missing.join(', '));
});

test('zh still covers every en key', () => {
  const { DICTS } = require('../src/i18n');
  const en = Object.keys(DICTS.en);
  const missing = en.filter((k) => !(k in DICTS.zh));
  assert.equal(missing.length, 0, 'zh missing keys: ' + missing.join(', '));
});

test('detectLocale honours LANG=ja_JP', () => {
  const { detectLocale } = require('../src/i18n');
  const orig = process.env.LANG;
  const origTQ = process.env.TERMINAL_QUEST_LANG;
  delete process.env.TERMINAL_QUEST_LANG;
  process.env.LANG = 'ja_JP.UTF-8';
  try {
    assert.equal(detectLocale(), 'ja');
  } finally {
    if (orig === undefined) delete process.env.LANG; else process.env.LANG = orig;
    if (origTQ !== undefined) process.env.TERMINAL_QUEST_LANG = origTQ;
  }
});

// ---- v2.7 (iter-14): Traditional Chinese + Spanish ----
test('availableLocales includes zh-tw and es', () => {
  const list = availableLocales();
  assert.ok(list.includes('zh-tw'));
  assert.ok(list.includes('es'));
});

test('zh-tw covers every en key', () => {
  const { DICTS } = require('../src/i18n');
  const en = Object.keys(DICTS.en);
  const missing = en.filter((k) => !(k in DICTS['zh-tw']));
  assert.equal(missing.length, 0, 'zh-tw missing keys: ' + missing.join(', '));
});

test('es covers every en key', () => {
  const { DICTS } = require('../src/i18n');
  const en = Object.keys(DICTS.en);
  const missing = en.filter((k) => !(k in DICTS.es));
  assert.equal(missing.length, 0, 'es missing keys: ' + missing.join(', '));
});

test('setLocale + t: zh-tw uses Traditional vocab', () => {
  setLocale('zh-tw');
  // 軟體/軟件 vs 软件 — we test for the Traditional form 啟用 vs Simplified 启用
  assert.equal(t('scan.done'), '掃描模式已啟用');
  setLocale('en');
});

test('setLocale + t: es basics', () => {
  setLocale('es');
  assert.equal(t('cmd.unknown', { cmd: 'foo' }), 'Comando no encontrado: foo');
  assert.equal(t('boot.ready'), 'Sistema listo.');
  setLocale('en');
});

test('detectLocale routes zh_TW -> zh-tw', () => {
  const { detectLocale } = require('../src/i18n');
  const orig = process.env.LANG;
  const origTQ = process.env.TERMINAL_QUEST_LANG;
  delete process.env.TERMINAL_QUEST_LANG;
  process.env.LANG = 'zh_TW.UTF-8';
  try {
    assert.equal(detectLocale(), 'zh-tw');
  } finally {
    if (orig === undefined) delete process.env.LANG; else process.env.LANG = orig;
    if (origTQ !== undefined) process.env.TERMINAL_QUEST_LANG = origTQ;
  }
});

test('detectLocale routes es_ES -> es', () => {
  const { detectLocale } = require('../src/i18n');
  const orig = process.env.LANG;
  const origTQ = process.env.TERMINAL_QUEST_LANG;
  delete process.env.TERMINAL_QUEST_LANG;
  process.env.LANG = 'es_ES.UTF-8';
  try {
    assert.equal(detectLocale(), 'es');
  } finally {
    if (orig === undefined) delete process.env.LANG; else process.env.LANG = orig;
    if (origTQ !== undefined) process.env.TERMINAL_QUEST_LANG = origTQ;
  }
});

test('detectLocale: plain zh prefix still routes to Simplified zh', () => {
  const { detectLocale } = require('../src/i18n');
  const orig = process.env.LANG;
  const origTQ = process.env.TERMINAL_QUEST_LANG;
  delete process.env.TERMINAL_QUEST_LANG;
  process.env.LANG = 'zh_CN.UTF-8';
  try {
    assert.equal(detectLocale(), 'zh');
  } finally {
    if (orig === undefined) delete process.env.LANG; else process.env.LANG = orig;
    if (origTQ !== undefined) process.env.TERMINAL_QUEST_LANG = origTQ;
  }
});
