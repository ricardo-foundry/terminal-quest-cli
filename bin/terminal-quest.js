#!/usr/bin/env node

// ============================================
// Terminal Quest CLI - entry point
// ============================================

'use strict';

const path = require('path');
const pkg = require('../package.json');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-v' || a === '--version') args.version = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--slot') args.slot = argv[++i];
    else if (a.startsWith('--slot=')) args.slot = a.slice(7);
    else if (a === '--lang') args.lang = argv[++i];
    else if (a.startsWith('--lang=')) args.lang = a.slice(7);
    else if (a === '--theme') args.theme = argv[++i];
    else if (a.startsWith('--theme=')) args.theme = a.slice(8);
    else if (a === '--no-boot') args.skipBoot = true;
    else if (a === '--dev') args.dev = true;
    else args._.push(a);
  }
  return args;
}

function printHelp() {
  console.log(`${pkg.name} v${pkg.version}

Usage:
  terminal-quest [options]
  tq             alias

Options:
  -h, --help        show this help
  -v, --version     print version
  --slot <name>     use a named save slot (default: "default")
  --lang <code>     force language (en | zh)
  --theme <name>    force theme (dark | light | retro)
  --no-boot         skip the boot animation
  --dev             developer mode

Commands inside the game:
  help              list in-game commands
  save [slot]       save progress
  load <slot>       load a save slot
  saves             list slots
  theme <name>      change theme (dark|light|retro)
  lang <code>       change language (en|zh)
  exit              quit
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(`${pkg.name} v${pkg.version}`);
    process.exit(0);
  }
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Honour --lang / --theme before game instantiation
  if (args.lang) {
    try { require('../src/i18n').setLocale(args.lang); } catch (_) { /* ignore */ }
  }
  if (args.theme) {
    try { require('../src/ui').applyTheme(args.theme); } catch (_) { /* ignore */ }
  }

  const { TerminalGame } = require('../src/game');
  try {
    const game = new TerminalGame({
      slot: args.slot,
      skipBoot: !!args.skipBoot,
      dev: !!args.dev
    });
    await game.init();
  } catch (err) {
    console.error('Game failed to start:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

// Global uncaught-error guard — print something useful, don't just crash.
process.on('uncaughtException', (err) => {
  console.error('\n[fatal]', err && err.message ? err.message : err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('\n[promise]', err && err.message ? err.message : err);
});

main();
