#!/usr/bin/env node

// ============================================
// Terminal Quest CLI - entry point
// ============================================

'use strict';

const fs = require('fs');
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
    else if (a === '--no-color' || a === '--no-colors') args.noColor = true;
    else if (a === '--dev') args.dev = true;
    else if (a === '--new') args.newSave = true;
    else if (a === '--export-save') args.exportSave = argv[++i];
    else if (a.startsWith('--export-save=')) args.exportSave = a.slice(14);
    else if (a === '--import-save') {
      args.importFrom = argv[++i];
      args.importSlot = argv[++i];
    }
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
  -h, --help                 show this help
  -v, --version              print version
  --slot <name>              use a named save slot (default: "default")
  --lang <code>              force language (en | zh)
  --theme <name>             force theme (dark | light | retro)
  --no-boot                  skip the boot animation
  --no-color                 disable ANSI colour output
  --new                      start with a fresh save (any existing slot is archived)
  --export-save <slot>       print the slot's JSON to stdout and exit
  --import-save <file> <slot>  import JSON from <file> into <slot> and exit
  --dev                      developer mode

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

async function runExport(slot) {
  const saveMod = require('../src/save');
  const json = saveMod.exportSlot(slot);
  if (!json) {
    console.error(`no save found in slot "${slot}"`);
    process.exit(2);
  }
  process.stdout.write(json);
  if (!json.endsWith('\n')) process.stdout.write('\n');
  process.exit(0);
}

async function runImport(file, slot) {
  if (!file || !slot) {
    console.error('usage: --import-save <file> <slot>');
    process.exit(2);
  }
  const saveMod = require('../src/save');
  let body;
  try {
    body = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`cannot read ${file}: ${e.message}`);
    process.exit(2);
  }
  const res = saveMod.importSlot(slot, body);
  if (!res) {
    console.error('import rejected: file is not a valid save envelope');
    process.exit(2);
  }
  console.log(`imported into slot "${slot}" (${res.bytes} bytes) -> ${res.path}`);
  process.exit(0);
}

function archiveSlot(slot) {
  try {
    const saveMod = require('../src/save');
    const p = saveMod.slotPath(slot || saveMod.DEFAULT_SLOT);
    if (fs.existsSync(p)) {
      const dest = p + '.archived-' + Date.now();
      fs.renameSync(p, dest);
      console.log(`archived previous slot -> ${dest}`);
    }
  } catch {
    /* ignore */
  }
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
  if (args.exportSave) {
    await runExport(args.exportSave);
    return;
  }
  if (args.importFrom) {
    await runImport(args.importFrom, args.importSlot);
    return;
  }

  // Honour --no-color *before* anything touches chalk/terminal probing.
  if (args.noColor) {
    process.env.NO_COLOR = '1';
    try { require('../src/terminal').refresh(); } catch (_) { /* ignore */ }
  }

  // If --new, archive the existing slot so the game starts fresh.
  if (args.newSave) archiveSlot(args.slot);

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
