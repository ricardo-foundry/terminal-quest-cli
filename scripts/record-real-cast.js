#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/record-real-cast.js
 *
 * Drive bin/terminal-quest.js inside a child process (the same way
 * scripts/runtime-playthrough.js does it), capture every stdout chunk
 * with a timestamp, and emit `docs/demo-real.cast` — a strict
 * asciinema v2 JSON file produced from a *real* run, not a hand-authored
 * script.
 *
 * Companion to write-cast.js:
 *   - docs/demo.cast        — hand-authored, tells a polished story.
 *   - docs/demo-real.cast   — captured live, shows what the CLI actually
 *                             does end-to-end. Useful for QA + as proof.
 *
 * Usage:
 *   node scripts/record-real-cast.js              # write docs/demo-real.cast
 *   node scripts/record-real-cast.js --print      # print to stdout
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'terminal-quest.js');
const OUT = path.join(ROOT, 'docs', 'demo-real.cast');

// A short, deterministic playthrough — chosen to fit within ~25 seconds
// of recording so the cast stays viewer-friendly.
const SCRIPT = [
  'lang en',
  'help',
  'look',
  'ls -a',
  'scan',
  'cat readme.txt',
  'cd .secret',
  'ls',
  'cat key_fragment_1.txt',
  'inventory',
  'status',
  'quests',
  'time',
  'wait 6',
  'theme retro',
  'find readme',
  'save smoke-test',
  'version',
  'exit'
];

function run() {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-cast-'));
    const env = Object.assign({}, process.env, {
      HOME: tmpHome,
      USERPROFILE: tmpHome,
      // Keep colors ON for the cast — that's the whole point of recording.
      FORCE_COLOR: '1',
      TERM: 'xterm-256color'
    });
    const child = spawn(process.execPath, [BIN, '--no-boot', '--slot', 'demo-real'], {
      cwd: ROOT, env, stdio: ['pipe', 'pipe', 'pipe']
    });
    const start = process.hrtime.bigint();
    const events = [];
    const push = (chunk) => {
      const t = Number(process.hrtime.bigint() - start) / 1e9;
      events.push([Number(t.toFixed(3)), 'o', chunk.toString('utf8')]);
    };
    child.stdout.on('data', push);
    child.stderr.on('data', push);

    let i = 0;
    const tick = () => {
      if (i >= SCRIPT.length) { child.stdin.end(); return; }
      const line = SCRIPT[i++] + '\n';
      // Echo the user's input into the cast so viewers see what was typed.
      const t = Number(process.hrtime.bigint() - start) / 1e9;
      events.push([Number(t.toFixed(3)), 'o', line]);
      child.stdin.write(line);
      setTimeout(tick, 350); // ~350ms between commands keeps it watchable
    };
    setTimeout(tick, 250);

    const killTimer = setTimeout(() => { child.kill('SIGTERM'); }, 25000);
    child.on('close', () => {
      clearTimeout(killTimer);
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) { /* ignore */ }
      resolve(events);
    });
  });
}

(async () => {
  const events = await run();
  const header = {
    version: 2,
    width: 100,
    height: 30,
    timestamp: Math.floor(Date.now() / 1000),
    title: 'Terminal Quest CLI - real playthrough',
    env: { SHELL: '/bin/zsh', TERM: 'xterm-256color' }
  };
  const lines = [JSON.stringify(header)];
  for (const ev of events) lines.push(JSON.stringify(ev));
  const body = lines.join('\n') + '\n';
  if (process.argv.includes('--print')) {
    process.stdout.write(body);
    return;
  }
  fs.writeFileSync(OUT, body);
  console.log(`wrote ${OUT} (${Buffer.byteLength(body)} bytes, ${events.length} events)`);
})();
