/**
 * @module time
 * @description In-game day/night cycle and area access rules.
 *
 * The game tracks "turns" in `gameState.turn`:
 *   - each interactive command spends 1 turn,
 *   - `wait <n>` / `sleep` advance more,
 *   - `cd` into a new area also advances 1 turn.
 *
 * A full day is 24 turns split into 4 equal phases:
 *   Dawn (0-5)  Day (6-11)  Dusk (12-17)  Night (18-23)
 *
 * `accessRule(path, phase)` is the single source of truth for
 * phase-gated areas (lab, archive). Keeping the rules here means
 * cd-gating elsewhere is one line.
 */

const PHASES = [
  { name: 'dawn',  label: 'Dawn',  icon: '🌅', start: 0,  end: 6 },
  { name: 'day',   label: 'Day',   icon: '☀️', start: 6,  end: 12 },
  { name: 'dusk',  label: 'Dusk',  icon: '🌇', start: 12, end: 18 },
  { name: 'night', label: 'Night', icon: '🌙', start: 18, end: 24 }
];

const DAY_LENGTH = 24;

function normalizeTurn(turn) {
  const t = Number(turn) || 0;
  const mod = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  return mod;
}

function getPhase(turn) {
  const t = normalizeTurn(turn);
  for (const p of PHASES) {
    if (t >= p.start && t < p.end) return p;
  }
  return PHASES[0];
}

// Advance by N turns; returns the new total and a list of phases that
// were newly entered in this call (may include multiple if N is large).
//
// iter-16: clamp `n` so a bogus value (e.g. `1e10` from a malformed
// community quest, a corrupt save, or a fuzzed input) cannot blow the
// transition loop into a RangeError. We never need more than one full
// year ahead at once -- callers that want to skip further simply call
// advance() again. The clamp keeps the loop bounded and the save sane.
const MAX_ADVANCE = 4 * 30; // one in-game year (4 seasons * 30 days)

function advance(state, n = 1) {
  const before = Number(state.turn) || 0;
  let delta = Number(n);
  if (!Number.isFinite(delta)) delta = 0;
  // floor toward zero, clamp to one year max
  delta = Math.trunc(delta);
  if (delta > MAX_ADVANCE) delta = MAX_ADVANCE;
  if (delta < -MAX_ADVANCE) delta = -MAX_ADVANCE;
  const after = before + delta;
  const phases = [];
  const beforePhase = getPhase(before);
  const afterPhase = getPhase(after);
  if (beforePhase.name !== afterPhase.name && delta > 0) {
    // list every phase transition crossed (forward only — backwards
    // travel is rare and we don't surface "newPhases" for it)
    for (let i = before + 1; i <= after; i++) {
      const p = getPhase(i);
      if (!phases.length || phases[phases.length - 1].name !== p.name) {
        phases.push(p);
      }
    }
  }
  state.turn = after;
  return { turn: after, newPhases: phases, phase: afterPhase };
}

function formatClock(turn) {
  const t = normalizeTurn(turn);
  // 1 turn = 1 in-game hour
  const hh = String(t).padStart(2, '0');
  return `${hh}:00`;
}

// Returns access restrictions for a given area at the given phase.
// Keeps the rule data centralised so cd-gating is one line elsewhere.
function accessRule(path, phase) {
  // Lab only accessible during day / dusk
  if (path && path.startsWith('/world/lab')) {
    if (phase.name === 'night') {
      return { allowed: false, reason: 'The lab lights are out. Come back when it is brighter.' };
    }
  }
  // Archive only at night/dusk (the archivist sleeps by day)
  if (path && path.startsWith('/shadow/archive')) {
    if (phase.name === 'day' || phase.name === 'dawn') {
      return { allowed: false, reason: 'The archive doors are sealed during daylight.' };
    }
  }
  return { allowed: true };
}

module.exports = {
  PHASES,
  DAY_LENGTH,
  normalizeTurn,
  getPhase,
  advance,
  formatClock,
  accessRule
};
