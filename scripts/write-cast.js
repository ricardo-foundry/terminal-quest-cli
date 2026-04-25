#!/usr/bin/env node
/**
 * scripts/write-cast.js
 *
 * Generate `docs/demo.cast` - an asciinema v2 recording hand-authored from
 * a scripted terminal session. We deliberately avoid the node-pty route:
 *
 *   - node-pty is a native module, refuses to build on Windows / some CI
 *     agents without VS buildtools, and would force us to ship it as an
 *     optionalDependency for a docs-only asset.
 *   - child_process.spawn of `terminal-quest --no-boot` inherits our stdin
 *     and requires a TTY to drive raw-mode; not friendly to CI.
 *   - The interesting part of a cast file *is* the event timing, which we
 *     can simulate here deterministically and reproducibly.
 *
 * Output is a strict asciinema v2 JSON file:
 *   line 1 : header object { version: 2, width, height, timestamp, title, env }
 *   line N : [seconds_since_start, "o", chunk]
 *
 * Reference: https://docs.asciinema.org/manual/asciicast/v2/
 *
 * Usage:
 *   node scripts/write-cast.js              # rewrite docs/demo.cast
 *   node scripts/write-cast.js --check      # exit 1 if file is stale
 *   node scripts/write-cast.js --print      # print to stdout (debug)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const WIDTH = 96;
const HEIGHT = 28;
const TYPE_DELAY = 0.055;   // seconds per typed character
const PAUSE_SHORT = 0.30;
const PAUSE_MED = 0.90;
const PAUSE_LONG = 1.60;

const ANSI = {
  reset:   '\x1b[0m',
  dim:     '\x1b[2m',
  bold:    '\x1b[1m',
  green:   '\x1b[32m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  blue:    '\x1b[34m',
  grey:    '\x1b[90m',
  amber:   '\x1b[38;5;214m'
};

const PROMPT = ANSI.magenta + '[Lv.4] ' + ANSI.reset +
  ANSI.green + 'explorer@kimi-os' + ANSI.reset + ':' +
  ANSI.cyan + '~' + ANSI.reset + '$ ';

/**
 * Return an events-building context so callers can append tagged chunks
 * without threading time/events by hand.
 */
function makeCtx() {
  const events = [];
  let t = 0;
  function at(delta, data) {
    t += delta;
    events.push([Number(t.toFixed(3)), 'o', data]);
  }
  function type(str, perChar) {
    const d = typeof perChar === 'number' ? perChar : TYPE_DELAY;
    for (const ch of str) at(d, ch);
  }
  return { events, at, type, getTime: () => t };
}

/**
 * Compose a scripted session. Edit this to change the recording.
 */
function buildEvents() {
  const ctx = makeCtx();
  const { at, type } = ctx;

  // opening splash
  at(0.20, ANSI.grey + '[BIOS v2.1 - KIMI-OS]\r\n' + ANSI.reset);
  at(0.15, '[' + ANSI.green + ' ok ' + ANSI.reset + '] Memory check\r\n');
  at(0.15, '[' + ANSI.green + ' ok ' + ANSI.reset + '] Initializing AI core\r\n');
  at(0.15, '[' + ANSI.green + ' ok ' + ANSI.reset + '] Mounting virtual file system\r\n');
  at(0.25, ANSI.bold + 'System ready.' + ANSI.reset + '\r\n\r\n');
  at(0.20, ANSI.dim + '  > Core modules loaded\r\n' + ANSI.reset);
  at(0.20, ANSI.dim + '  > Type "help" to start your adventure\r\n' + ANSI.reset);
  at(PAUSE_MED, '\r\n' + PROMPT);

  // command 1 - ls
  type('ls');
  at(PAUSE_SHORT, '\r\n');
  at(0.10,
    ANSI.cyan + 'notes/' + ANSI.reset + '   ' +
    'diary.txt   start_here.txt   readme.txt   ' +
    ANSI.grey + '.secret/' + ANSI.reset + '\r\n');
  at(PAUSE_SHORT, PROMPT);

  // command 2 - scan
  type('scan');
  at(PAUSE_SHORT, '\r\n');
  at(0.15, ANSI.yellow + '[scan] revealing hidden entries...' + ANSI.reset + '\r\n');
  at(0.40, '  .secret/    .keychain    .diary.bak\r\n');
  at(PAUSE_SHORT, PROMPT);

  // command 3 - cd /world/lab
  type('cd /world/lab');
  at(PAUSE_SHORT, '\r\n');
  at(0.15, ANSI.dim + 'you step into the abandoned research lab. the fan hums.' + ANSI.reset + '\r\n');
  at(PAUSE_SHORT,
    ANSI.magenta + '[Lv.4] ' + ANSI.reset +
    ANSI.green + 'explorer@kimi-os' + ANSI.reset + ':' +
    ANSI.cyan + '/world/lab' + ANSI.reset + '$ ');

  // command 4 - talk engineer
  type('talk engineer');
  at(PAUSE_SHORT, '\r\n');
  at(0.20, ANSI.yellow + 'engineer (friendly):' + ANSI.reset + ' "Take this. The cipher is old, but the message is not."\r\n');
  at(0.15, '  ' + ANSI.green + '+' + ANSI.reset + ' received: cipher.enc\r\n');
  at(0.15, '  ' + ANSI.cyan + '+25 EXP' + ANSI.reset + ' (kindness +1)\r\n');
  at(PAUSE_SHORT,
    ANSI.magenta + '[Lv.4] ' + ANSI.reset +
    ANSI.green + 'explorer@kimi-os' + ANSI.reset + ':' +
    ANSI.cyan + '/world/lab' + ANSI.reset + '$ ');

  // command 5 - run morse
  type('run morse');
  at(PAUSE_SHORT, '\r\n');
  at(0.20, ANSI.bold + 'Morse decode' + ANSI.reset + ' - Decode the message (single word). Type q to quit.\r\n\r\n');
  at(0.25, '  -.- .. -- ..\r\n\r\n');
  at(PAUSE_SHORT, 'answer 1/3 (or "hint"): ');
  type('KIMI', 0.12);
  at(PAUSE_SHORT, '\r\n');
  at(0.20, ANSI.green + 'decoded!' + ANSI.reset + '  ' + ANSI.cyan + '+80 EXP' + ANSI.reset + '\r\n\r\n');
  at(0.20, ANSI.yellow + '*** ACHIEVEMENT UNLOCKED ***' + ANSI.reset + '\r\n');
  at(0.10, '  +-------------------------+\r\n');
  at(0.05, '  |  📡  Morse Master        |\r\n');
  at(0.05, '  |  Decode without hints   |\r\n');
  at(0.05, '  +-------------------------+\r\n');
  at(PAUSE_SHORT,
    ANSI.magenta + '[Lv.4] ' + ANSI.reset +
    ANSI.green + 'explorer@kimi-os' + ANSI.reset + ':' +
    ANSI.cyan + '/world/lab' + ANSI.reset + '$ ');

  // command 6 - wait 6 (trigger night)
  type('wait 6');
  at(PAUSE_SHORT, '\r\n');
  at(0.20, ANSI.dim + 'time advances... 19:00 (Night)' + ANSI.reset + '\r\n');
  at(0.15, ANSI.yellow + '*** ACHIEVEMENT UNLOCKED *** ' + ANSI.reset + ' 🦉  Night Owl\r\n');
  at(PAUSE_SHORT,
    ANSI.magenta + '[Lv.5] ' + ANSI.reset +
    ANSI.green + 'explorer@kimi-os' + ANSI.reset + ':' +
    ANSI.cyan + '/world/lab' + ANSI.reset + '$ ');

  // command 7 - share
  type('share');
  at(PAUSE_SHORT, '\r\n');
  at(0.20, ANSI.green + 'share card written:' + ANSI.reset + ' ~/.terminal-quest/shares/card-explorer-2026-04-25T11-21-00Z.txt\r\n');
  at(PAUSE_LONG,
    ANSI.magenta + '[Lv.5] ' + ANSI.reset +
    ANSI.green + 'explorer@kimi-os' + ANSI.reset + ':' +
    ANSI.cyan + '/world/lab' + ANSI.reset + '$ ');

  // command 8 - exit
  type('exit');
  at(PAUSE_SHORT, '\r\n');
  at(0.20, ANSI.dim + 'Goodbye, explorer.' + ANSI.reset + '\r\n');

  return ctx.events;
}

function buildCast() {
  const header = {
    version: 2,
    width: WIDTH,
    height: HEIGHT,
    timestamp: 1745500000,            // frozen epoch for reproducible output
    title: 'Terminal Quest CLI - npx demo',
    env: { SHELL: '/bin/zsh', TERM: 'xterm-256color' }
  };
  const lines = [JSON.stringify(header)];
  for (const ev of buildEvents()) lines.push(JSON.stringify(ev));
  return lines.join('\n') + '\n';
}

function main() {
  const out = path.join(__dirname, '..', 'docs', 'demo.cast');
  const body = buildCast();
  if (process.argv.includes('--print')) {
    process.stdout.write(body);
    return;
  }
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(out)) {
      console.error('docs/demo.cast missing - run scripts/write-cast.js');
      process.exit(1);
    }
    const cur = fs.readFileSync(out, 'utf8');
    if (cur.trim() !== body.trim()) {
      console.error('docs/demo.cast is stale - re-run scripts/write-cast.js');
      process.exit(1);
    }
    console.log('docs/demo.cast up to date');
    return;
  }
  fs.writeFileSync(out, body);
  const evCount = body.split('\n').length - 2;
  console.log(`wrote ${out} (${Buffer.byteLength(body)} bytes, ${evCount} events)`);
}

main();
