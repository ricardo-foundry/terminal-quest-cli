#!/usr/bin/env node
/**
 * scripts/record-cast.js
 *
 * Best-effort live recorder: spawn `terminal-quest --no-boot` via the
 * stdlib `child_process.spawn` (we refuse to add `node-pty` as a dep for
 * one doc asset), feed it a scripted sequence of commands, and capture
 * stdout chunks into an asciinema v2 cast.
 *
 * Because we don't allocate a pty, the game's raw-mode input prompts
 * don't negotiate properly. That's fine for *this* script's narrow goal:
 *   - we do NOT drive minigames (which need raw keystrokes),
 *   - we DO drive the REPL, which reads line-by-line from stdin.
 *
 * If the run times out, crashes, or emits zero bytes, we exit non-zero
 * and the caller is expected to fall back to `scripts/write-cast.js`.
 *
 * Usage:
 *   node scripts/record-cast.js
 *     -> writes docs/demo.cast on success, exits 1 otherwise.
 */

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT = [
  'help',
  'ls',
  'cd /world',
  'ls',
  'cd lab',
  'talk engineer',
  'status',
  'achievements',
  'exit'
];

const INPUT_DELAY_MS = 350;
const TOTAL_TIMEOUT_MS = 8000;
const BIN = path.join(__dirname, '..', 'bin', 'terminal-quest.js');

function recordLive() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const events = [];
    let settled = false;

    const child = spawn(process.execPath, [BIN, '--no-boot', '--lang', 'en'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, { NO_COLOR: '', TERM: 'xterm-256color' })
    });

    child.stdout.on('data', (chunk) => {
      const t = (Date.now() - start) / 1000;
      events.push([Number(t.toFixed(3)), 'o', chunk.toString('utf8')]);
    });
    child.stderr.on('data', (chunk) => {
      const t = (Date.now() - start) / 1000;
      events.push([Number(t.toFixed(3)), 'o', chunk.toString('utf8')]);
    });

    const kill = (why, code) => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGTERM'); } catch (_) { /* ignore */ }
      if (code === 0) resolve(events);
      else reject(new Error(why));
    };

    child.on('error', (e) => kill('spawn error: ' + e.message, 2));
    child.on('exit', (code) => kill('child exited ' + code, code || 0));

    // drive stdin on a timer so the REPL has time to render each response
    let i = 0;
    const tick = setInterval(() => {
      if (settled) { clearInterval(tick); return; }
      if (i >= SCRIPT.length) {
        clearInterval(tick);
        try { child.stdin.end(); } catch (_) { /* ignore */ }
        return;
      }
      try { child.stdin.write(SCRIPT[i] + '\n'); } catch (_) { /* ignore */ }
      i++;
    }, INPUT_DELAY_MS);

    setTimeout(() => kill('timeout', 1), TOTAL_TIMEOUT_MS);
  });
}

async function main() {
  let events;
  try {
    events = await recordLive();
  } catch (e) {
    console.error('[record-cast] live recording failed:', e.message);
    console.error('[record-cast] fall back to: node scripts/write-cast.js');
    process.exit(1);
  }
  if (!events.length) {
    console.error('[record-cast] captured 0 events, giving up');
    process.exit(1);
  }
  const header = {
    version: 2,
    width: 96,
    height: 28,
    timestamp: Math.floor(Date.now() / 1000),
    title: 'Terminal Quest CLI - live npx demo',
    env: { SHELL: process.env.SHELL || '/bin/sh', TERM: 'xterm-256color' }
  };
  const body = [JSON.stringify(header)].concat(events.map((e) => JSON.stringify(e))).join('\n') + '\n';
  const out = path.join(__dirname, '..', 'docs', 'demo.cast');
  fs.writeFileSync(out, body);
  console.log(`[record-cast] wrote ${out} (${events.length} events, ${Buffer.byteLength(body)} bytes)`);
}

main();
