#!/usr/bin/env node
/* eslint-disable no-console */
// ============================================
// Runtime playthrough — spawn the CLI in a child
// process, feed it a sequence of commands, and
// assert that key milestones appear in stdout.
// Used by the iter-9 runtime QA pass.
// ============================================

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'terminal-quest.js');

// Mirror what the script does for a clean playthrough:
// run inside a fresh save directory so prior state never leaks in.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-runtime-'));

// Order matters — `lang en` runs early so subsequent confirmations land
// in English and we can assert against stable strings.
const SCRIPT = [
  'lang en',
  'help',
  'look',
  'ls',
  'cd /home/user',
  'ls -a',
  'scan',
  'cat readme.txt',
  'cat start_here.txt',
  'cat diary.txt',
  'cd .secret',
  'ls',
  'inventory',
  'status',
  'achievements',
  'quests',
  'time',
  'wait 3',
  'echo hello world',
  'alias gg=status',
  'alias',           // <- list aliases (header "Aliases")
  'history',
  'theme retro',
  'find readme',
  'save smoke-test',
  'saves',
  'version',
  'exit'
];

const MILESTONES = [
  { needle: '[OK]',                    label: 'boot ready' },
  { needle: 'You are at',              label: 'look',                ci: true },
  { needle: 'KIMI-OS',                 label: 'readme content',      ci: true },
  { needle: 'Aliases',                 label: 'alias listing',       ci: true },
  { needle: 'History',                 label: 'history table',       ci: true },
  { needle: 'theme set',               label: 'theme switch',        ci: true },
  { needle: 'language set',            label: 'lang switch',         ci: true },
  { needle: 'Game saved to slot',      label: 'save success',        ci: true },
  { needle: 'found 1',                 label: 'find pattern',        ci: true }
];

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function run() {
  return new Promise((resolve) => {
    const env = Object.assign({}, process.env, {
      HOME: TMP_HOME,
      USERPROFILE: TMP_HOME,
      NO_COLOR: '1',
      TQ_DISABLE_ANIM: '1' // honoured by ui.js / minigames if set
    });
    const child = spawn(process.execPath, [BIN, '--no-boot', '--slot', 'smoke-test', '--no-color'], {
      cwd: ROOT, env, stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    // Pace input so the readline loop has time to print between commands.
    let i = 0;
    const tick = () => {
      if (i >= SCRIPT.length) { child.stdin.end(); return; }
      child.stdin.write(SCRIPT[i++] + '\n');
      setTimeout(tick, 60);
    };
    setTimeout(tick, 200);
    const killTimer = setTimeout(() => { child.kill('SIGTERM'); }, 20000);
    child.on('close', (code, signal) => {
      clearTimeout(killTimer);
      resolve({ code, signal, stdout: stripAnsi(stdout), stderr: stripAnsi(stderr) });
    });
  });
}

(async () => {
  const res = await run();
  const failures = [];

  for (const m of MILESTONES) {
    const hay = m.ci ? res.stdout.toLowerCase() : res.stdout;
    const ndl = m.ci ? m.needle.toLowerCase() : m.needle;
    if (!hay.includes(ndl)) failures.push(`milestone missing: ${m.label} ("${m.needle}")`);
  }
  if (res.stderr.trim() !== '') failures.push(`stderr leaked:\n${res.stderr}`);
  if (res.code !== 0 && res.code !== 130) failures.push(`exit code not in {0,130}: ${res.code} (signal=${res.signal})`);

  // Cheap sanity assertions on output.
  if (res.stdout.includes('TypeError') || res.stdout.includes('Cannot read')) {
    failures.push('JS error leaked into stdout');
  }
  if (res.stdout.includes('UnhandledPromiseRejection') || res.stdout.includes('[promise]')) {
    failures.push('unhandled promise rejection surfaced');
  }

  // Surface a one-line summary first, then optionally dump.
  const verdict = failures.length === 0 ? 'PASS' : 'FAIL';
  console.log(`runtime-playthrough: ${verdict}  (commands=${SCRIPT.length}, exit=${res.code}, bytes=${res.stdout.length})`);
  for (const f of failures) console.log('  - ' + f);
  if (process.env.TQ_DUMP) {
    console.log('\n--- stdout ---\n' + res.stdout);
    console.log('\n--- stderr ---\n' + res.stderr);
  }
  // Best-effort cleanup of the temp HOME we created.
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  process.exit(failures.length === 0 ? 0 : 1);
})();
