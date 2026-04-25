/**
 * @module share
 * @description Shareable ASCII score cards.
 *
 * The `share` command writes a pure-ASCII (no ANSI escapes) framed card
 * to `~/.terminal-quest/shares/card-<handle>-<timestamp>.txt` so the
 * player can copy/paste it onto Twitter, GitHub, Reddit, etc.
 *
 * Each generation bumps `gameState.shareCount`, which feeds the
 * `card_shark` achievement. The card renders: handle, level + title,
 * total EXP, playtime, achievement progress, dirs visited, minigames
 * played, alignment label, a randomised signature line and the
 * `npx terminal-quest` install hint.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SHARES_DIR = path.join(os.homedir(), '.terminal-quest', 'shares');
const REPO_URL = 'https://github.com/ricardo-foundry/terminal-quest-cli';

function ensureDir() {
  if (!fs.existsSync(SHARES_DIR)) {
    fs.mkdirSync(SHARES_DIR, { recursive: true });
  }
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function padRight(str, width) {
  str = String(str);
  if (str.length >= width) return str.slice(0, width);
  return str + ' '.repeat(width - str.length);
}

function centerLine(str, width) {
  str = String(str);
  if (str.length >= width) return str.slice(0, width);
  const extra = width - str.length;
  const left = Math.floor(extra / 2);
  const right = extra - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

// Build the ASCII card. Plain ASCII only — no ANSI — so it survives copy/paste.
function buildCard(stats) {
  const width = 58;
  const border = '+' + '-'.repeat(width) + '+';
  const lines = [];
  lines.push(border);
  lines.push('|' + centerLine('TERMINAL QUEST - EXPLORER REPORT', width) + '|');
  lines.push(border);
  lines.push('| ' + padRight(`Handle:       ${stats.handle}`, width - 2) + ' |');
  lines.push('| ' + padRight(`Level:        Lv.${stats.level}  (${stats.title})`, width - 2) + ' |');
  lines.push('| ' + padRight(`Total EXP:    ${stats.exp}`, width - 2) + ' |');
  lines.push('| ' + padRight(`Playtime:     ${formatDuration(stats.playtimeMs)}`, width - 2) + ' |');
  lines.push('| ' + padRight(`Achievements: ${stats.achievementsUnlocked}/${stats.achievementsTotal}`, width - 2) + ' |');
  lines.push('| ' + padRight(`Dirs visited: ${stats.dirsVisited}`, width - 2) + ' |');
  lines.push('| ' + padRight(`Minigames:    ${stats.gamesPlayed}`, width - 2) + ' |');
  lines.push('| ' + padRight(`Alignment:    ${describeAlignment(stats.alignment)}`, width - 2) + ' |');
  lines.push(border);
  lines.push('| ' + padRight(`"${stats.signature}"`, width - 2) + ' |');
  lines.push(border);
  lines.push('| ' + padRight(`play: npx terminal-quest`, width - 2) + ' |');
  lines.push('| ' + padRight(`${REPO_URL}`, width - 2) + ' |');
  lines.push(border);
  return lines.join('\n');
}

function describeAlignment(v) {
  const n = Number(v) || 0;
  if (n >= 5) return 'Kind (+5)';
  if (n >= 3) return 'Kind (' + n + ')';
  if (n > 0) return 'Leaning kind (' + n + ')';
  if (n === 0) return 'Neutral (0)';
  if (n > -3) return 'Leaning ruthless (' + n + ')';
  if (n > -5) return 'Ruthless (' + n + ')';
  return 'Ruthless (-5)';
}

const SIGNATURES = [
  'Code may have bugs but the connection is real.',
  'Every byte hides a story.',
  'Scan once, read twice, decode forever.',
  'I came, I cd\'d, I conquered.',
  'Hidden files, hidden truths.'
];

function pickSignature(gs) {
  const idx = ((gs && gs.level) || 1) % SIGNATURES.length;
  return SIGNATURES[idx];
}

function collectStats(game, opts = {}) {
  const gs = game.gameState || {};
  const totalAch = Object.keys(game.achievements || {}).length;
  const unlockedAch = (gs.achievements || []).length;
  return {
    handle: opts.handle || process.env.USER || process.env.USERNAME || 'explorer',
    level: gs.level || 1,
    title: opts.title || '',
    exp: gs.exp || 0,
    playtimeMs: Date.now() - (gs.startTime || Date.now()),
    achievementsUnlocked: unlockedAch,
    achievementsTotal: totalAch,
    dirsVisited: (gs.visitedDirs || []).length,
    gamesPlayed: gs.gamesPlayed || 0,
    alignment: gs.alignment || 0,
    signature: opts.signature || pickSignature(gs)
  };
}

function generate(game, opts = {}) {
  const stats = collectStats(game, opts);
  const card = buildCard(stats);
  ensureDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const handleSafe = String(stats.handle).replace(/[^a-zA-Z0-9_\-]/g, '_') || 'explorer';
  const file = path.join(SHARES_DIR, `card-${handleSafe}-${stamp}.txt`);
  fs.writeFileSync(file, card + '\n');
  // Bump counter for achievement trigger
  if (game.gameState) {
    game.gameState.shareCount = (game.gameState.shareCount || 0) + 1;
  }
  return { file, card, stats };
}

module.exports = {
  SHARES_DIR,
  REPO_URL,
  generate,
  buildCard,
  collectStats,
  formatDuration,
  describeAlignment
};
