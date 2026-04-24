/**
 * @module cloud
 * @description Experimental cloud save backends.
 *
 * STATUS: EXPERIMENTAL. Not enabled by default. Nothing in the main
 * game loop talks to this module - it is invoked only by the
 * `--cloud push/pull/list` CLI flag.
 *
 * Design goal: make it trivial to add a new backend (S3, Dropbox, whatever).
 * Every backend implements the `CloudBackend` protocol:
 *
 *   push(slot) -> { ok: bool, id?: string, url?: string, error?: string }
 *   pull(slot) -> { ok: bool, bytes: number, json?: string, error?: string }
 *   list()     -> { ok: bool, items: Array<{slot, updatedAt, id?, url?}>, error?: string }
 *
 * Security & privacy: see docs/CLOUD_SAVE.md. We intentionally do NOT
 * read any credentials from the save file or home directory - they must
 * come from the environment (GH_TOKEN for the gist backend), and the
 * user has to pass `--cloud` explicitly to opt in.
 */

'use strict';

const saveMod = require('./save');

// --------- generic backend contract ---------
/**
 * @typedef {Object} CloudBackendResult
 * @property {boolean} ok
 * @property {string} [id]
 * @property {string} [url]
 * @property {string} [error]
 */

/**
 * Base class - subclasses override push/pull/list.
 * Kept tiny on purpose; no persistent state here.
 */
class CloudBackend {
  constructor(name) { this.name = name || 'abstract'; }
  async push(/* slot */) { throw new Error(`${this.name}.push not implemented`); }
  async pull(/* slot */) { throw new Error(`${this.name}.pull not implemented`); }
  async list() { throw new Error(`${this.name}.list not implemented`); }
}

// --------- GitHub Gist backend ---------

const GIST_API = 'https://api.github.com/gists';
const GIST_UA = 'terminal-quest-cli';

/**
 * Minimal HTTPS request wrapper. We swap this for a mock in tests so the
 * backend is entirely offline-testable.
 *
 * @param {object} opts { method, url, token, body? }
 * @returns {Promise<{ status:number, body:string }>}
 */
function defaultFetch(opts) {
  // Lazy-require so requiring this module is cheap.
  const https = require('https');
  const { URL } = require('url');
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(opts.url);
      const req = https.request({
        method: opts.method || 'GET',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'User-Agent': GIST_UA,
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${opts.token}`,
          ...(opts.body ? { 'Content-Type': 'application/json' } : {})
        }
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

class GistBackend extends CloudBackend {
  /**
   * @param {object} opts
   * @param {string} [opts.token] GH_TOKEN (falls back to env var)
   * @param {Function} [opts.fetch] override for tests
   * @param {string} [opts.filenamePrefix] defaults to "terminal-quest-"
   */
  constructor(opts = {}) {
    super('gist');
    this.token = opts.token || process.env.GH_TOKEN || '';
    this.fetch = opts.fetch || defaultFetch;
    this.filenamePrefix = opts.filenamePrefix || 'terminal-quest-';
  }

  _requireToken() {
    if (!this.token) return { ok: false, error: 'GH_TOKEN missing (set GH_TOKEN env var)' };
    return null;
  }

  _filename(slot) {
    return `${this.filenamePrefix}${slot}.json`;
  }

  async push(slot) {
    const need = this._requireToken();
    if (need) return need;
    const json = saveMod.exportSlot(slot);
    if (!json) return { ok: false, error: `no save in slot "${slot}"` };
    const files = {};
    files[this._filename(slot)] = { content: json };
    const body = JSON.stringify({
      description: `terminal-quest save for slot "${slot}"`,
      public: false,
      files
    });
    let res;
    try {
      res = await this.fetch({ method: 'POST', url: GIST_API, token: this.token, body });
    } catch (e) {
      return { ok: false, error: `network error: ${e.message}` };
    }
    if (res.status >= 200 && res.status < 300) {
      let parsed;
      try { parsed = JSON.parse(res.body); } catch (_) { parsed = {}; }
      return { ok: true, id: parsed.id, url: parsed.html_url };
    }
    return { ok: false, error: `gist api returned ${res.status}` };
  }

  async pull(slot) {
    const need = this._requireToken();
    if (need) return need;
    const listRes = await this.list();
    if (!listRes.ok) return { ok: false, error: listRes.error };
    const entry = listRes.items.find((i) => i.slot === slot);
    if (!entry) return { ok: false, error: `no cloud save found for slot "${slot}"` };
    let res;
    try {
      res = await this.fetch({ method: 'GET', url: `${GIST_API}/${entry.id}`, token: this.token });
    } catch (e) {
      return { ok: false, error: `network error: ${e.message}` };
    }
    if (res.status >= 200 && res.status < 300) {
      let parsed;
      try { parsed = JSON.parse(res.body); } catch (_) { return { ok: false, error: 'gist body was not json' }; }
      const file = parsed.files && parsed.files[this._filename(slot)];
      if (!file || typeof file.content !== 'string') return { ok: false, error: 'gist missing expected file' };
      return { ok: true, bytes: file.content.length, json: file.content };
    }
    return { ok: false, error: `gist api returned ${res.status}` };
  }

  async list() {
    const need = this._requireToken();
    if (need) return { ok: false, items: [], error: need.error };
    let res;
    try {
      res = await this.fetch({ method: 'GET', url: GIST_API, token: this.token });
    } catch (e) {
      return { ok: false, items: [], error: `network error: ${e.message}` };
    }
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, items: [], error: `gist api returned ${res.status}` };
    }
    let parsed;
    try { parsed = JSON.parse(res.body); } catch (_) { return { ok: false, items: [], error: 'gist list body was not json' }; }
    if (!Array.isArray(parsed)) return { ok: false, items: [], error: 'gist list was not an array' };
    const items = [];
    const prefix = this.filenamePrefix;
    for (const g of parsed) {
      if (!g || !g.files) continue;
      for (const fname of Object.keys(g.files)) {
        if (fname.startsWith(prefix) && fname.endsWith('.json')) {
          const slot = fname.slice(prefix.length, -5);
          items.push({
            slot,
            updatedAt: g.updated_at || g.created_at,
            id: g.id,
            url: g.html_url
          });
        }
      }
    }
    return { ok: true, items };
  }
}

// --------- in-memory backend (for tests) ---------
class MemoryBackend extends CloudBackend {
  constructor() {
    super('memory');
    this._store = new Map();
  }
  async push(slot) {
    const json = saveMod.exportSlot(slot);
    if (!json) return { ok: false, error: `no save in slot "${slot}"` };
    this._store.set(slot, { json, updatedAt: new Date().toISOString() });
    return { ok: true, id: 'mem-' + slot, url: 'memory://' + slot };
  }
  async pull(slot) {
    if (!this._store.has(slot)) return { ok: false, error: `no cloud save for slot "${slot}"` };
    const entry = this._store.get(slot);
    return { ok: true, bytes: entry.json.length, json: entry.json };
  }
  async list() {
    const items = Array.from(this._store.entries()).map(([slot, v]) => ({
      slot, updatedAt: v.updatedAt, id: 'mem-' + slot, url: 'memory://' + slot
    }));
    return { ok: true, items };
  }
}

module.exports = {
  CloudBackend,
  GistBackend,
  MemoryBackend
};
