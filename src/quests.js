/**
 * @module quests
 * @description Pluggable, community-contributable quest loader.
 *
 * A quest is a self-contained JSON file that lives in `quests/<id>/quest.json`.
 * Shape:
 *   {
 *     "schemaVersion": 1,
 *     "id": "starter-lab",           // must match folder name
 *     "title": "Starter Lab",
 *     "description": "...",
 *     "author": "Terminal Quest team",
 *     "tags": ["intro", "tutorial"],
 *     "steps": [                      // ordered; players complete top-to-bottom
 *       {
 *         "id": "enter_lab",
 *         "description": "Walk into /world/lab",
 *         "triggers": [ { "type": "visitDir", "path": "/world/lab" } ]
 *       },
 *       ...
 *     ],
 *     "rewards": { "exp": 150, "items": ["lab-badge"] },
 *     "branches": {                   // optional alternative endings
 *       "good":   { "condition": "alignment>=3",  "text": "..." },
 *       "bad":    { "condition": "alignment<=-3", "text": "..." },
 *       "neutral":{ "default": true,              "text": "..." }
 *     }
 *   }
 *
 * Trigger types currently supported (evaluator stays tiny on purpose):
 *   visitDir          path
 *   visitFile         path
 *   decodeFile        file
 *   keyFragments      min
 *   level             min
 *   alignment         min / max
 *   gamePlayed        name
 *   achievementUnlocked id
 *   custom            predicate (string) - evaluated against gameState safely
 *
 * IMPORTANT: the loader is fully tolerant. A malformed quest is *skipped*
 * with a warning, never a throw. This keeps a broken community quest from
 * bricking a player's save.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const QUEST_SCHEMA_VERSION = 1;
const DEFAULT_QUESTS_DIR = path.join(__dirname, '..', 'quests');

// Allowed trigger types - anything else is reported but ignored.
const TRIGGER_TYPES = new Set([
  'visitDir', 'visitFile', 'decodeFile', 'keyFragments',
  'level', 'alignment', 'gamePlayed', 'achievementUnlocked', 'custom'
]);

/**
 * Validate a parsed quest object against the v1 schema.
 *
 * @param {any} quest
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateQuest(quest) {
  const errors = [];
  if (!quest || typeof quest !== 'object') {
    return { ok: false, errors: ['quest payload is not an object'] };
  }
  if (typeof quest.schemaVersion !== 'number') {
    errors.push('schemaVersion must be a number');
  } else if (quest.schemaVersion !== QUEST_SCHEMA_VERSION) {
    errors.push(`schemaVersion ${quest.schemaVersion} unsupported (expected ${QUEST_SCHEMA_VERSION})`);
  }
  if (!quest.id || typeof quest.id !== 'string') errors.push('id must be a non-empty string');
  else if (!/^[a-z0-9][a-z0-9_\-]*$/i.test(quest.id)) errors.push('id contains invalid characters');
  if (!quest.title || typeof quest.title !== 'string') errors.push('title must be a non-empty string');
  if (!Array.isArray(quest.steps) || quest.steps.length === 0) {
    errors.push('steps must be a non-empty array');
  } else {
    const seenIds = new Set();
    quest.steps.forEach((step, i) => {
      if (!step || typeof step !== 'object') {
        errors.push(`step #${i}: not an object`);
        return;
      }
      if (!step.id || typeof step.id !== 'string') {
        errors.push(`step #${i}: id missing`);
      } else if (seenIds.has(step.id)) {
        errors.push(`step #${i}: duplicate id "${step.id}"`);
      } else {
        seenIds.add(step.id);
      }
      if (!step.description || typeof step.description !== 'string') {
        errors.push(`step ${step.id || '#' + i}: description missing`);
      }
      if (!Array.isArray(step.triggers) || step.triggers.length === 0) {
        errors.push(`step ${step.id || '#' + i}: needs at least one trigger`);
      } else {
        step.triggers.forEach((tr, j) => {
          if (!tr || typeof tr !== 'object' || !tr.type) {
            errors.push(`step ${step.id} trigger #${j}: malformed`);
          } else if (!TRIGGER_TYPES.has(tr.type)) {
            errors.push(`step ${step.id} trigger #${j}: unknown type "${tr.type}"`);
          }
        });
      }
    });
  }
  if (quest.rewards && typeof quest.rewards !== 'object') {
    errors.push('rewards must be an object');
  }
  if (quest.branches && typeof quest.branches !== 'object') {
    errors.push('branches must be an object');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Load a single quest file. Returns { quest, errors } - either quest is
 * a validated object or errors is non-empty.
 *
 * @param {string} filePath absolute path to quest.json
 * @returns {{ quest: object|null, errors: string[] }}
 */
function loadQuestFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return { quest: null, errors: [`cannot read ${filePath}: ${e.message}`] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { quest: null, errors: [`invalid json (${e.message})`] };
  }
  const res = validateQuest(parsed);
  if (!res.ok) return { quest: null, errors: res.errors };
  // defensive copy + metadata tag
  const cleaned = JSON.parse(JSON.stringify(parsed));
  cleaned._source = filePath;
  return { quest: cleaned, errors: [] };
}

/**
 * Scan a directory for `<id>/quest.json` files and load each. Invalid
 * quests are skipped (errors returned in the report) so one broken quest
 * cannot brick the game.
 *
 * @param {string} [dir] directory to scan (default: ./quests)
 * @returns {{ quests: object[], report: Array<{id?:string, file:string, ok:boolean, errors:string[]}> }}
 */
function loadQuests(dir) {
  const root = dir || DEFAULT_QUESTS_DIR;
  const quests = [];
  const report = [];
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (e) {
    return { quests, report: [{ file: root, ok: false, errors: [`quests dir not readable: ${e.message}`] }] };
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const filePath = path.join(root, ent.name, 'quest.json');
    if (!fs.existsSync(filePath)) continue;
    const { quest, errors } = loadQuestFile(filePath);
    if (quest) {
      // the folder name must match the quest id to keep discovery predictable
      if (quest.id !== ent.name) {
        report.push({ id: quest.id, file: filePath, ok: false, errors: [`folder "${ent.name}" does not match quest id "${quest.id}"`] });
        continue;
      }
      quests.push(quest);
      report.push({ id: quest.id, file: filePath, ok: true, errors: [] });
    } else {
      report.push({ file: filePath, ok: false, errors });
    }
  }
  return { quests, report };
}

/**
 * Evaluate a single trigger against game state. Pure.
 *
 * @param {object} trigger
 * @param {object} gs game state
 * @returns {boolean}
 */
function matchTrigger(trigger, gs) {
  if (!trigger || typeof trigger !== 'object') return false;
  try {
    switch (trigger.type) {
      case 'visitDir':
        return (gs.visitedDirs || []).includes(trigger.path);
      case 'visitFile':
        return (gs.visitedFiles || []).includes(trigger.path);
      case 'decodeFile':
        return (gs.decodedFiles || []).some((f) => f === trigger.file || f.endsWith('/' + trigger.file));
      case 'keyFragments':
        return (gs.keyFragments || []).length >= (trigger.min || 1);
      case 'level':
        return (gs.level || 1) >= (trigger.min || 1);
      case 'alignment':
        if (typeof trigger.min === 'number' && (gs.alignment || 0) < trigger.min) return false;
        if (typeof trigger.max === 'number' && (gs.alignment || 0) > trigger.max) return false;
        return true;
      case 'gamePlayed':
        return (gs.gamesList || []).includes(trigger.name);
      case 'achievementUnlocked':
        return (gs.achievements || []).includes(trigger.id);
      case 'custom':
        return evalCustomPredicate(trigger.predicate, gs);
      default:
        return false;
    }
  } catch (_) {
    return false;
  }
}

/**
 * Extremely constrained predicate evaluator. Supports the tokens
 *   level, exp, alignment, gamesPlayed, keyFragments
 * combined with numeric comparisons. Anything outside the allowlist
 * returns false — we never eval arbitrary JS.
 *
 * @param {string} src
 * @param {object} gs
 * @returns {boolean}
 */
function evalCustomPredicate(src, gs) {
  if (typeof src !== 'string' || src.length > 200) return false;
  // only digits, whitespace, comparison ops, parens and allow-listed names
  if (!/^[\sA-Za-z0-9_<>=!&|()+\-]+$/.test(src)) return false;
  const whitelist = ['level', 'exp', 'alignment', 'gamesPlayed', 'keyFragments', 'turn'];
  const names = src.match(/[A-Za-z_]+/g) || [];
  for (const n of names) {
    if (!whitelist.includes(n)) return false;
  }
  const env = {
    level: gs.level || 1,
    exp: gs.exp || 0,
    alignment: gs.alignment || 0,
    gamesPlayed: gs.gamesPlayed || 0,
    keyFragments: (gs.keyFragments || []).length,
    turn: gs.turn || 0
  };
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(env), `return (${src});`);
    return !!fn(...Object.values(env));
  } catch (_) {
    return false;
  }
}

/**
 * Is a step complete given current state?
 *
 * @param {object} step
 * @param {object} gs
 * @returns {boolean}
 */
function isStepComplete(step, gs) {
  if (!step || !Array.isArray(step.triggers)) return false;
  return step.triggers.every((tr) => matchTrigger(tr, gs));
}

/**
 * Walk a quest's steps in order and return progress details.
 *
 * @param {object} quest
 * @param {object} gs
 * @returns {{ completed: number, total: number, done: boolean, activeStep: object|null, currentBranch?: string }}
 */
function evaluateQuest(quest, gs) {
  const total = quest.steps.length;
  let completed = 0;
  let activeStep = null;
  for (const step of quest.steps) {
    if (isStepComplete(step, gs)) {
      completed++;
    } else if (!activeStep) {
      activeStep = step;
    }
  }
  const done = completed === total;
  let branch;
  if (done && quest.branches) {
    branch = pickBranch(quest.branches, gs);
  }
  return { completed, total, done, activeStep, currentBranch: branch };
}

/**
 * Pick the first branch whose condition (a custom predicate) passes,
 * or the `default: true` branch. Stable ordering by Object.keys().
 */
function pickBranch(branches, gs) {
  for (const [name, b] of Object.entries(branches)) {
    if (!b || typeof b !== 'object') continue;
    if (b.default) continue;
    if (b.condition && evalCustomPredicate(b.condition, gs)) return name;
  }
  for (const [name, b] of Object.entries(branches)) {
    if (b && b.default) return name;
  }
  return null;
}

/**
 * Hot-reload helper - reads a directory again and returns whatever is
 * current. Caller is responsible for deciding what to do with the diff.
 */
function reloadQuests(dir) {
  return loadQuests(dir);
}

module.exports = {
  QUEST_SCHEMA_VERSION,
  DEFAULT_QUESTS_DIR,
  TRIGGER_TYPES,
  validateQuest,
  loadQuestFile,
  loadQuests,
  reloadQuests,
  matchTrigger,
  isStepComplete,
  evaluateQuest,
  evalCustomPredicate,
  pickBranch
};
