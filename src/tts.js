/**
 * @module tts
 * @description Optional, opt-in text-to-speech for NPC dialogue lines.
 *
 * Design constraints (deliberate, do not "improve" without checking):
 *   - NEVER add a runtime dependency. We only shell out to native binaries
 *     using child_process.
 *   - macOS    -> `say <text>`
 *   - Linux    -> `espeak <text>`     (only if it's on PATH)
 *   - Windows  -> PowerShell SAPI:    `powershell -Command "Add-Type ...
 *                 [System.Speech.Synthesis.SpeechSynthesizer]::new().Speak(...)"`
 *   - Unknown / probe failed -> the engine downgrades to a no-op so callers
 *     can stay simple.
 *
 * Public API:
 *   detectEngine()  -> { name: 'say'|'espeak'|'sapi'|'none', binary?: string }
 *   createTTS({enabled, engine?}) -> { enabled, engine, speak(text), close() }
 *
 * Tests can inject a mock engine via `createTTS({ engine: { name: 'mock', spawn: fn } })`.
 * The default engine never blocks — speak() returns immediately and any spawn
 * failure is silently swallowed so the game loop never breaks.
 */

'use strict';

const { spawn, spawnSync } = require('child_process');
const os = require('os');

/**
 * Probe the host platform for a usable TTS engine.
 *
 * @returns {{ name: string, binary?: string }} engine info
 */
function detectEngine() {
  const platform = os.platform();
  if (platform === 'darwin') {
    // `say` ships with macOS; we still verify it's on PATH so a stripped-down
    // image (rare) doesn't blow up.
    if (hasBinary('say')) return { name: 'say', binary: 'say' };
    return { name: 'none' };
  }
  if (platform === 'linux') {
    if (hasBinary('espeak')) return { name: 'espeak', binary: 'espeak' };
    if (hasBinary('espeak-ng')) return { name: 'espeak', binary: 'espeak-ng' };
    return { name: 'none' };
  }
  if (platform === 'win32') {
    // PowerShell is essentially always present on supported Windows versions.
    if (hasBinary('powershell.exe') || hasBinary('powershell')) {
      return { name: 'sapi', binary: 'powershell' };
    }
    return { name: 'none' };
  }
  return { name: 'none' };
}

/**
 * `command -v` style probe. Uses `which`/`where` and never throws.
 *
 * @param {string} bin
 * @returns {boolean}
 */
function hasBinary(bin) {
  try {
    const probe = os.platform() === 'win32' ? 'where' : 'which';
    const r = spawnSync(probe, [bin], { stdio: 'ignore' });
    return r && r.status === 0;
  } catch (_) {
    return false;
  }
}

/**
 * Sanitise text before passing to a shell binary. We strip ANSI escapes,
 * cap length, and remove anything outside a conservative printable set.
 * The result is always safe to pass as an argv entry (we never use shell:true).
 *
 * @param {string} input
 * @returns {string}
 */
function sanitise(input) {
  if (input === null || input === undefined) return '';
  let s = String(input);
  // Strip ANSI escape sequences.
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  // Drop other C0 / C1 control bytes.
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ');
  // Cap length so a runaway dialog cannot tie up the speaker.
  if (s.length > 500) s = s.slice(0, 500) + '...';
  return s.trim();
}

/**
 * Build a TTS adapter. The returned object always has the same shape, even
 * when the engine is `none` — speak() simply no-ops in that case. This keeps
 * caller code free of `if (tts) tts.speak(...)` clutter.
 *
 * @param {{enabled?: boolean, engine?: object}} [options]
 * @returns {{ enabled: boolean, engine: object, speak: Function, close: Function }}
 */
function createTTS(options) {
  const opts = options || {};
  const engine = opts.engine || detectEngine();
  const enabled = !!opts.enabled && engine.name !== 'none';
  // Track child handles so close() can stop any straggling speech.
  const inflight = new Set();

  function speak(text) {
    if (!enabled) return { spoken: false, reason: 'disabled' };
    const cleaned = sanitise(text);
    if (!cleaned) return { spoken: false, reason: 'empty' };
    try {
      let child = null;
      if (engine.name === 'mock') {
        // test injection: engine.spawn gets called with the cleaned text.
        if (typeof engine.spawn === 'function') engine.spawn(cleaned);
        return { spoken: true, engine: 'mock' };
      }
      if (engine.name === 'say') {
        child = spawn(engine.binary || 'say', [cleaned], { stdio: 'ignore', detached: false });
      } else if (engine.name === 'espeak') {
        child = spawn(engine.binary || 'espeak', [cleaned], { stdio: 'ignore', detached: false });
      } else if (engine.name === 'sapi') {
        const escaped = cleaned.replace(/'/g, "''");
        const psCmd = `Add-Type -AssemblyName System.Speech; ` +
          `(New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${escaped}')`;
        child = spawn(engine.binary || 'powershell', ['-NoProfile', '-Command', psCmd],
          { stdio: 'ignore', detached: false });
      } else {
        return { spoken: false, reason: 'unknown-engine' };
      }
      if (child && typeof child.on === 'function') {
        inflight.add(child);
        child.on('error', () => { inflight.delete(child); });
        child.on('exit', () => { inflight.delete(child); });
      }
      return { spoken: true, engine: engine.name };
    } catch (_) {
      // Never propagate — TTS must not break the REPL.
      return { spoken: false, reason: 'spawn-failed' };
    }
  }

  function close() {
    for (const child of inflight) {
      try { child.kill('SIGTERM'); } catch (_) { /* ignore */ }
    }
    inflight.clear();
  }

  return { enabled, engine, speak, close };
}

module.exports = {
  detectEngine,
  createTTS,
  sanitise,
  hasBinary
};
