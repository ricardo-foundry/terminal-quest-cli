/**
 * @module ui
 * @description Rendering primitives: colour palette, panels, boxes,
 *   animated boot sequence, level-up + achievement popups.
 *
 * The `colors` object is a *live* palette — it is mutated in place by
 * `applyTheme(name)` so other modules can keep a stable reference and
 * still see palette changes after `theme retro`.
 *
 * All animations check `process.stdout.isTTY` and fall back to a single
 * static line in non-interactive environments (CI, pipes).
 *
 * Visual-width helpers (`visualWidth`, `padVisual`) handle CJK and
 * emoji as 2-column glyphs so framed boxes line up under Chinese text.
 */

const chalk = require('chalk');
const { getTheme } = require('./themes');
const { getCapabilities } = require('./terminal');
const { visualWidth, padVisual, centerVisual, truncateVisual, wrapVisual } = require('./wcwidth');
const { t } = require('./i18n');

// Live palette — mutate in place so other modules that keep a reference
// to `colors` continue to work after a theme switch.
const colors = {};

/**
 * Apply a theme palette in-place to the shared `colors` object.
 * Rebinds rainbow / gradient / neon helpers after swap.
 *
 * v2.7 (iter-14): also sync chalk.level with the cached terminal
 * capabilities so a `--no-color` flag honoured AFTER chalk loaded still
 * suppresses ANSI escapes. Without this sync, the retro theme's
 * `chalk.hex('#FFB000')` calls would still emit truecolor escapes when
 * the player passed `--no-color`.
 *
 * @param {string} [name='dark'] theme name
 */
function applyTheme(name = 'dark') {
  const caps = getCapabilities();
  // chalk@4 caches `level` at module load. Re-sync it now so a late
  // --no-color (which set NO_COLOR=1 then refreshed terminal caps) is
  // honoured by every chalk-built palette function below.
  if (typeof chalk.level === 'number') {
    chalk.level = caps.colorLevel;
  }
  const palette = getTheme(name);
  // reset existing keys
  for (const k of Object.keys(colors)) delete colors[k];
  Object.assign(colors, palette);
  colors.rainbow = caps.colorLevel === 0 ? (t) => t : rainbow;
  colors.gradient = (text) => colors.rainbow(text);
  colors.neon = caps.colorLevel === 0 ? (t) => t : (text) => chalk.bold.cyan(text);
  colors.currentThemeName = name;
}

/**
 * Rainbow-colour a string, one glyph per ANSI hue.
 * No-op on non-colour terminals.
 *
 * @param {string} text
 * @returns {string}
 */
function rainbow(text) {
  const palette = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];
  return text.split('').map((c, i) => palette[i % palette.length](c)).join('');
}

// Animations -------------------------------------------------------------
const animations = {
  async typeWrite(text, delay = 15) {
    for (const char of text) {
      process.stdout.write(char);
      await sleep(delay);
    }
    process.stdout.write('\n');
  },

  async typeWriteFast(text, delay = 5) {
    for (const char of text) {
      process.stdout.write(char);
      await sleep(delay);
    }
    process.stdout.write('\n');
  },

  async progressBar(duration = 2000, steps = 20, label = 'Loading') {
    if (!process.stdout.isTTY) {
      console.log(colors.dim(`${label}...`));
      await sleep(Math.min(duration, 200));
      console.log(colors.success('  done'));
      return;
    }
    const width = 30;
    for (let i = 0; i <= steps; i++) {
      const percent = Math.floor((i / steps) * 100);
      const filled = Math.floor((i / steps) * width);
      const empty = width - filled;
      const bar = '#'.repeat(filled) + '-'.repeat(empty);
      process.stdout.write(`\r${colors.dim(label)} ${colors.primary('[')}${colors.success(bar)}${colors.primary(']')} ${percent}%`);
      await sleep(duration / steps);
    }
    console.log();
  },

  async scanEffect(text, duration = 1500) {
    if (!process.stdout.isTTY) {
      console.log(colors.info(text));
      return;
    }
    const chars = '#*+.';
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const progress = Math.floor((i / steps) * text.length);
      const visible = text.substring(0, progress);
      const scanning = i < steps ? chars[Math.floor(Math.random() * chars.length)] : '';
      const hidden = '.'.repeat(Math.max(0, text.length - progress - 1));
      process.stdout.write(`\r${colors.info(visible)}${colors.warning(scanning)}${colors.dim(hidden)}`);
      await sleep(duration / steps);
    }
    console.log();
  },

  async spinner(text, duration = 2000) {
    if (!process.stdout.isTTY) {
      console.log(colors.dim(`${text}...`));
      await sleep(Math.min(duration, 200));
      console.log(colors.success('  done'));
      return;
    }
    const frames = ['|', '/', '-', '\\'];
    const startTime = Date.now();
    let i = 0;
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          clearInterval(interval);
          process.stdout.write('\r' + ' '.repeat(text.length + 4) + '\r');
          resolve();
        } else {
          process.stdout.write(`\r${colors.primary(frames[i])} ${colors.dim(text)}`);
          i = (i + 1) % frames.length;
        }
      }, 100);
    });
  },

  async hackDecode(text, duration = 1000) {
    if (!process.stdout.isTTY) {
      console.log(colors.success(text));
      return;
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*';
    const steps = 10;
    for (let step = 0; step <= steps; step++) {
      const revealed = Math.floor((step / steps) * text.length);
      let output = '';
      for (let i = 0; i < text.length; i++) {
        if (i < revealed) output += colors.success(text[i]);
        else if (text[i] === ' ') output += ' ';
        else output += colors.dim(chars[Math.floor(Math.random() * chars.length)]);
      }
      process.stdout.write(`\r${output}`);
      await sleep(duration / steps);
    }
    console.log();
  }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printTitle() {
  const title = `
${colors.primary('  ______                    _                 _ ')}
${colors.primary(' /_  __/__  _____ ____ ___ (_)__  ___ _   __ | |')}
${colors.secondary('  / / / _ \\/ ___// __ `__ \\/ / _ \\/ _ \\ | / /_/ /')}
${colors.secondary(' / / /  __/ /   / / / / / / /  __/  __/ |/ /_ _/ ')}
${colors.accent('/_/  \\___/_/   /_/ /_/ /_/_/\\___/\\___/|___(_|_) ')}
${colors.accent('                  Terminal Quest')}
`;
  console.log(title);
  console.log(colors.dim('-'.repeat(56)));
  console.log();
}

function printBox(text, color = 'primary') {
  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map((l) => visualWidth(l)));
  const border = '-'.repeat(maxLen + 4);
  const colorFn = colors[color] || colors.primary;
  console.log(colorFn(`+${border}+`));
  lines.forEach((line) => {
    const padded = padVisual(line, maxLen);
    console.log(colorFn(`|  ${padded}  |`));
  });
  console.log(colorFn(`+${border}+`));
}

function printPanel(title, content, color = 'primary') {
  const colorFn = colors[color] || colors.primary;
  const width = 50;
  const border = '='.repeat(width);
  console.log();
  console.log(colorFn(`+${border}+`));
  const titleW = visualWidth(title);
  const left = Math.floor((width - titleW) / 2);
  const right = width - titleW - left;
  console.log(colorFn(`|${' '.repeat(Math.max(0, left))}${colors.bold(title)}${' '.repeat(Math.max(0, right))}|`));
  console.log(colorFn(`+${border}+`));
  const lines = content.split('\n');
  lines.forEach((line) => {
    const padded = padVisual(line, width - 2);
    console.log(colorFn(`| ${padded}|`));
  });
  console.log(colorFn(`+${border}+`));
  console.log();
}

async function showAchievement(achievement) {
  console.log();
  console.log(colors.rainbow(`*** ${t('ach.unlocked')} ***`));
  printBox(
    `${achievement.icon} ${achievement.name}\n${colors.dim(achievement.desc)}`,
    'warning'
  );
  if (achievement.reward) {
    console.log(colors.gold(`   ${t('ach.reward', { reward: achievement.reward })}`));
  }
  console.log();
  await sleep(400);
}

async function showLevelUp(level, title) {
  console.log();
  const width = 50;
  const border = '='.repeat(width);
  console.log(colors.gold(`+${border}+`));
  const head = `*** ${t('levelup.title')} ***`;
  const headW = visualWidth(head);
  const left = Math.floor((width - headW) / 2);
  const right = width - headW - left;
  console.log(colors.gold(`|${' '.repeat(left)}${colors.rainbow(head)}${' '.repeat(right)}|`));
  const line1 = t('levelup.now', { from: level - 1, to: level });
  console.log(colors.gold(`| ${padVisual(line1, width - 2)}|`));
  const line2 = t('levelup.gained', { title });
  console.log(colors.gold(`| ${padVisual(line2, width - 2)}|`));
  console.log(colors.gold(`+${border}+`));
  console.log();
  await sleep(800);
}

async function bootSequence({ skip = false } = {}) {
  if (skip || !process.stdout.isTTY) {
    printTitle();
    return;
  }
  console.clear();
  // Use locale-neutral, technical tokens so the boot stream does not
  // need to be re-flowed when the player runs `lang en|zh|ja` mid-session.
  // The expressive logo + welcome lines live below and ARE locale-aware.
  const biosLines = [
    'BIOS v2.1 -- KIMI-OS',
    'CPU :: Neural Core',
    'MEM :: check',
    'KERN :: load modules',
    'AI  :: init core',
    'FS  :: mount virtual',
    'SYS :: ready'
  ];
  for (const line of biosLines) {
    if (line.startsWith('MEM')) {
      await animations.progressBar(400, 8, 'MEM');
      console.log(colors.success(`  [ok] ${line}`));
    } else if (line.startsWith('AI ')) {
      await animations.spinner('AI :: init core', 600);
      console.log(colors.success(`  [ok] ${line}`));
    } else {
      console.log(colors.dim(`[${new Date().toLocaleTimeString()}] `) + colors.info(line));
      await sleep(60);
    }
  }
  await sleep(150);
  console.clear();
  printTitle();
}

function helpText() {
  return {
    basic: () => `
${colors.bold('Basic commands:')}
  ${colors.primary('ls')} [path]       list directory (add -a for hidden)
  ${colors.primary('cd')} <path>       change directory (~ is home)
  ${colors.primary('cat')} <file>      read a file
  ${colors.primary('pwd')}             print current path
  ${colors.primary('clear')}           clear the screen
  ${colors.primary('help')}            show this help
  ${colors.primary('hint')}            get a hint for the current quest`,
    advanced: () => `
${colors.bold('Advanced:')}
  ${colors.secondary('scan')}           reveal hidden files
  ${colors.secondary('decode')} <file>  decrypt an encrypted file
  ${colors.secondary('run')} <game>     run a minigame (snake/guess/matrix/pong/wordle)
  ${colors.secondary('analyze')}        inspect current area
  ${colors.secondary('hack')}           enter hacker mode
  ${colors.secondary('find')} <name>    search file system
  ${colors.secondary('grep')} <pat> <f> search inside a file
  ${colors.secondary('tree')}           directory tree`,
    rpg: () => `
${colors.bold('RPG:')}
  ${colors.accent('status')}          show character sheet
  ${colors.accent('inventory')}       list items
  ${colors.accent('use')} <item>      use an item
  ${colors.accent('talk')} <npc>      talk to an NPC
  ${colors.accent('map')}             world map
  ${colors.accent('quests')}          quest log
  ${colors.accent('achievements')}    achievements
  ${colors.accent('unlock')} master   use the master key`,
    meta: () => `
${colors.bold('Meta:')}
  ${colors.info('save')} [slot]         save to a named slot
  ${colors.info('load')} <slot>         load a slot
  ${colors.info('saves')}               list save slots
  ${colors.info('theme')} <name>        dark | light | retro
  ${colors.info('lang')} <code>         en | zh
  ${colors.info('version')}             show version
  ${colors.info('exit')}                quit the game`,
    secret: () => `
${colors.bold('Hidden:')}
  ${colors.purple('love')}, ${colors.purple('coffee')}, ${colors.purple('42')}, ${colors.purple('hello')}, ${colors.purple('easteregg')}, ${colors.purple('sudo')}`
  };
}

// Expose `HELP_TEXT` as a live object that rebuilds using current colours.
const HELP_TEXT = {
  get basic() { return helpText().basic; },
  get advanced() { return helpText().advanced; },
  get rpg() { return helpText().rpg; },
  get secret() { return helpText().secret; },
  get meta() { return helpText().meta; },
  get tips() {
    return () => `
${colors.dim('-'.repeat(56))}
${colors.info('Tips:')}
  * Use scan to find hidden things
  * Talk to every NPC
  * Explore every directory
  * Finish quests for EXP
  * Collect every key fragment
${colors.dim('-'.repeat(56))}`;
  }
};

// default theme
applyTheme('dark');

module.exports = {
  colors,
  animations,
  sleep,
  printTitle,
  printBox,
  printPanel,
  showAchievement,
  showLevelUp,
  bootSequence,
  HELP_TEXT,
  visualWidth,
  padVisual,
  centerVisual,
  truncateVisual,
  wrapVisual,
  applyTheme
};
