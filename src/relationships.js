/**
 * @module relationships
 * @description NPC affinity (good-will) system, decoupled from the global
 *   `alignment` axis.
 *
 * Each NPC has its own affinity counter from -100 to +100. Values are
 * persisted on `gameState.npcAffinity` (id -> integer). Public surface:
 *
 *   getAffinity(gs, npcId)              -> number (defaults to 0)
 *   adjustAffinity(gs, npcId, delta)    -> number (clamped, returns new)
 *   moodFor(gs, npcId)                  -> 'adoring' | 'friendly' | 'neutral' | 'cold' | 'hostile'
 *   giftEffect(item)                    -> { delta, ack } describing how a
 *                                          specific item changes affinity
 *   giveGift(gs, npcId, item)           -> { ok, delta, ack, affinity }
 *                                          (does NOT remove the item from
 *                                          inventory — caller does that)
 *   specialDialog(gs, npcId)            -> string|null   (high-affinity unlock)
 *   specialItem(gs, npcId)              -> string|null   (high-affinity gift)
 *
 * The module is intentionally pure (no I/O, no chalk). The CLI wraps it
 * in `gift <item> to <npc>` and the existing `talk` command surfaces the
 * mood + special line.
 */

'use strict';

const AFFINITY_MIN = -100;
const AFFINITY_MAX = 100;

// Per-item gift table. Items not listed get a +1 default ("any token of
// goodwill") so unknown community items still work without a special case.
const GIFT_TABLE = {
  'health-potion':   { delta:  4, ack: 'practical, but appreciated.' },
  'mana-potion':     { delta:  4, ack: 'a thoughtful pick.' },
  'lab-badge':       { delta: 10, ack: 'this means a lot — thank you.' },
  'rare-stamp':      { delta: 12, ack: 'a collector\'s gift! you remembered.' },
  'morse-card':      { delta:  6, ack: 'a useful reference card.' },
  'merchant-token':  { delta:  8, ack: 'currency speaks louder than poetry.' },
  'lantern-oil':     { delta:  5, ack: 'warm light for cold nights.' },
  'torch':           { delta:  3, ack: 'thoughtful for the dark stretches.' },
  'detector':        { delta:  3, ack: 'gear is gear — thank you.' },
  'key-shard-1':     { delta: -8, ack: 'this is a fragment of something dangerous. take it back.' },
  'key-shard-2':     { delta: -8, ack: 'I will not carry that. please.' },
  'key-shard-3':     { delta: -8, ack: 'I would rather not be near a master key.' }
};

// Talk ticks. Repeated talking yields tiny diminishing returns so a player
// can't grind to +100 by mashing talk; +1 first time, capped quickly.
const TALK_TICK = 1;
const TALK_DAILY_CAP = 4;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function _state(gs) {
  if (!gs || typeof gs !== 'object') return null;
  if (!gs.npcAffinity || typeof gs.npcAffinity !== 'object') gs.npcAffinity = {};
  if (!gs.npcTalkCount || typeof gs.npcTalkCount !== 'object') gs.npcTalkCount = {};
  return gs;
}

function getAffinity(gs, npcId) {
  const s = _state(gs);
  if (!s || !npcId) return 0;
  return Number(s.npcAffinity[npcId]) || 0;
}

function adjustAffinity(gs, npcId, delta) {
  const s = _state(gs);
  if (!s || !npcId) return 0;
  const cur = Number(s.npcAffinity[npcId]) || 0;
  const next = clamp(cur + (Number(delta) || 0), AFFINITY_MIN, AFFINITY_MAX);
  s.npcAffinity[npcId] = next;
  return next;
}

function moodFor(gs, npcId) {
  const a = getAffinity(gs, npcId);
  if (a >= 60) return 'adoring';
  if (a >= 20) return 'friendly';
  if (a <= -60) return 'hostile';
  if (a <= -20) return 'cold';
  return 'neutral';
}

function giftEffect(item) {
  if (!item || typeof item !== 'string') return { delta: 0, ack: 'nothing happens.' };
  if (GIFT_TABLE[item]) return { ...GIFT_TABLE[item] };
  return { delta: 1, ack: 'a small kindness, noted.' };
}

// Talk side-effect: one tick per call, capped per-NPC by TALK_DAILY_CAP.
// (Caller usually invokes this from the `talk` command.)
function recordTalk(gs, npcId) {
  const s = _state(gs);
  if (!s || !npcId) return 0;
  const count = Number(s.npcTalkCount[npcId]) || 0;
  if (count >= TALK_DAILY_CAP) return getAffinity(gs, npcId);
  s.npcTalkCount[npcId] = count + 1;
  return adjustAffinity(gs, npcId, TALK_TICK);
}

function giveGift(gs, npcId, item) {
  if (!gs || !npcId || !item) {
    return { ok: false, delta: 0, ack: '', affinity: getAffinity(gs, npcId) };
  }
  const eff = giftEffect(item);
  const after = adjustAffinity(gs, npcId, eff.delta);
  if (!gs.giftLog) gs.giftLog = [];
  gs.giftLog.push({ npc: npcId, item, delta: eff.delta, at: gs.turn || 0 });
  // cap log to avoid bloating saves
  if (gs.giftLog.length > 50) gs.giftLog = gs.giftLog.slice(-50);
  return { ok: true, delta: eff.delta, ack: eff.ack, affinity: after };
}

// Special dialog lines unlocked at adoring (>=60). Falls back to null.
const SPECIAL_DIALOGS = {
  guide:      'I trust you with the next part. Look for the clockwork vault below the nexus.',
  shop:       'For you — half off, every time. Don\'t tell the others.',
  researcher: 'Take the spare lab-badge, friend. You\'ve earned the lab\'s trust.',
  archivist:  'There is a page kept for our friends. Here — copy it, but tell no one.',
  librarian:  'Quiet corner upstairs is yours whenever you need it.',
  conductor:  'Coach C, seat 42. Permanent reservation, on the house.',
  keeper:     'The candle burns brighter when you pass. That is something.'
};

function specialDialog(gs, npcId) {
  if (moodFor(gs, npcId) !== 'adoring') return null;
  return SPECIAL_DIALOGS[npcId] || null;
}

// Special items handed out at adoring; only granted once per NPC.
const SPECIAL_ITEMS = {
  guide:      'guide-pendant',
  shop:       'merchant-token',
  researcher: 'lab-badge',
  archivist:  'rare-stamp',
  librarian:  'silver-bookmark',
  conductor:  'first-class-pass',
  keeper:     'warm-ember'
};

function specialItem(gs, npcId) {
  if (moodFor(gs, npcId) !== 'adoring') return null;
  const s = _state(gs);
  if (!s) return null;
  if (!s.specialItemsGranted || typeof s.specialItemsGranted !== 'object') {
    s.specialItemsGranted = {};
  }
  if (s.specialItemsGranted[npcId]) return null;
  const it = SPECIAL_ITEMS[npcId];
  if (!it) return null;
  s.specialItemsGranted[npcId] = true;
  return it;
}

module.exports = {
  AFFINITY_MIN, AFFINITY_MAX, GIFT_TABLE, TALK_TICK, TALK_DAILY_CAP,
  SPECIAL_DIALOGS, SPECIAL_ITEMS,
  getAffinity, adjustAffinity, moodFor, giftEffect,
  recordTalk, giveGift, specialDialog, specialItem
};
