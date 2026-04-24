/**
 * @module save
 * @description Multi-slot JSON save/load with schemaVersion migrations
 *   and corruption-resilient loading.
 *
 * On-disk layout (all inside `~/.terminal-quest/`):
 *   saves/<slot>.json              -- one file per slot (v2 format)
 *   saves/<slot>.json.bak          -- automatic backup of a corrupted file
 * And a legacy layout at `~/.terminal-quest-save.json` from v1.
 *
 * Each save file is wrapped:
 *     { schemaVersion, slot, savedAt, state }
 *
 * The `migrate()` helper bumps older payloads to the current schema so
 * loading an old save never crashes the game. Any slot whose on-disk
 * bytes fail to parse is renamed with `.bak.<timestamp>` suffix and
 * `load()` returns `null`, allowing the caller to start fresh.
 *
 * Cross-platform notes:
 *   - Path handling uses `path` (the OS-native module) so Windows
 *     backslashes are respected for the real filesystem.
 *   - Inside the game's virtual FS we use `path.posix` exclusively
 *     (see `normalizePath` in game.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SCHEMA_VERSION = 2;
const BASE_DIR = path.join(os.homedir(), '.terminal-quest');
const SAVE_DIR = path.join(BASE_DIR, 'saves');
const LEGACY_PATH = path.join(os.homedir(), '.terminal-quest-save.json');
const DEFAULT_SLOT = 'default';
const MAX_SAVE_BYTES = 1024 * 1024; // 1 MiB soft cap, warn past this

/**
 * Minimal schema — we don't enforce types on every nested key,
 * only on the top-level wrapper. This keeps the validator tolerant
 * of forward-compatible state additions.
 *
 * @param {any} payload
 * @returns {boolean}
 */
function isValidSave(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.schemaVersion !== 'number') return false;
  if (typeof payload.state !== 'object' || payload.state === null) return false;
  return true;
}

function ensureDirs() {
  if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
  }
}

/**
 * Map a slot name to the absolute file path on disk. The slot is
 * sanitised down to `[A-Za-z0-9_-]` so path traversal or
 * platform-invalid characters (`\0`, `:`, etc.) cannot escape the
 * save directory.
 *
 * @param {string} slot
 * @returns {string}
 * @throws {Error} if the sanitised slot is empty
 */
function slotPath(slot) {
  const safe = String(slot).replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (!safe) throw new Error('invalid slot name');
  return path.join(SAVE_DIR, safe + '.json');
}

/**
 * Move a corrupted save to a `.bak.<timestamp>` companion so the
 * user can inspect or recover it later.
 *
 * @param {string} filePath path to the broken save
 * @returns {string|null} the backup path, or null on failure
 */
function backupCorrupt(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const dest = filePath + '.bak.' + Date.now();
    fs.renameSync(filePath, dest);
    return dest;
  } catch {
    return null;
  }
}

/**
 * Migrate the legacy single-file save into the slotted directory.
 *
 * @returns {boolean} true if a migration happened
 */
function migrateLegacy() {
  try {
    if (!fs.existsSync(LEGACY_PATH)) return false;
    ensureDirs();
    const dest = slotPath(DEFAULT_SLOT);
    if (fs.existsSync(dest)) return false;
    const raw = fs.readFileSync(LEGACY_PATH, 'utf8');
    const data = JSON.parse(raw);
    const wrapped = {
      schemaVersion: SCHEMA_VERSION,
      slot: DEFAULT_SLOT,
      savedAt: Date.now(),
      state: data
    };
    fs.writeFileSync(dest, JSON.stringify(wrapped, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist a game-state snapshot under the given slot.
 *
 * @param {string} slot slot identifier (sanitised on use)
 * @param {object} state game state tree
 * @returns {{ path: string, bytes: number, warn: string|null }}
 */
function save(slot, state) {
  ensureDirs();
  const p = slotPath(slot || DEFAULT_SLOT);
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    slot: slot || DEFAULT_SLOT,
    savedAt: Date.now(),
    state
  };
  const serialised = JSON.stringify(payload, null, 2);
  const bytes = Buffer.byteLength(serialised, 'utf8');
  // atomic-ish write — tmp file on the same fs, then rename.
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, serialised);
  fs.renameSync(tmp, p);
  const warn = bytes > MAX_SAVE_BYTES
    ? `save grew to ${(bytes / 1024).toFixed(1)} KiB (>${MAX_SAVE_BYTES / 1024} KiB); consider export/trim`
    : null;
  return { path: p, bytes, warn };
}

/**
 * Load and (if needed) migrate a slot. Returns `null` if the file
 * does not exist. On a parse failure the corrupted file is moved
 * aside so the next run starts clean.
 *
 * @param {string} slot
 * @returns {object|null} wrapped save payload, or null
 */
function load(slot) {
  const p = slotPath(slot || DEFAULT_SLOT);
  if (!fs.existsSync(p)) {
    if ((slot || DEFAULT_SLOT) === DEFAULT_SLOT && migrateLegacy() && fs.existsSync(p)) {
      // migrated -> continue
    } else {
      return null;
    }
  }
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // corrupted file — back it up and start fresh
    backupCorrupt(p);
    return null;
  }
  return migrate(parsed);
}

/**
 * Coerce an older / partial payload into the current schema. Payloads
 * without a `schemaVersion` are assumed to be v1 state blobs and get
 * wrapped in v2 envelope.
 *
 * @param {any} payload
 * @returns {object|null}
 */
function migrate(payload) {
  if (!payload || typeof payload !== 'object') return null;
  // unwrap old format (v1 was just the state object)
  if (!payload.schemaVersion) {
    return {
      schemaVersion: SCHEMA_VERSION,
      slot: DEFAULT_SLOT,
      savedAt: Date.now(),
      state: payload
    };
  }
  if (payload.schemaVersion < SCHEMA_VERSION) {
    payload.schemaVersion = SCHEMA_VERSION;
  }
  if (!isValidSave(payload)) {
    return null;
  }
  return payload;
}

/**
 * Enumerate saved slots, newest first.
 *
 * @returns {Array<{slot:string, savedAt:number, schemaVersion:number, level?:number, exp?:number}>}
 */
function listSlots() {
  ensureDirs();
  try {
    return fs.readdirSync(SAVE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const full = path.join(SAVE_DIR, f);
        try {
          const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
          return {
            slot: parsed.slot || f.replace(/\.json$/, ''),
            savedAt: parsed.savedAt || 0,
            schemaVersion: parsed.schemaVersion || 1,
            level: parsed.state && parsed.state.level,
            exp: parsed.state && parsed.state.exp,
            bytes: Buffer.byteLength(fs.readFileSync(full, 'utf8'), 'utf8')
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/**
 * Delete a slot on disk. Safe on missing slots.
 *
 * @param {string} slot
 * @returns {boolean} true if a file was removed
 */
function deleteSlot(slot) {
  const p = slotPath(slot);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}

/**
 * Read a slot's raw JSON — used by CLI `--export-save` so external
 * tools can see the exact envelope without further transforms.
 *
 * @param {string} slot
 * @returns {string|null} serialised JSON, or null
 */
function exportSlot(slot) {
  const p = slotPath(slot || DEFAULT_SLOT);
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Persist an externally-supplied JSON string to a slot after schema
 * validation. Refuses malformed or wildly oversized payloads.
 *
 * @param {string} slot destination slot
 * @param {string} jsonString full envelope JSON
 * @returns {{ path: string, bytes: number } | null}
 */
function importSlot(slot, jsonString) {
  if (typeof jsonString !== 'string') return null;
  if (jsonString.length > MAX_SAVE_BYTES * 4) return null;
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null;
  }
  const migrated = migrate(parsed);
  if (!migrated || !migrated.state) return null;
  return save(slot, migrated.state);
}

module.exports = {
  SCHEMA_VERSION,
  SAVE_DIR,
  BASE_DIR,
  DEFAULT_SLOT,
  MAX_SAVE_BYTES,
  save,
  load,
  listSlots,
  deleteSlot,
  migrateLegacy,
  slotPath,
  exportSlot,
  importSlot,
  isValidSave,
  backupCorrupt
};
