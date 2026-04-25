#!/usr/bin/env node
/* eslint-disable no-console */
// =============================================================
// scripts/exhaust-quests.js — iter-16 deep bug-bash
// -------------------------------------------------------------
// For every community quest under quests/<id>/quest.json we
// build a synthetic gameState that satisfies *all* steps of
// that quest, then we test each branch by setting alignment.
//
// Pure API mode (no CLI, no readline): we exercise the quest
// evaluator directly through src/quests.js. That keeps the
// run deterministic and lets us assert state purity between
// quests (one quest's "done" must not bleed into another).
// =============================================================

'use strict';

const path = require('path');
const fs = require('fs');
const { loadQuests, evaluateQuest, pickBranch } = require('../src/quests');

const QUESTS_DIR = path.join(__dirname, '..', 'quests');
const EXPECTED = [
  'starter-lab', 'shadow-archive', 'ghost-train', 'library-cipher',
  'midnight-market', 'clockwork-vault', 'silicon-shrine',
  'wandering-merchant', 'cyber-bazaar', 'forgotten-archive', 'orbital-station'
];

// -----------------------------------------------------------------
// Build a gameState that satisfies every step of a quest.
// We walk the steps and OR together everything every trigger needs.
// -----------------------------------------------------------------
function freshState() {
  return {
    visitedDirs: [],
    visitedFiles: [],
    decodedFiles: [],
    keyFragments: [],
    achievements: [],
    inventory: [],
    gamesList: [],
    npcAffinity: {},
    level: 1,
    exp: 0,
    alignment: 0,
    turn: 0
  };
}

function applyTrigger(gs, tr) {
  switch (tr.type) {
    case 'visitDir':  gs.visitedDirs.push(tr.path); break;
    case 'visitFile': gs.visitedFiles.push(tr.path); break;
    case 'decodeFile': gs.decodedFiles.push(tr.file); break;
    case 'keyFragments':
      while (gs.keyFragments.length < (tr.min || 1)) gs.keyFragments.push(`frag-${gs.keyFragments.length}`);
      break;
    case 'level':
      gs.level = Math.max(gs.level, tr.min || 1);
      break;
    case 'alignment':
      if (typeof tr.min === 'number') gs.alignment = Math.max(gs.alignment, tr.min);
      if (typeof tr.max === 'number') gs.alignment = Math.min(gs.alignment, tr.max);
      break;
    case 'gamePlayed': gs.gamesList.push(tr.name); break;
    case 'achievementUnlocked': gs.achievements.push(tr.id); break;
    case 'season': {
      // turn 0 = spring, 30 = summer, 60 = autumn, 90 = winter
      const want = Array.isArray(tr.season) ? tr.season[0] : tr.season;
      const map = { spring: 0, summer: 30, autumn: 60, winter: 90 };
      const target = map[want];
      if (target !== undefined) gs.turn = Math.max(gs.turn, target);
      break;
    }
    case 'affinity':
      if (typeof tr.min === 'number') {
        gs.npcAffinity[tr.npc] = Math.max(gs.npcAffinity[tr.npc] || 0, tr.min);
      }
      break;
    case 'hasItem':
      if (!gs.inventory.includes(tr.item)) gs.inventory.push(tr.item);
      break;
    case 'custom': {
      // best effort: try to match `turn >= N` and `level >= N`
      const m = String(tr.predicate || '').match(/(\w+)\s*>=\s*(\d+)/);
      if (m) {
        const k = m[1];
        const n = parseInt(m[2], 10);
        if (k === 'turn') gs.turn = Math.max(gs.turn, n);
        if (k === 'level') gs.level = Math.max(gs.level, n);
        if (k === 'exp') gs.exp = Math.max(gs.exp, n);
      }
      break;
    }
    default: /* unknown — caller will catch */ break;
  }
}

function buildState(quest) {
  const gs = freshState();
  for (const step of quest.steps) {
    for (const tr of step.triggers) applyTrigger(gs, tr);
  }
  return gs;
}

function exhaustQuest(quest) {
  const errors = [];
  const baseState = buildState(quest);

  // 1) friendly path
  const friendly = JSON.parse(JSON.stringify(baseState));
  friendly.alignment = 8;
  const f = evaluateQuest(quest, friendly);
  if (!f.done) errors.push(`[${quest.id}] friendly: completed=${f.completed}/${f.total} active=${f.activeStep && f.activeStep.id}`);

  // 2) neutral path
  const neutral = JSON.parse(JSON.stringify(baseState));
  neutral.alignment = 0;
  const n = evaluateQuest(quest, neutral);
  if (!n.done) errors.push(`[${quest.id}] neutral: completed=${n.completed}/${n.total} active=${n.activeStep && n.activeStep.id}`);

  // 3) hostile path — only valid if no `alignment` step constrains us upward
  const minAlignReq = quest.steps
    .flatMap((s) => s.triggers)
    .filter((t) => t.type === 'alignment' && typeof t.min === 'number')
    .map((t) => t.min);
  const requiredFloor = minAlignReq.length ? Math.max(...minAlignReq) : -10;
  const hostile = JSON.parse(JSON.stringify(baseState));
  hostile.alignment = Math.max(-8, requiredFloor);
  const h = evaluateQuest(quest, hostile);
  if (!h.done) errors.push(`[${quest.id}] hostile: completed=${h.completed}/${h.total} active=${h.activeStep && h.activeStep.id}`);

  // verify branch picking is stable for every alignment we tested
  for (const [label, gs] of [['friendly', friendly], ['neutral', neutral], ['hostile', hostile]]) {
    if (quest.branches) {
      const b = pickBranch(quest.branches, gs);
      if (!b) errors.push(`[${quest.id}] ${label}: no branch picked (have ${Object.keys(quest.branches).join(',')})`);
    }
  }

  // verify state purity: an empty gs must produce done=false
  const empty = freshState();
  const e = evaluateQuest(quest, empty);
  if (e.done) errors.push(`[${quest.id}] empty state should not complete a quest`);

  return errors;
}

function main() {
  const { quests, report } = loadQuests(QUESTS_DIR);
  const ids = quests.map((q) => q.id).sort();
  const expected = [...EXPECTED].sort();
  const missing = expected.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !expected.includes(id));

  let allErrors = [];
  if (missing.length) allErrors.push(`missing quests: ${missing.join(', ')}`);
  if (extra.length) console.log(`(extra quests: ${extra.join(', ')})`);

  for (const q of quests) {
    const errors = exhaustQuest(q);
    if (errors.length === 0) {
      console.log(`OK   ${q.id}  (${q.steps.length} steps, ${q.branches ? Object.keys(q.branches).length : 0} branches)`);
    } else {
      console.log(`FAIL ${q.id}`);
      for (const e of errors) console.log('     ' + e);
      allErrors = allErrors.concat(errors);
    }
  }

  // surface validation report
  for (const r of report) {
    if (!r.ok) {
      console.log(`LOAD FAIL ${r.file}: ${r.errors.join('; ')}`);
      allErrors = allErrors.concat(r.errors.map((e) => `load: ${r.file}: ${e}`));
    }
  }

  if (allErrors.length) {
    console.log(`\n${allErrors.length} error(s) found.`);
    process.exit(1);
  }
  console.log(`\n${quests.length}/${EXPECTED.length} quest(s) passed friendly+neutral+hostile.`);
}

if (require.main === module) main();

module.exports = { buildState, exhaustQuest };
