/**
 * @module terminal
 * @description Cross-platform terminal capability detection.
 *
 * Detects colour depth, TTY status, platform and decides whether we
 * should degrade to ASCII-only output. Honours the common opt-outs:
 *   - `NO_COLOR`          (https://no-color.org)
 *   - `--no-color` flag   (in argv)
 *   - `FORCE_COLOR`       (override — 0 disables, 1+ forces level)
 *   - `COLORTERM=truecolor` | `24bit` enables 16M colours
 *   - `TERM=dumb`         forces plaintext
 *
 * The result is exposed via `getCapabilities()` and is memoised so
 * modules can poll it freely without re-scanning env vars.
 *
 * ASCII decorators are used when colour is unavailable so the output
 * remains unambiguous in CI logs, pipes and early-Windows terminals.
 */

'use strict';

let _cached = null;

/**
 * Compute terminal capabilities once and cache.
 *
 * @returns {{
 *   isTTY: boolean,
 *   platform: string,
 *   isWindows: boolean,
 *   colorLevel: 0|1|2|3,
 *   supportsColor: boolean,
 *   supportsUnicode: boolean,
 *   term: string
 * }}
 */
function getCapabilities() {
  if (_cached) return _cached;
  _cached = detect();
  return _cached;
}

/**
 * Force re-detection (primarily for tests).
 *
 * @returns {object} refreshed capabilities
 */
function refresh() {
  _cached = null;
  return getCapabilities();
}

function detect() {
  const env = process.env || {};
  const argv = process.argv || [];
  const platform = process.platform;
  const isWindows = platform === 'win32';
  const isTTY = !!(process.stdout && process.stdout.isTTY);
  const term = env.TERM || '';

  // explicit opt-outs first
  const hasNoColorFlag = argv.includes('--no-color') || argv.includes('--no-colors');
  const noColorEnv = env.NO_COLOR !== undefined && env.NO_COLOR !== '';
  const dumbTerm = term === 'dumb';

  // explicit force
  let forceLevel = null;
  if (env.FORCE_COLOR !== undefined) {
    const n = parseInt(env.FORCE_COLOR, 10);
    if (!Number.isNaN(n)) forceLevel = Math.max(0, Math.min(3, n));
    else if (env.FORCE_COLOR === 'true') forceLevel = 1;
    else if (env.FORCE_COLOR === 'false') forceLevel = 0;
  }

  let colorLevel;
  if (hasNoColorFlag || noColorEnv) {
    // NO_COLOR is spec-mandated to win even over FORCE_COLOR.
    colorLevel = 0;
  } else if (forceLevel !== null) {
    // FORCE_COLOR beats TERM=dumb and non-TTY piping.
    colorLevel = forceLevel;
  } else if (dumbTerm) {
    colorLevel = 0;
  } else if (!isTTY) {
    // piped / CI — keep plaintext unless someone forced colour above
    colorLevel = 0;
  } else if (env.COLORTERM === 'truecolor' || env.COLORTERM === '24bit') {
    colorLevel = 3;
  } else if (/-256(color)?$/i.test(term)) {
    colorLevel = 2;
  } else if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(term)) {
    colorLevel = 1;
  } else if (isWindows) {
    // Modern Windows 10 1511+ supports ANSI; older CMD does not.
    // We probe via build number when available.
    const rel = (require('os').release && require('os').release()) || '';
    const major = parseInt(rel.split('.')[0], 10);
    colorLevel = major >= 10 ? 2 : 0;
  } else {
    colorLevel = isTTY ? 1 : 0;
  }

  // Unicode support: most modern terminals are UTF-8. The one big
  // exception is legacy Windows CMD, where box-drawing can glitch.
  // We stay conservative and only trust UTF-8 when the env says so.
  const supportsUnicode = (() => {
    if (isWindows) {
      // cmd.exe code page 65001 = UTF-8; PowerShell modern defaults OK.
      return !!env.WT_SESSION || env.ConEmuTask || env.TERM_PROGRAM;
    }
    const lc = (env.LC_ALL || env.LC_CTYPE || env.LANG || '').toLowerCase();
    return lc.includes('utf');
  })();

  return {
    isTTY,
    platform,
    isWindows,
    colorLevel,
    supportsColor: colorLevel > 0,
    supportsUnicode,
    term
  };
}

/**
 * ASCII decorator palette used when colour is unavailable. Produces
 * unambiguous markers such as `[WARN]`, `>>`, `*` that survive being
 * piped through `less` or into a log file.
 *
 * @type {Record<string,(s:string)=>string>}
 */
const ASCII_DECORATORS = {
  primary: (s) => s,
  secondary: (s) => s,
  accent: (s) => s,
  warning: (s) => `[WARN] ${s}`,
  error: (s) => `[ERROR] ${s}`,
  success: (s) => `[OK] ${s}`,
  info: (s) => `>> ${s}`,
  dim: (s) => s,
  white: (s) => s,
  bold: (s) => s,
  gold: (s) => `* ${s}`,
  purple: (s) => s,
  orange: (s) => s
};

module.exports = { getCapabilities, refresh, ASCII_DECORATORS };
