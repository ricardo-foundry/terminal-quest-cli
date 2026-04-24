'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Redirect HOME before requiring save so all writes go to a temp dir.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-cloud-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const saveMod = require('../src/save');
const { GistBackend, MemoryBackend, CloudBackend } = require('../src/cloud');

before(() => {
  // seed a save slot we can push/pull
  saveMod.save('cloudslot', { level: 2, exp: 100 });
});

after(() => {
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

test('CloudBackend is abstract - push/pull/list throw on base class', async () => {
  const b = new CloudBackend('x');
  await assert.rejects(() => b.push('a'));
  await assert.rejects(() => b.pull('a'));
  await assert.rejects(() => b.list());
});

test('MemoryBackend round-trips a slot', async () => {
  const mem = new MemoryBackend();
  const pushed = await mem.push('cloudslot');
  assert.equal(pushed.ok, true);
  const listed = await mem.list();
  assert.equal(listed.ok, true);
  assert.ok(listed.items.some((i) => i.slot === 'cloudslot'));
  const pulled = await mem.pull('cloudslot');
  assert.equal(pulled.ok, true);
  assert.ok(pulled.json.includes('"level": 2') || pulled.json.includes('"level":2'));
});

test('MemoryBackend reports missing slot on pull', async () => {
  const mem = new MemoryBackend();
  const r = await mem.pull('nope');
  assert.equal(r.ok, false);
  assert.ok(/no cloud save/.test(r.error));
});

test('GistBackend refuses operations with no token', async () => {
  const prev = process.env.GH_TOKEN;
  delete process.env.GH_TOKEN;
  const g = new GistBackend();
  const r = await g.push('cloudslot');
  assert.equal(r.ok, false);
  assert.ok(/GH_TOKEN/.test(r.error));
  if (prev !== undefined) process.env.GH_TOKEN = prev;
});

test('GistBackend push: uses mocked fetch and reports id/url on 201', async () => {
  const calls = [];
  const fakeFetch = async (opts) => {
    calls.push(opts);
    return { status: 201, body: JSON.stringify({ id: 'abc123', html_url: 'https://gist.github.com/abc123' }) };
  };
  const g = new GistBackend({ token: 'test-token', fetch: fakeFetch });
  const r = await g.push('cloudslot');
  assert.equal(r.ok, true);
  assert.equal(r.id, 'abc123');
  assert.ok(r.url.includes('gist.github.com'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].body.includes('"terminal-quest-cloudslot.json"'));
});

test('GistBackend push: surfaces non-2xx as an error', async () => {
  const fakeFetch = async () => ({ status: 401, body: '{"message":"Bad credentials"}' });
  const g = new GistBackend({ token: 'bad', fetch: fakeFetch });
  const r = await g.push('cloudslot');
  assert.equal(r.ok, false);
  assert.ok(/401/.test(r.error));
});

test('GistBackend list: filters to slots whose filename starts with our prefix', async () => {
  const fakeFetch = async () => ({
    status: 200,
    body: JSON.stringify([
      { id: 'g1', updated_at: '2026-01-01T00:00:00Z', html_url: 'u1', files: { 'terminal-quest-default.json': {} } },
      { id: 'g2', updated_at: '2026-01-02T00:00:00Z', html_url: 'u2', files: { 'something-else.txt': {} } },
      { id: 'g3', updated_at: '2026-01-03T00:00:00Z', html_url: 'u3', files: { 'terminal-quest-slot2.json': {} } }
    ])
  });
  const g = new GistBackend({ token: 'tok', fetch: fakeFetch });
  const r = await g.list();
  assert.equal(r.ok, true);
  const slots = r.items.map((i) => i.slot).sort();
  assert.deepEqual(slots, ['default', 'slot2']);
});

test('GistBackend pull: stitches list + get into a single operation', async () => {
  let stage = 'list';
  const fakeFetch = async (opts) => {
    if (stage === 'list') {
      stage = 'get';
      return {
        status: 200,
        body: JSON.stringify([{
          id: 'g1', updated_at: '2026-01-01T00:00:00Z', html_url: 'u1',
          files: { 'terminal-quest-cloudslot.json': {} }
        }])
      };
    }
    return {
      status: 200,
      body: JSON.stringify({ files: { 'terminal-quest-cloudslot.json': { content: '{"ok":1}' } } })
    };
  };
  const g = new GistBackend({ token: 'tok', fetch: fakeFetch });
  const r = await g.pull('cloudslot');
  assert.equal(r.ok, true);
  assert.equal(r.json, '{"ok":1}');
});

test('GistBackend pull: returns error when slot not in cloud list', async () => {
  const fakeFetch = async () => ({
    status: 200,
    body: JSON.stringify([])
  });
  const g = new GistBackend({ token: 'tok', fetch: fakeFetch });
  const r = await g.pull('ghost');
  assert.equal(r.ok, false);
  assert.ok(/no cloud save/.test(r.error));
});
