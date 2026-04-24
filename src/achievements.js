// ============================================
// Terminal Quest CLI - achievement definitions and evaluator
// ============================================
// Split out from data.js in v2.1 so new achievements can be added
// without touching the giant FILE_SYSTEM literal.
//
// Each achievement has:
//   id, name, icon, desc, reward, category, hidden?, unlocked
//   check(gs): function that returns true when conditions are met.
//              Absence of check means it is only ever unlocked imperatively.

// Category tags: exploration / puzzle / combat / collection / speedrun / hidden
const EXTRA_ACHIEVEMENTS = {
  'night_owl': {
    id: 'night_owl',
    name: 'Night Owl',
    icon: '🦉',
    desc: 'Play during the in-game night cycle',
    reward: '25 EXP',
    category: 'exploration',
    unlocked: false,
    check: (gs) => !!gs.nightVisited
  },
  'early_bird': {
    id: 'early_bird',
    name: 'Early Bird',
    icon: '🐦',
    desc: 'Play during the in-game dawn cycle',
    reward: '25 EXP',
    category: 'exploration',
    unlocked: false,
    check: (gs) => !!gs.dawnVisited
  },
  'time_traveller': {
    id: 'time_traveller',
    name: 'Time Traveller',
    icon: '⏳',
    desc: 'Witness all four day/night phases',
    reward: '80 EXP',
    category: 'exploration',
    unlocked: false,
    check: (gs) => (gs.phasesSeen || []).length >= 4
  },
  'lab_rat': {
    id: 'lab_rat',
    name: 'Lab Rat',
    icon: '🧪',
    desc: 'Visit the abandoned lab',
    reward: '60 EXP',
    category: 'exploration',
    unlocked: false,
    check: (gs) => (gs.visitedDirs || []).includes('/world/lab')
  },
  'archivist': {
    id: 'archivist',
    name: 'Archivist',
    icon: '📚',
    desc: 'Find the underground archive',
    reward: '60 EXP',
    category: 'exploration',
    unlocked: false,
    check: (gs) => (gs.visitedDirs || []).includes('/shadow/archive')
  },
  'good_soul': {
    id: 'good_soul',
    name: 'Good Soul',
    icon: '😇',
    desc: 'Reach full kindness alignment (+5)',
    reward: '150 EXP',
    category: 'puzzle',
    unlocked: false,
    check: (gs) => (gs.alignment || 0) >= 5
  },
  'cold_heart': {
    id: 'cold_heart',
    name: 'Cold Heart',
    icon: '🥶',
    desc: 'Reach full ruthless alignment (-5)',
    reward: '150 EXP',
    category: 'puzzle',
    unlocked: false,
    check: (gs) => (gs.alignment || 0) <= -5
  },
  'sharpshooter': {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    icon: '🎯',
    desc: 'Win the reaction QTE',
    reward: '80 EXP',
    category: 'combat',
    unlocked: false,
    check: (gs) => !!gs.qteWon
  },
  'logician': {
    id: 'logician',
    name: 'Logician',
    icon: '🧠',
    desc: 'Solve the logic-circuit puzzle',
    reward: '120 EXP',
    category: 'puzzle',
    unlocked: false,
    check: (gs) => !!gs.logicSolved
  },
  'morse_master': {
    id: 'morse_master',
    name: 'Morse Master',
    icon: '📡',
    desc: 'Decode a morse message without hints',
    reward: '100 EXP',
    category: 'puzzle',
    unlocked: false,
    check: (gs) => !!gs.morseSolved
  },
  'hoarder': {
    id: 'hoarder',
    name: 'Hoarder',
    icon: '🎒',
    desc: 'Carry 8 or more items at once',
    reward: '80 EXP',
    category: 'collection',
    unlocked: false,
    check: (gs) => (gs.inventory || []).length >= 8
  },
  'alias_whisperer': {
    id: 'alias_whisperer',
    name: 'Alias Whisperer',
    icon: '🔤',
    desc: 'Create your first custom alias',
    reward: '20 EXP',
    category: 'hidden',
    unlocked: false,
    check: (gs) => Object.keys(gs.aliases || {}).some((k) => !['ll', '.', '..', 'h', 'c', 'l'].includes(k))
  },
  'speed_demon': {
    id: 'speed_demon',
    name: 'Speed Demon',
    icon: '⚡',
    desc: 'Reach level 3 within 5 minutes',
    reward: '200 EXP',
    category: 'speedrun',
    unlocked: false,
    check: (gs) => gs.level >= 3 && (Date.now() - (gs.startTime || Date.now())) < 5 * 60 * 1000
  },
  'card_shark': {
    id: 'card_shark',
    name: 'Card Shark',
    icon: '🃏',
    desc: 'Generate your first share card',
    reward: '50 EXP',
    category: 'hidden',
    unlocked: false,
    check: (gs) => (gs.shareCount || 0) >= 1
  },
  'philosopher': {
    id: 'philosopher',
    name: 'Philosopher',
    icon: '🤔',
    desc: 'Hold a conversation in all three NPC moods',
    reward: '120 EXP',
    category: 'hidden',
    unlocked: false,
    check: (gs) => (gs.npcMoodsSeen || []).length >= 3
  },
  'historian': {
    id: 'historian',
    name: 'Historian',
    icon: '📜',
    desc: 'Type 50 commands in one session',
    reward: '40 EXP',
    category: 'hidden',
    unlocked: false,
    check: (gs) => (gs.sessionCommands || 0) >= 50
  }
};

// Evaluate automatic unlocks against current state.
// Returns a list of newly-unlockable achievement IDs.
function evaluateAutoUnlocks(achievements, gs) {
  const out = [];
  for (const [id, ach] of Object.entries(achievements)) {
    if (ach.unlocked) continue;
    if (typeof ach.check !== 'function') continue;
    try {
      if (ach.check(gs)) out.push(id);
    } catch (_) { /* ignore broken checks */ }
  }
  return out;
}

// Group by category — used by the `achievements` UI view.
function groupByCategory(achievements) {
  const groups = {};
  for (const ach of Object.values(achievements)) {
    const cat = ach.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(ach);
  }
  return groups;
}

module.exports = {
  EXTRA_ACHIEVEMENTS,
  evaluateAutoUnlocks,
  groupByCategory
};
