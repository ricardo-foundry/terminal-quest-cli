'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildReportMarkdown } = require('../src/commands');

test('buildReportMarkdown produces a valid Markdown file', () => {
  const state = {
    level: 7,
    exp: 1234,
    locale: 'zh-tw',
    theme: 'retro',
    alignment: 3,
    minAlignment: -1,
    achievements: ['first_step', 'night_owl'],
    questsState: { tutorial: { completed: true }, find_secret: { completed: false } },
    communityQuestState: { 'lib-of-shadows': { done: true, branch: 'good' } },
    visitedDirs: ['/home/user', '/system/core', '/world/lab'],
    npcAffinity: { shop: 80, guide: 60 },
    inventory: ['health-potion', 'torch'],
    startTime: Date.now() - 30 * 60 * 1000,
    playtimeMs: 30 * 60 * 1000
  };
  const game = {
    achievements: {
      first_step: { name: 'First Step', icon: '*', desc: 'Take your first step' },
      night_owl: { name: 'Night Owl', icon: '*', desc: 'Play at night' }
    }
  };
  const md = buildReportMarkdown('myslot', state, game, Date.now());
  assert.ok(md.startsWith('# Terminal Quest report'));
  assert.match(md, /\*\*Level:\*\* 7/);
  assert.match(md, /\*\*EXP:\*\* 1234/);
  // achievements section uses real names
  assert.match(md, /First Step/);
  assert.match(md, /Night Owl/);
  // built-in quest
  assert.match(md, /built-in: `tutorial`/);
  // community quest with branch
  assert.match(md, /community: `lib-of-shadows`/);
  assert.match(md, /branch: good/);
  // footprint
  assert.match(md, /\/world\/lab/);
  // favourite NPC = highest affinity
  assert.match(md, /\*\*shop\*\* — affinity 80/);
  // inventory
  assert.match(md, /health-potion/);
});

test('buildReportMarkdown gracefully handles empty state', () => {
  const md = buildReportMarkdown('empty', {}, {}, Date.now());
  // does not throw, contains the section headings
  assert.match(md, /## Achievements/);
  assert.match(md, /No achievements unlocked yet/);
  assert.match(md, /No directories visited/);
});
