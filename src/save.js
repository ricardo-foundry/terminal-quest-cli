// ============================================
// Terminal Quest CLI - Save/Load
// ============================================
// JSON saves with schema version. Multi-slot, stored under ~/.terminal-quest/saves/
// Legacy single-file save at ~/.terminal-quest-save.json is auto-migrated.

const fs = require('fs');
const path = require('path');
const os = require('os');

const SCHEMA_VERSION = 2;
const BASE_DIR = path.join(os.homedir(), '.terminal-quest');
const SAVE_DIR = path.join(BASE_DIR, 'saves');
const LEGACY_PATH = path.join(os.homedir(), '.terminal-quest-save.json');
const DEFAULT_SLOT = 'default';

function ensureDirs() {
  if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
  }
}

function slotPath(slot) {
  const safe = String(slot).replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (!safe) throw new Error('invalid slot name');
  return path.join(SAVE_DIR, safe + '.json');
}

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

function save(slot, state) {
  ensureDirs();
  const p = slotPath(slot || DEFAULT_SLOT);
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    slot: slot || DEFAULT_SLOT,
    savedAt: Date.now(),
    state
  };
  // atomic-ish write
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, p);
  return p;
}

function load(slot) {
  const p = slotPath(slot || DEFAULT_SLOT);
  if (!fs.existsSync(p)) {
    // try legacy migration once
    if ((slot || DEFAULT_SLOT) === DEFAULT_SLOT && migrateLegacy() && fs.existsSync(p)) {
      // migrated
    } else {
      return null;
    }
  }
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw);
  return migrate(parsed);
}

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
  return payload;
}

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
            exp: parsed.state && parsed.state.exp
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

function deleteSlot(slot) {
  const p = slotPath(slot);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}

module.exports = {
  SCHEMA_VERSION,
  SAVE_DIR,
  BASE_DIR,
  DEFAULT_SLOT,
  save,
  load,
  listSlots,
  deleteSlot,
  migrateLegacy,
  slotPath
};
