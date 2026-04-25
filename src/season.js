/**
 * @module season
 * @description Long-cycle "season" axis layered on top of the 24-turn
 *   day/night cycle from `time.js`.
 *
 * Concept:
 *   - 4 seasons: spring, summer, autumn, winter
 *   - 30 turns per season (so a full year is 120 turns)
 *   - season is derived from `gameState.turn` purely; no extra state to
 *     persist beyond what time.js already keeps
 *
 * Side effects:
 *   - Some NPCs have season-specific behaviour (e.g. shop NPC closes in
 *     winter; researcher rare in summer). The hook is exposed via
 *     `npcAvailable(npcId, season)` which returns { open: bool, reason? }.
 *   - Some quests can gate steps via `seasonOnly: 'winter'` etc.; this
 *     module exports `matchesSeason(gs, expected)` for the quest evaluator.
 *
 * UI:
 *   - `formatSeasonBadge(turn)` returns "🌸 Spring (12/30)" style text
 *     suitable for the prompt header.
 */

'use strict';

const SEASON_LENGTH = 30;
const SEASONS = [
  { name: 'spring', label: 'Spring', icon: '🌸' },
  { name: 'summer', label: 'Summer', icon: '☀️' },
  { name: 'autumn', label: 'Autumn', icon: '🍂' },
  { name: 'winter', label: 'Winter', icon: '❄️' }
];
const YEAR_LENGTH = SEASONS.length * SEASON_LENGTH;

function getSeason(turn) {
  const t = Number(turn) || 0;
  const wrapped = ((t % YEAR_LENGTH) + YEAR_LENGTH) % YEAR_LENGTH;
  const idx = Math.floor(wrapped / SEASON_LENGTH);
  return SEASONS[idx];
}

// 1-based "day" within current season, useful for the UI badge.
function dayOfSeason(turn) {
  const t = Number(turn) || 0;
  const wrapped = ((t % YEAR_LENGTH) + YEAR_LENGTH) % YEAR_LENGTH;
  return (wrapped % SEASON_LENGTH) + 1;
}

function formatSeasonBadge(turn) {
  const s = getSeason(turn);
  const d = dayOfSeason(turn);
  return `${s.icon} ${s.label} (${d}/${SEASON_LENGTH})`;
}

// Simple year counter (0 for the first 120 turns, 1 for the next, ...).
function yearOf(turn) {
  const t = Number(turn) || 0;
  return Math.floor(t / YEAR_LENGTH);
}

// Returns the new seasons crossed when advancing from `before` to `after`.
function seasonsBetween(before, after) {
  const seen = [];
  const fromIdx = Math.floor((((before % YEAR_LENGTH) + YEAR_LENGTH) % YEAR_LENGTH) / SEASON_LENGTH);
  for (let i = before + 1; i <= after; i++) {
    const idx = Math.floor((((i % YEAR_LENGTH) + YEAR_LENGTH) % YEAR_LENGTH) / SEASON_LENGTH);
    if (!seen.length && idx === fromIdx) continue;
    if (!seen.length || seen[seen.length - 1].name !== SEASONS[idx].name) {
      seen.push(SEASONS[idx]);
    }
  }
  return seen;
}

// NPC availability hook. Default: open. Specific NPCs close in
// thematically appropriate seasons.
function npcAvailable(npcId, season) {
  if (!season || !season.name) return { open: true };
  if (npcId === 'shop' && season.name === 'winter') {
    return { open: false, reason: 'The shop shutters are closed for winter. Try again in spring.' };
  }
  if (npcId === 'merchant' && season.name === 'winter') {
    return { open: false, reason: 'The wandering merchant rests in winter. Spring is around the corner.' };
  }
  if (npcId === 'researcher' && season.name === 'summer') {
    return { open: false, reason: 'The researcher is on a summer expedition. They left the lab dark.' };
  }
  return { open: true };
}

// Quest helper: does the current season match expected?
// expected may be a string ('winter'), an array of strings, or 'any'.
function matchesSeason(gs, expected) {
  if (!expected || expected === 'any') return true;
  const cur = getSeason((gs && gs.turn) || 0).name;
  if (Array.isArray(expected)) return expected.includes(cur);
  return cur === expected;
}

module.exports = {
  SEASON_LENGTH, YEAR_LENGTH, SEASONS,
  getSeason, dayOfSeason, formatSeasonBadge, yearOf,
  seasonsBetween, npcAvailable, matchesSeason
};
