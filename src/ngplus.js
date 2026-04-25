/**
 * @module ngplus
 * @description New Game+ support and idle/AFK detection.
 *
 * Two unrelated-but-small features ship in one module so they can share
 * test scaffolding (both are pure-state helpers with no I/O coupling
 * outside of optional callback hooks).
 *
 * --- New Game+ -----------------------------------------------------------
 *
 * NG+ is unlocked once the player finishes the main story (the
 * `unlock_master` quest, which mirrors the legacy "completionist" milestone
 * achievement). When the user passes `--ng` on the next launch:
 *
 *   1. The current slot is archived (re-uses bin/archiveSlot semantics).
 *   2. A *fresh* gameState is written, BUT carrying forward:
 *        - achievements (id list + achievementsState map)
 *        - npcAffinity, npcTalkCount
 *        - cumulative stats (totalCommands, totalPlaytimeMs, ngCount)
 *        - unlocked community quests (`communityQuestState`)
 *   3. `ngPlus = true` flips on, `ngCount` increments. NPC dialogue picks
 *      this flag up to greet the player as a returning soul.
 *
 * The carry-over is intentionally narrow: world progression (visited dirs,
 * inventory, key fragments, master-key state, alignment) all reset so the
 * player can play the campaign again with their badge collection intact.
 *
 * --- Idle / AFK ----------------------------------------------------------
 *
 * `IdleTimer` is a small wrapper around `setTimeout` with two thresholds:
 *
 *   - 5 minutes  -> soft prompt ("Are you still there?")
 *   - 10 minutes -> autosave + warning (does NOT exit the game)
 *
 * The timer is tick-based so tests can drive it deterministically by
 * passing a `now()` and a `schedule()` shim. In production we let it use
 * `Date.now` and `setTimeout` directly.
 */

'use strict';

const NG_CARRY_KEYS = [
  'achievements',
  'achievementsState',
  'npcAffinity',
  'npcTalkCount',
  'localesUsed',
  'communityQuestState',
  'totalCommands',
  'totalPlaytimeMs',
  'ngCount',
  'ngAchievements',
  'unlockedQuestIds'
];

const IDLE_SOFT_MS = 5 * 60 * 1000;   // 5 minutes
const IDLE_HARD_MS = 10 * 60 * 1000;  // 10 minutes

/**
 * Has the player reached the NG+ milestone? We check the canonical end-of-
 * story flag (`masterUnlocked`) AND the unlock-master quest, so old saves
 * that completed the quest before the flag was widened still qualify.
 *
 * @param {object} state any gameState envelope
 * @returns {boolean}
 */
function hasUnlockedNgPlus(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.masterUnlocked === true) return true;
  const qs = state.questsState || {};
  if (qs.unlock_master && qs.unlock_master.completed) return true;
  // Legacy: some saves only tracked the achievement.
  const ach = Array.isArray(state.achievements) ? state.achievements : [];
  if (ach.includes('unlock_master')) return true;
  return false;
}

/**
 * Build a fresh gameState by selectively copying a subset of fields from
 * `prev` onto `defaults`. Used by the `--ng` flag and also by the test
 * harness to drive deterministic NG+ rollovers.
 *
 * - Achievements are de-duplicated and stay unlocked.
 * - Cumulative stats are added together (so the in-game `status` view can
 *   show "lifetime" totals across NG cycles).
 * - npcAffinity / npcTalkCount are spread (the player keeps the rapport
 *   they earned, even though the world resets).
 * - All other fields fall through to `defaults`.
 *
 * @param {object} prev      previous run's gameState
 * @param {object} defaults  pristine DEFAULT_STATE clone
 * @returns {object} new gameState ready to be saved
 */
function buildNgPlusState(prev, defaults) {
  const safePrev = prev && typeof prev === 'object' ? prev : {};
  const next = { ...defaults };
  next.startTime = Date.now();
  next.firstLaunch = false;
  next.ngPlus = true;

  // 1. achievements carry over (unlocked stay unlocked)
  const prevAch = Array.isArray(safePrev.achievements) ? safePrev.achievements : [];
  next.achievements = Array.from(new Set(prevAch));

  const prevAchState = (safePrev.achievementsState && typeof safePrev.achievementsState === 'object')
    ? safePrev.achievementsState
    : {};
  next.achievementsState = {};
  for (const [id, st] of Object.entries(prevAchState)) {
    if (st && st.unlocked) next.achievementsState[id] = { unlocked: true };
  }

  // 2. affinity & talk counts
  next.npcAffinity = { ...(safePrev.npcAffinity || {}) };
  next.npcTalkCount = { ...(safePrev.npcTalkCount || {}) };

  // 3. locales used (Polyglot stays earned)
  next.localesUsed = Array.isArray(safePrev.localesUsed)
    ? Array.from(new Set(safePrev.localesUsed))
    : [];

  // 4. community quest unlock map carries (so finished community arcs are
  //    not re-required, but the *built-in* questsState resets via defaults).
  next.communityQuestState = (safePrev.communityQuestState && typeof safePrev.communityQuestState === 'object')
    ? { ...safePrev.communityQuestState }
    : {};

  // 5. cumulative counters
  next.totalCommands = Number(safePrev.totalCommands || 0)
    + Number(safePrev.sessionCommands || 0);
  next.totalPlaytimeMs = Number(safePrev.totalPlaytimeMs || 0)
    + Number(safePrev.playtimeMs || 0);
  next.ngCount = Number(safePrev.ngCount || 0) + 1;

  // 6. NG+ exclusive achievement bookkeeping (untouched if absent)
  next.ngAchievements = Array.isArray(safePrev.ngAchievements)
    ? Array.from(new Set(safePrev.ngAchievements))
    : [];

  // 7. record which community quest ids were ever finished so the player
  //    can see "previously unlocked" badges in NG+ runs.
  const prevUnlocked = Array.isArray(safePrev.unlockedQuestIds) ? safePrev.unlockedQuestIds : [];
  const fromCommunity = Object.entries(safePrev.communityQuestState || {})
    .filter(([, v]) => v && v.done)
    .map(([id]) => id);
  next.unlockedQuestIds = Array.from(new Set([...prevUnlocked, ...fromCommunity]));

  return next;
}

/**
 * Decorate a base NPC greeting with an NG+ aware prefix. Returning an
 * untouched line when the player isn't in NG+ keeps existing dialogue
 * tests working without modification.
 *
 * @param {string} baseLine
 * @param {object} state
 * @returns {string}
 */
function ngGreeting(baseLine, state) {
  if (!state || !state.ngPlus) return baseLine;
  const n = Number(state.ngCount || 1);
  const prefix = n >= 2
    ? `Welcome back again, traveler... (cycle ${n}). `
    : 'Welcome back, traveler... ';
  return prefix + (baseLine || '');
}

/**
 * @typedef {Object} IdleConfig
 * @property {number}   [softMs]   override soft (prompt) threshold
 * @property {number}   [hardMs]   override hard (autosave) threshold
 * @property {Function} [onSoft]   called once when soft threshold is hit
 * @property {Function} [onHard]   called once when hard threshold is hit
 * @property {Function} [now]      time provider (defaults to Date.now)
 * @property {Function} [schedule] timer factory (defaults to setTimeout)
 *                                 must return a handle accepted by `cancel`
 * @property {Function} [cancel]   timer canceller (defaults to clearTimeout)
 */

/**
 * Two-step idle timer. `notify(now)` lets external drivers (like a fake
 * clock in tests) push the timer forward without touching real wall time.
 *
 * @param {IdleConfig} [cfg]
 */
function createIdleTimer(cfg) {
  const c = cfg || {};
  const softMs = Number(c.softMs) > 0 ? Number(c.softMs) : IDLE_SOFT_MS;
  const hardMs = Number(c.hardMs) > 0 ? Number(c.hardMs) : IDLE_HARD_MS;
  const now = typeof c.now === 'function' ? c.now : Date.now;
  const schedule = typeof c.schedule === 'function' ? c.schedule : setTimeout;
  const cancel = typeof c.cancel === 'function' ? c.cancel : clearTimeout;
  const onSoft = typeof c.onSoft === 'function' ? c.onSoft : () => {};
  const onHard = typeof c.onHard === 'function' ? c.onHard : () => {};

  let lastActivity = now();
  let softFired = false;
  let hardFired = false;
  let softHandle = null;
  let hardHandle = null;

  function clearHandles() {
    if (softHandle) { try { cancel(softHandle); } catch (_) { /* ignore */ } softHandle = null; }
    if (hardHandle) { try { cancel(hardHandle); } catch (_) { /* ignore */ } hardHandle = null; }
  }

  function arm() {
    clearHandles();
    softHandle = schedule(() => {
      if (softFired) return;
      softFired = true;
      try { onSoft(); } catch (_) { /* ignore */ }
    }, softMs);
    hardHandle = schedule(() => {
      if (hardFired) return;
      hardFired = true;
      try { onHard(); } catch (_) { /* ignore */ }
    }, hardMs);
  }

  /** Mark the user as active and reset both thresholds. */
  function bump() {
    lastActivity = now();
    softFired = false;
    hardFired = false;
    arm();
  }

  /**
   * Synchronous notify — used by tests to drive the clock without timers.
   * Compares "now" against the last activity and fires whichever threshold
   * was crossed (each fires at most once until the next `bump`).
   *
   * @param {number} [t] override "now" in ms
   */
  function notify(t) {
    const cur = typeof t === 'number' ? t : now();
    const elapsed = cur - lastActivity;
    if (!softFired && elapsed >= softMs) {
      softFired = true;
      try { onSoft(); } catch (_) { /* ignore */ }
    }
    if (!hardFired && elapsed >= hardMs) {
      hardFired = true;
      try { onHard(); } catch (_) { /* ignore */ }
    }
  }

  function stop() { clearHandles(); }

  function status() {
    return { softFired, hardFired, lastActivity, softMs, hardMs };
  }

  return { bump, notify, stop, status };
}

module.exports = {
  NG_CARRY_KEYS,
  IDLE_SOFT_MS,
  IDLE_HARD_MS,
  hasUnlockedNgPlus,
  buildNgPlusState,
  ngGreeting,
  createIdleTimer
};
