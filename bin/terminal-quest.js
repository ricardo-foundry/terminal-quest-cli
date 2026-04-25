#!/usr/bin/env node

// ============================================
// Terminal Quest CLI - entry point
// ============================================

'use strict';

const fs = require('fs');
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
    else if (a === '--no-color' || a === '--no-colors') args.noColor = true;
    else if (a === '--dev') args.dev = true;
    // v2.8 (iter-15): opt-in text-to-speech for NPC lines. Default off.
    else if (a === '--tts') args.tts = true;
    else if (a === '--new') args.newSave = true;
    // v2.9 (iter-19): start a New Game+ run on the current slot.
    else if (a === '--ng' || a === '--new-game-plus') args.ngPlus = true;
    else if (a === '--export-save') args.exportSave = argv[++i];
    else if (a.startsWith('--export-save=')) args.exportSave = a.slice(14);
    else if (a === '--import-save') {
      args.importFrom = argv[++i];
      args.importSlot = argv[++i];
    }
    // v2.4 additions
    else if (a === '--list-quests') args.listQuests = true;
    else if (a === '--validate-quest') args.validateQuest = argv[++i];
    else if (a.startsWith('--validate-quest=')) args.validateQuest = a.slice(17);
    else if (a === '--interactive' || a === '-i') args.interactive = true;
    else if (a === '--cloud') {
      // v2.5 (iter-9): mark the flag even when no op was supplied so we can
      // print a useful usage line instead of silently dropping into the
      // interactive game.
      args.cloudFlag = true;
      args.cloudOp = argv[++i];
      args.cloudSlot = argv[++i];
    }
    else if (a === '--replay') {
      args.replay = argv[++i] || 'default';
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
  --lang <code>              force language (en | zh | zh-tw | ja | es)
  --theme <name>             force theme (dark | light | retro)
  --no-boot                  skip the boot animation
  --no-color                 disable ANSI colour output
  --new                      start with a fresh save (any existing slot is archived)
  --ng                       start a New Game+ on the current slot (requires
                             a finished playthrough; carries achievements,
                             affinities, totals, and unlocked community quests)
  --export-save <slot>       print the slot's JSON to stdout and exit
  --import-save <file> <slot>  import JSON from <file> into <slot> and exit
  --dev                      developer mode (hot-reloads community quests)
  --tts                      enable optional text-to-speech for NPC lines
                             (macOS: say, Linux: espeak, Windows: SAPI;
                              opt-in; toggle in-game with "tts on|off")

Quests (v2.4):
  --list-quests                       list all quests in ./quests/*/quest.json
  --validate-quest <path>             validate a single quest.json file
  --validate-quest <path> --interactive
                                      walk through prompts and write a new
                                      quest.json template to <path>
                                      (use "new" or "-" as <path> for stdout)

Replay (v2.4):
  --replay <slot>            play back a recorded session from a save slot

Cloud saves (experimental, v2.4):
  --cloud push <slot>        push a local slot to the cloud backend (GitHub Gist)
  --cloud pull <slot>        pull a slot from the cloud backend
  --cloud list               list cloud-stored slots
                             (requires GH_TOKEN env var; see docs/CLOUD_SAVE.md)

Commands inside the game:
  help              list in-game commands
  save [slot]       save progress
  load <slot>       load a save slot
  saves             list slots
  theme <name>      change theme (dark|light|retro)
  lang <code>       change language (en|zh|zh-tw|ja|es)
  top [n]           show local leaderboard (default top 10)
  report [slot]     write a Markdown war-story report to ~/.terminal-quest/reports/
  replay [slot]     replay recorded events from the current or named slot
  tutorial          run the 5-minute new-player tour
  tts on|off|status toggle optional NPC text-to-speech (see --tts)
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

function runListQuests() {
  const { loadQuests } = require('../src/quests');
  const { quests, report } = loadQuests();
  console.log(`${pkg.name} - loaded ${quests.length} quest(s)`);
  for (const q of quests) {
    console.log(`  [${q.id}]  ${q.title}  (${q.steps.length} step(s))`);
    if (q.tags && q.tags.length) console.log(`    tags: ${q.tags.join(', ')}`);
    if (q.author) console.log(`    by: ${q.author}`);
  }
  const failures = report.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.log();
    console.log(`${failures.length} quest(s) were skipped:`);
    for (const f of failures) {
      console.log(`  - ${f.file}`);
      for (const e of f.errors) console.log(`      ! ${e}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

function runValidateQuest(file) {
  const { loadQuestFile } = require('../src/quests');
  const abs = path.resolve(String(file));
  const { quest, errors } = loadQuestFile(abs);
  if (quest) {
    console.log(`ok  ${abs}`);
    console.log(`     id=${quest.id}  title="${quest.title}"  steps=${quest.steps.length}`);
    process.exit(0);
  }
  console.error(`invalid  ${abs}`);
  for (const e of errors) console.error(`  ! ${e}`);
  process.exit(2);
}

async function runInteractiveQuest(targetFile) {
  // --validate-quest <path> --interactive : walk the user through prompts
  // and write a fresh quest.json template to <path>. If the path already
  // exists we refuse to clobber.
  const { buildQuestInteractive, readlineIO } = require('../src/quest-builder');
  const io = readlineIO();
  try {
    const { quest, errors } = await buildQuestInteractive(io);
    io.close();
    const json = JSON.stringify(quest, null, 2);
    if (errors.length > 0) {
      console.error('quest builder produced a quest with validation errors:');
      for (const e of errors) console.error(`  ! ${e}`);
    }
    if (targetFile && targetFile !== 'new' && targetFile !== '-') {
      const abs = path.resolve(String(targetFile));
      if (fs.existsSync(abs)) {
        console.error(`refusing to overwrite existing file: ${abs}`);
        console.error('  pass --validate-quest=new --interactive to print to stdout instead.');
        process.exit(2);
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, json + '\n');
      console.log(`wrote ${abs} (${json.length} bytes)`);
    } else {
      process.stdout.write(json + '\n');
    }
    process.exit(errors.length === 0 ? 0 : 2);
  } catch (e) {
    io.close();
    console.error(`interactive builder failed: ${e && e.message ? e.message : e}`);
    process.exit(2);
  }
}

async function runCloud(op, slot) {
  const { GistBackend } = require('../src/cloud');
  const saveMod = require('../src/save');
  if (!op) {
    console.error('usage: --cloud <push|pull|list> [slot]');
    process.exit(2);
  }
  if (!process.env.GH_TOKEN) {
    console.error('GH_TOKEN environment variable is not set.');
    console.error('see docs/CLOUD_SAVE.md - cloud saves are experimental and opt-in.');
    process.exit(2);
  }
  const backend = new GistBackend({ token: process.env.GH_TOKEN });
  if (op === 'list') {
    const r = await backend.list();
    if (!r.ok) { console.error(`cloud list failed: ${r.error}`); process.exit(2); }
    console.log(`cloud saves (${r.items.length}):`);
    for (const it of r.items) {
      console.log(`  ${it.slot.padEnd(16)}  ${it.updatedAt || '-'}  ${it.url || ''}`);
    }
    process.exit(0);
  }
  if (!slot) {
    console.error(`usage: --cloud ${op} <slot>`);
    process.exit(2);
  }
  if (op === 'push') {
    const r = await backend.push(slot);
    if (!r.ok) { console.error(`cloud push failed: ${r.error}`); process.exit(2); }
    console.log(`pushed slot "${slot}"  ->  ${r.url || r.id}`);
    process.exit(0);
  }
  if (op === 'pull') {
    const r = await backend.pull(slot);
    if (!r.ok) { console.error(`cloud pull failed: ${r.error}`); process.exit(2); }
    const write = saveMod.importSlot(slot, r.json);
    if (!write) { console.error('pulled payload rejected by importSlot'); process.exit(2); }
    console.log(`pulled "${slot}" (${r.bytes} bytes) -> ${write.path}`);
    process.exit(0);
  }
  console.error(`unknown cloud op: ${op}`);
  process.exit(2);
}

async function runReplay(slot) {
  const saveMod = require('../src/save');
  const { loadReplayFromSlot, playReplay } = require('../src/replay');
  const events = loadReplayFromSlot(slot, saveMod);
  if (events === null) {
    console.error(`no save found in slot "${slot}"`);
    process.exit(2);
  }
  const res = await playReplay(events, { delay: 30 });
  console.log(`\nplayed ${res.lines} event(s).`);
  process.exit(0);
}

function startNewGamePlus(slot) {
  // v2.9 (iter-19): roll the named slot into a fresh NG+ run. We need the
  // previous payload before we archive so we can carry forward achievements
  // and affinities. Returns true on success; false (with stderr) when the
  // milestone hasn't been hit yet.
  const saveMod = require('../src/save');
  const ngplusMod = require('../src/ngplus');
  const { DEFAULT_STATE } = require('../src/game');

  const target = slot || saveMod.DEFAULT_SLOT;
  const payload = saveMod.load(target);
  if (!payload || !payload.state) {
    console.error(`--ng: no save found in slot "${target}". Finish the story first.`);
    process.exit(2);
  }
  if (!ngplusMod.hasUnlockedNgPlus(payload.state)) {
    console.error(`--ng: slot "${target}" hasn't completed the main story yet.`);
    console.error('  hint: finish the unlock_master quest before starting NG+.');
    process.exit(2);
  }
  // Archive the old run so the player can recover it if NG+ disappoints.
  archiveSlot(target);
  const fresh = ngplusMod.buildNgPlusState(payload.state, { ...DEFAULT_STATE });
  saveMod.save(target, fresh);
  console.log(`NG+ ready on slot "${target}" — cycle ${fresh.ngCount}.`);
  return true;
}

function archiveSlot(slot) {
  try {
    const saveMod = require('../src/save');
    const p = saveMod.slotPath(slot || saveMod.DEFAULT_SLOT);
    if (fs.existsSync(p)) {
      // v2.5: write a .bak alongside the archive so an oops `--new` is
      // recoverable with a known-name copy regardless of the timestamp.
      try {
        fs.copyFileSync(p, p + '.bak');
      } catch (_) { /* best effort */ }
      const dest = p + '.archived-' + Date.now();
      fs.renameSync(p, dest);
      console.log(`archived previous slot -> ${dest}`);
      console.log(`(latest copy also kept at ${p}.bak)`);
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
  if (args.listQuests) {
    runListQuests();
    return;
  }
  if (args.validateQuest) {
    if (args.interactive) {
      await runInteractiveQuest(args.validateQuest);
      return;
    }
    runValidateQuest(args.validateQuest);
    return;
  }
  if (args.cloudFlag) {
    await runCloud(args.cloudOp, args.cloudSlot);
    return;
  }
  if (args.replay) {
    await runReplay(args.replay);
    return;
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
  // v2.7 (iter-14): also re-apply the current theme so the live `colors`
  // palette in ui.js (which was bound at require-time before NO_COLOR was
  // set) gets rebuilt with the plain decorators. Without this the prompt
  // would still emit ANSI even under --no-color.
  if (args.noColor) {
    process.env.NO_COLOR = '1';
    try { require('../src/terminal').refresh(); } catch (_) { /* ignore */ }
    try { require('../src/ui').applyTheme('dark'); } catch (_) { /* ignore */ }
  }

  // If --new, archive the existing slot so the game starts fresh.
  if (args.newSave) archiveSlot(args.slot);
  // If --ng, roll the slot into a New Game+ payload before boot.
  if (args.ngPlus) startNewGamePlus(args.slot);

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
      dev: !!args.dev,
      tts: !!args.tts
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
