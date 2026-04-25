/**
 * @module achievements
 * @description The 16 v2.1 "extra" achievements plus the auto-unlock evaluator.
 *
 * Split out from data.js in v2.1 so new achievements can be added without
 * touching the giant FILE_SYSTEM literal.
 *
 * Each entry has:
 *   id, name, icon, desc, reward, category, hidden?, unlocked
 *   check(gs)  — returns true when the achievement should fire.
 *                Absence of `check` means it is only unlocked imperatively
 *                (via `game.unlockAchievement(id)` from a command handler).
 *
 * IMPORTANT: `check` functions do NOT survive JSON round-trips. After a
 * `load`, callers must re-attach them from this module — see
 * commands.js#cmdLoad and game.js#constructor.
 */

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
  },
  // v2.4 additions -----------------------------------------------------
  'completionist_v24': {
    id: 'completionist_v24',
    name: 'Completionist',
    icon: '🌟',
    desc: 'Complete every community quest in the loaded pack',
    reward: '400 EXP',
    category: 'collection',
    unlocked: false,
    check: (gs) => {
      const total = (gs.questPackTotal || 0);
      const done = (gs.questPackDone || 0);
      return total > 0 && done >= total;
    }
  },
  'speedrunner_v24': {
    id: 'speedrunner_v24',
    name: 'Speedrunner',
    icon: '🏃',
    desc: 'Reach level 5 within 15 minutes',
    reward: '400 EXP',
    category: 'speedrun',
    unlocked: false,
    check: (gs) => (gs.level || 1) >= 5 &&
      (Date.now() - (gs.startTime || Date.now())) < 15 * 60 * 1000
  },
  'historian_v24': {
    id: 'historian_v24',
    name: 'Historian II',
    icon: '🏺',
    desc: 'Visit both the old library and the train station',
    reward: '150 EXP',
    category: 'exploration',
    unlocked: false,
    check: (gs) => (gs.visitedDirs || []).includes('/library')
      && (gs.visitedDirs || []).includes('/station')
  },
  'pacifist': {
    id: 'pacifist',
    name: 'Pacifist',
    icon: '🕊️',
    desc: 'Win the game without ever dropping alignment below zero',
    reward: '250 EXP',
    category: 'puzzle',
    unlocked: false,
    check: (gs) => !!gs.masterUnlocked && (gs.minAlignment === undefined || gs.minAlignment >= 0)
  },
  'collector_v24': {
    id: 'collector_v24',
    name: 'Collector',
    icon: '🧰',
    desc: 'Hold at least one item from every category',
    reward: '150 EXP',
    category: 'collection',
    unlocked: false,
    check: (gs) => {
      const inv = gs.inventory || [];
      const has = { key: false, consumable: false, equipment: false, collectible: false };
      // inline mini-classifier so this file has no cross-deps
      for (const it of inv) {
        if (/key|shard|fragment/i.test(it)) has.key = true;
        else if (/potion|elixir/i.test(it)) has.consumable = true;
        else if (/torch|sword|armor|detector/i.test(it)) has.equipment = true;
        else has.collectible = true;
      }
      return has.key && has.consumable && has.equipment && has.collectible;
    }
  },

  // v2.7 (iter-14) additions ----------------------------------------------
  // Cross-locale achievement: rewards players who actually try the language
  // switch. `localesUsed` is a Set-like array on gameState updated by
  // `lang <code>` and by the boot-time auto-detect.
  'polyglot': {
    id: 'polyglot',
    name: 'Polyglot',
    icon: '🌐',
    desc: 'Play with 4 different languages active',
    reward: '120 EXP',
    category: 'hidden',
    unlocked: false,
    check: (gs) => Array.isArray(gs.localesUsed) && gs.localesUsed.length >= 4
  },

  // Survive 12 consecutive night phases without dying. This game has no
  // formal "death" mechanic; we treat any negative-alignment swing followed
  // by a dawn reset as a "survival." The counter `nightSurvivedStreak` is
  // bumped each time the player successfully exits the night phase without
  // their alignment dipping below the `minAlignment` watermark.
  'night_shift': {
    id: 'night_shift',
    name: 'Night Shift',
    icon: '🌙',
    desc: 'Survive 12 consecutive night phases unscathed',
    reward: '200 EXP',
    category: 'speedrun',
    unlocked: false,
    check: (gs) => Number(gs.nightSurvivedStreak || 0) >= 12
  },

  // Befriend the merchant — affinity >= 80 with NPC id "shop".
  'merchant_friend': {
    id: 'merchant_friend',
    name: "Merchant's Friend",
    icon: '🤝',
    desc: 'Reach affinity >= 80 with the merchant',
    reward: '180 EXP',
    category: 'collection',
    unlocked: false,
    check: (gs) => {
      const a = gs.npcAffinity || {};
      return Number(a.shop || 0) >= 80;
    }
  },

  // Quest grinder — finish 5 community quests OR built-in quests.
  'completionist_quest': {
    id: 'completionist_quest',
    name: 'Quest Completionist',
    icon: '📜',
    desc: 'Complete 5 quests (built-in or community)',
    reward: '250 EXP',
    category: 'collection',
    unlocked: false,
    check: (gs) => {
      const builtIn = gs.questsState
        ? Object.values(gs.questsState).filter((q) => q && q.completed).length
        : 0;
      const community = Number(gs.questPackDone || 0);
      return (builtIn + community) >= 5;
    }
  },

  // Silent runner — finish at least one community quest without ever opening
  // the in-game `history` panel. The flag `historyOpened` flips to true the
  // first time a player runs `history`; the achievement only fires when a
  // quest finishes while it is still false.
  'silent_runner': {
    id: 'silent_runner',
    name: 'Silent Runner',
    icon: '🤫',
    desc: 'Finish a quest without ever opening `history`',
    reward: '120 EXP',
    category: 'speedrun',
    unlocked: false,
    check: (gs) => {
      const community = Number(gs.questPackDone || 0);
      const builtIn = gs.questsState
        ? Object.values(gs.questsState).filter((q) => q && q.completed).length
        : 0;
      return (community + builtIn) >= 1 && !gs.historyOpened;
    }
  },

  // v2.9 (iter-19) New Game+ exclusives ----------------------------------
  // All five only fire while the player is in an NG+ run (`ngPlus === true`).
  // They form a small "encore" badge set rewarding loyalty without
  // gating any content the first-pass player might want.
  'recurring_soul': {
    id: 'recurring_soul',
    name: 'Recurring Soul',
    icon: '♻️',
    desc: 'Begin a New Game+ cycle',
    reward: '300 EXP',
    category: 'ngplus',
    unlocked: false,
    check: (gs) => !!gs.ngPlus
  },

  'echo_of_past': {
    id: 'echo_of_past',
    name: 'Echo of Past',
    icon: '🪞',
    desc: 'Revisit /world/nexus during NG+',
    reward: '180 EXP',
    category: 'ngplus',
    unlocked: false,
    check: (gs) => !!gs.ngPlus && (gs.visitedDirs || []).includes('/world/nexus')
  },

  'second_dawn': {
    id: 'second_dawn',
    name: 'Second Dawn',
    icon: '🌄',
    desc: 'Witness a dawn cycle in NG+',
    reward: '180 EXP',
    category: 'ngplus',
    unlocked: false,
    check: (gs) => !!gs.ngPlus && !!gs.dawnVisited
  },

  'ouroboros': {
    id: 'ouroboros',
    name: 'Ouroboros',
    icon: '🐍',
    desc: 'Reach the third NG+ cycle',
    reward: '500 EXP',
    category: 'ngplus',
    unlocked: false,
    check: (gs) => !!gs.ngPlus && Number(gs.ngCount || 0) >= 3
  },

  'mentor_to_self': {
    id: 'mentor_to_self',
    name: 'Mentor to Self',
    icon: '🧓',
    desc: 'Re-complete the unlock_master quest in NG+',
    reward: '600 EXP',
    category: 'ngplus',
    unlocked: false,
    check: (gs) => {
      if (!gs.ngPlus) return false;
      const qs = gs.questsState || {};
      return !!(qs.unlock_master && qs.unlock_master.completed);
    }
  },

  // v2.10 (iter-20) easter egg --------------------------------------------
  // Hidden achievement awarded for finishing the `echo-of-claude` community
  // quest (any branch). The achievement itself is hidden from the panel
  // until it unlocks, matching its lore: a quiet thank-you from the
  // benevolent assistant haunting the terminal.
  'ghost_in_the_machine': {
    id: 'ghost_in_the_machine',
    name: 'Ghost in the Machine',
    icon: '👻',
    desc: 'Finish the echo-of-claude quest (any branch)',
    reward: '300 EXP',
    category: 'hidden',
    hidden: true,
    unlocked: false,
    check: (gs) => {
      const cqs = gs.communityQuestState || {};
      return !!(cqs['echo-of-claude'] && cqs['echo-of-claude'].done);
    }
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
