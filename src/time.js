// ============================================
// Terminal Quest CLI - in-game time & day/night cycle
// ============================================
// The game tracks "turns": each interactive command is 1 turn, wait commands
// advance more. A full day-night cycle is 24 turns split into 4 phases.

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
function advance(state, n = 1) {
  const before = Number(state.turn) || 0;
  const after = before + (Number(n) || 0);
  const phases = [];
  const beforePhase = getPhase(before);
  const afterPhase = getPhase(after);
  if (beforePhase.name !== afterPhase.name) {
    // list every phase transition crossed
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
