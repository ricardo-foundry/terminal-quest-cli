/**
 * @module leaderboard
 * @description Local leaderboard built directly from the slot files in
 *   ~/.terminal-quest/saves. There is no network hop and no separate
 *   ranking file — the slots ARE the ranking. We just read each one,
 *   extract the metadata that matters (level, exp, playtime, quest count,
 *   achievements), and sort.
 *
 * Public surface:
 *   collectEntries()             -> Entry[]
 *   topN(n)                      -> Entry[] (default 10)
 *   exportText()                 -> human-readable + machine-friendly block
 *   importText(text)             -> { ok, imported, skipped, errors }
 *
 * Entry shape:
 *   { slot, level, exp, achievements, builtInQuests, communityQuests,
 *     totalQuests, playtimeMs, savedAt, score }
 *
 * `score` is the sort key — a weighted blend so that a level-9 savant
 * with 30 achievements beats a level-12 grinder with 5. Tunable below.
 *
 * The module is intentionally pure-data; no chalk, no readline. The CLI
 * wraps it in `top` and `--export-leaderboard`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const saveMod = require('./save');

const TOP_N_DEFAULT = 10;

// Score weights — light tuning to make the leaderboard feel rewarding for
// completionists rather than grinders. EXP carries the basic momentum,
// achievements add substantial bumps, quests are worth the most per unit.
const SCORE = {
  exp: 1,
  achievement: 50,
  builtInQuest: 80,
  communityQuest: 100,
  level: 25,
  // small bonus for variety: number of locales tried, npc affinity peaks
  localeVariety: 30,
  affinityPeak: 0.5
};

/**
 * Read every save slot and produce a leaderboard entry per slot.
 *
 * @returns {Array<object>}
 */
function collectEntries() {
  const slots = saveMod.listSlots();
  const out = [];
  for (const meta of slots) {
    try {
      const payload = saveMod.load(meta.slot);
      if (!payload || !payload.state) continue;
      const s = payload.state;
      const built = s.questsState
        ? Object.values(s.questsState).filter((q) => q && q.completed).length
        : 0;
      const community = Number(s.questPackDone || 0);
      const achievements = Array.isArray(s.achievements) ? s.achievements.length : 0;
      const playtimeMs = Math.max(
        Number(s.playtimeMs || 0),
        Number(s.startTime ? Math.max(0, (payload.savedAt || Date.now()) - s.startTime) : 0)
      );
      const localesUsed = Array.isArray(s.localesUsed) ? s.localesUsed.length : 1;
      const affinityPeak = Math.max(
        0,
        ...Object.values(s.npcAffinity || {}).map((v) => Number(v) || 0),
        0
      );
      const entry = {
        slot: meta.slot,
        level: Number(s.level || 1),
        exp: Number(s.exp || 0),
        achievements,
        builtInQuests: built,
        communityQuests: community,
        totalQuests: built + community,
        playtimeMs,
        savedAt: payload.savedAt || meta.savedAt || 0,
        localesUsed,
        affinityPeak
      };
      entry.score =
        entry.exp * SCORE.exp +
        entry.achievements * SCORE.achievement +
        entry.builtInQuests * SCORE.builtInQuest +
        entry.communityQuests * SCORE.communityQuest +
        entry.level * SCORE.level +
        entry.localesUsed * SCORE.localeVariety +
        entry.affinityPeak * SCORE.affinityPeak;
      out.push(entry);
    } catch (_) {
      /* skip unreadable slot */
    }
  }
  // descending by score
  out.sort((a, b) => b.score - a.score);
  return out;
}

function topN(n) {
  const k = Math.max(1, Math.min(50, Number(n || TOP_N_DEFAULT)));
  return collectEntries().slice(0, k);
}

/**
 * Format playtime in ms as a short human string (e.g. "1h 04m", "3m 12s").
 */
function fmtPlaytime(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/**
 * Render a Markdown-style export block. The block is bracketed by sentinel
 * lines so importText() can find it inside a longer document or chat log.
 *
 * @returns {string}
 */
function exportText() {
  const entries = collectEntries();
  const lines = [];
  lines.push('=== TERMINAL-QUEST LEADERBOARD v1 ===');
  lines.push('# rank  slot                level  exp     ach  quests  playtime  score');
  entries.forEach((e, i) => {
    const rank = String(i + 1).padStart(2);
    const slot = String(e.slot).padEnd(18);
    const level = `Lv.${e.level}`.padEnd(5);
    const exp = String(e.exp).padEnd(6);
    const ach = String(e.achievements).padEnd(3);
    const q = String(e.totalQuests).padEnd(6);
    const pt = fmtPlaytime(e.playtimeMs).padEnd(8);
    const score = Math.round(e.score);
    lines.push(`${rank}    ${slot}  ${level}  ${exp}  ${ach}  ${q}  ${pt}  ${score}`);
  });
  lines.push('--- DATA ---');
  // machine-readable JSON line per entry; importText can pick this up.
  for (const e of entries) {
    lines.push('LBE ' + JSON.stringify({
      slot: e.slot, level: e.level, exp: e.exp, achievements: e.achievements,
      builtInQuests: e.builtInQuests, communityQuests: e.communityQuests,
      playtimeMs: e.playtimeMs, savedAt: e.savedAt, score: Math.round(e.score)
    }));
  }
  lines.push('=== END LEADERBOARD ===');
  return lines.join('\n');
}

/**
 * Parse an exportText() block back into Entry[]. Tolerant of leading
 * banter (e.g. someone pasted into a chat); only inspects lines that begin
 * with "LBE ".
 *
 * @param {string} text
 * @returns {{ ok: boolean, imported: number, skipped: number, errors: string[], entries: object[] }}
 */
function importText(text) {
  const out = { ok: true, imported: 0, skipped: 0, errors: [], entries: [] };
  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, imported: 0, skipped: 0, errors: ['empty input'], entries: [] };
  }
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('LBE ')) continue;
    try {
      const obj = JSON.parse(line.slice(4));
      if (!obj || typeof obj !== 'object' || !obj.slot) {
        out.skipped++;
        continue;
      }
      out.entries.push(obj);
      out.imported++;
    } catch (e) {
      out.errors.push(`could not parse line: ${line.slice(0, 60)}`);
      out.skipped++;
    }
  }
  if (out.imported === 0 && out.errors.length > 0) out.ok = false;
  return out;
}

module.exports = {
  TOP_N_DEFAULT,
  SCORE,
  collectEntries,
  topN,
  exportText,
  importText,
  fmtPlaytime
};
