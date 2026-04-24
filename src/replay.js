/**
 * @module replay
 * @description Lightweight replay recorder + player.
 *
 * Each command run in the game can be appended as a replay event:
 *   { t: <monotonic ms>, type: 'command'|'unlock'|'level'|'note', payload: ... }
 *
 * Recorder is just an append-only ring buffer stored inside the save
 * envelope's `state.replay` array. We cap entries to a hard ceiling so
 * a long playthrough can't bloat saves past the 1 MiB warn.
 *
 * Player is intentionally text-only — it prints the recorded events at
 * a configurable speed (delay in ms) and does NOT rerun them against
 * the live game. Running a replay must never mutate the real save.
 */

'use strict';

const DEFAULT_CAP = 500;
const DEFAULT_DELAY = 40;

/**
 * Maintain an in-memory list that is persisted into gameState.replay.
 * The gameState reference is live — we mutate through it.
 */
class ReplayRecorder {
  /**
   * @param {object} gameState
   * @param {object} [opts]
   * @param {number} [opts.cap]
   */
  constructor(gameState, opts = {}) {
    this.gameState = gameState;
    this.cap = Math.max(50, Math.min(5000, opts.cap || DEFAULT_CAP));
    if (!Array.isArray(gameState.replay)) gameState.replay = [];
    this.start = Date.now();
  }

  /**
   * Record an event. `type` is a short tag ("command"/"unlock"/...),
   * `payload` is any JSON-safe value.
   */
  record(type, payload) {
    if (!type) return;
    const buf = this.gameState.replay;
    buf.push({
      t: Date.now() - this.start,
      type: String(type),
      payload: sanitise(payload)
    });
    while (buf.length > this.cap) buf.shift();
  }

  clear() {
    this.gameState.replay = [];
  }

  /**
   * Return a plain-object copy - safe to write to disk.
   */
  snapshot() {
    return Array.from(this.gameState.replay || []);
  }
}

/**
 * Strip anything that won't round-trip through JSON safely so the
 * replay buffer cannot hold references, functions or large buffers.
 */
function sanitise(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.slice(0, 32).map(sanitise);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'function') continue;
      out[k] = sanitise(val);
    }
    return out;
  }
  return String(v);
}

/**
 * Render a single replay event as a line. Pure.
 *
 * @param {{t:number,type:string,payload:any}} ev
 * @returns {string}
 */
function formatEvent(ev) {
  if (!ev || typeof ev !== 'object') return '';
  const t = formatClock(ev.t || 0);
  switch (ev.type) {
    case 'command': return `[${t}] $ ${String(ev.payload || '')}`;
    case 'unlock':  return `[${t}] * achievement ${String(ev.payload || '')}`;
    case 'level':   return `[${t}] ^ level up -> ${String(ev.payload || '')}`;
    case 'note':    return `[${t}] . ${String(ev.payload || '')}`;
    default:        return `[${t}] ${ev.type} ${JSON.stringify(ev.payload)}`;
  }
}

function formatClock(ms) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Play a recorded replay. Returns a promise that resolves when done.
 *
 * @param {Array} buffer recorded events
 * @param {object} [opts]
 * @param {Function} [opts.write]   sink (defaults to console.log)
 * @param {number}   [opts.delay]   ms between lines (set 0 to dump instantly)
 * @param {Function} [opts.sleepFn] override setTimeout (tests)
 * @returns {Promise<{lines: number}>}
 */
async function playReplay(buffer, opts = {}) {
  const write = opts.write || ((l) => console.log(l));
  const delay = Math.max(0, Math.min(1000, opts.delay != null ? opts.delay : DEFAULT_DELAY));
  const sleepFn = opts.sleepFn || ((n) => new Promise((r) => setTimeout(r, n)));
  if (!Array.isArray(buffer) || buffer.length === 0) {
    write('(no replay events recorded)');
    return { lines: 0 };
  }
  for (const ev of buffer) {
    write(formatEvent(ev));
    if (delay > 0) await sleepFn(delay);
  }
  write('-- end of replay --');
  return { lines: buffer.length };
}

/**
 * Load a replay from a slot (uses the save module) without touching
 * the running game state. Returns the events array or null.
 */
function loadReplayFromSlot(slot, saveMod) {
  const payload = saveMod.load(slot);
  if (!payload || !payload.state) return null;
  return Array.isArray(payload.state.replay) ? payload.state.replay : [];
}

module.exports = {
  ReplayRecorder,
  playReplay,
  formatEvent,
  sanitise,
  loadReplayFromSlot,
  DEFAULT_CAP,
  DEFAULT_DELAY
};
