'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { tokenize } = require('../src/commands');

test('tokenize: simple command', () => {
  assert.deepEqual(tokenize('ls -a /home/user'), ['ls', '-a', '/home/user']);
});

test('tokenize: collapses whitespace', () => {
  assert.deepEqual(tokenize('  ls    -a   '), ['ls', '-a']);
});

test('tokenize: double-quoted argument with spaces', () => {
  assert.deepEqual(tokenize('echo "hello world"'), ['echo', 'hello world']);
});

test('tokenize: single quotes', () => {
  assert.deepEqual(tokenize("grep 'needle in hay' file.txt"), ['grep', 'needle in hay', 'file.txt']);
});

test('tokenize: escape inside unquoted word', () => {
  assert.deepEqual(tokenize('echo a\\ b'), ['echo', 'a b']);
});

test('tokenize: empty input yields empty list', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize('   '), []);
});

test('tokenize: tabs are separators', () => {
  assert.deepEqual(tokenize('ls\t-a\thome'), ['ls', '-a', 'home']);
});
