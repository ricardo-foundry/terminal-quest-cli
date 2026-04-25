/**
 * @module game
 * @description Top-level orchestrator: state, save/load, prompt loop.
 *
 * `TerminalGame`:
 *   - merges DEFAULT_STATE with the loaded save into `gameState`
 *   - re-attaches achievement `check` fns lost across JSON round-trip
 *   - drives the readline loop, dispatches each line via CommandSystem
 *   - persists state on every unlock and on graceful exit (SIGINT/SIGTERM)
 *
 * `DEFAULT_STATE` is the canonical schema for v2 saves; new fields added
 * here are automatically picked up by old saves at load time via the
 * spread merge in `loadGameState()`.
 */

const readline = require('readline');
const pathPosix = require('path').posix;
const { colors, bootSequence, showAchievement, showLevelUp, applyTheme } = require('./ui');
const { FILE_SYSTEM, ACHIEVEMENTS, QUESTS, LEVELS } = require('./data');
const { EXTRA_ACHIEVEMENTS, evaluateAutoUnlocks } = require('./achievements');
const { CommandSystem } = require('./commands');
const saveMod = require('./save');
const timeMod = require('./time');
const seasonMod = require('./season');
const questsMod = require('./quests');
const { ReplayRecorder } = require('./replay');
const { t, setLocale, detectLocale } = require('./i18n');

const DEFAULT_STATE = {
  currentPath: '/home/user',
  visitedFiles: [],
  visitedDirs: ['/home/user'],
  achievements: [],
  decodedFiles: [],
  keyFragments: [],
  scanMode: false,
  explorationLevel: 1,
  gamesPlayed: 0,
  gamesList: [],
  foundMasterKey: false,
  masterUnlocked: false,
  helpCount: 0,
  firstLaunch: true,
  startTime: Date.now(),
  level: 1,
  exp: 0,
  inventory: [],
  voidVisited: false,
  easterEggCount: 0,
  questsState: {},
  achievementsState: {},
  theme: 'dark',
  locale: undefined, // auto-detect when missing
  // v2.1 additions
  turn: 0,
  phasesSeen: [],
  nightVisited: false,
  dawnVisited: false,
  alignment: 0,
  npcMoodsSeen: [],
  sessionCommands: 0,
  shareCount: 0,
  qteWon: false,
  logicSolved: false,
  morseSolved: false,
  aliases: { ll: 'ls -la', '.': 'look', l: 'ls', h: 'help', c: 'clear' },
  commandHistory: [],
  // v2.4 additions
  replay: [],
  minAlignment: 0,
  // v2.5: persisted alongside minAlignment so a fresh process never
  // re-seeds the running minimum back to "current alignment" on load.
  minAlignmentInit: false,
  questPackTotal: 0,
  questPackDone: 0,
  communityQuestState: {},
  // v2.6 (iter-12) additions
  npcAffinity: {},
  npcTalkCount: {},
  giftLog: [],
  specialItemsGranted: {},
  bookmarks: {},
  seasonsSeen: [],
  // v2.7 (iter-14) additions
  // localesUsed: every locale the player has been active in (auto-detect
  //   counts; explicit `lang` switches count). Drives the Polyglot achievement.
  localesUsed: [],
  // nightSurvivedStreak: how many consecutive night phases were exited
  //   without alignment dipping. See evaluateNightStreak() below.
  nightSurvivedStreak: 0,
  lastNightTurn: -1,
  // historyOpened: gate for the Silent Runner achievement. Flips true on
  //   the first `history` invocation and never resets.
  historyOpened: false,
  playtimeMs: 0
};

class TerminalGame {
  constructor(options = {}) {
    this.options = options;
    this.slot = options.slot || saveMod.DEFAULT_SLOT;
    // v2.5 (iter-10): load state FIRST so the CommandSystem can seed its
    // in-memory history from gameState.commandHistory at construction.
    this.gameState = this.loadGameState();
    this.commandSystem = new CommandSystem(this);
    this.currentPath = this.gameState.currentPath || '/home/user';
    this.achievements = JSON.parse(JSON.stringify({ ...ACHIEVEMENTS, ...EXTRA_ACHIEVEMENTS }));
    // re-attach check functions (they do not survive JSON round-trip)
    for (const [id, src] of Object.entries(EXTRA_ACHIEVEMENTS)) {
      if (this.achievements[id] && typeof src.check === 'function') {
        this.achievements[id].check = src.check;
      }
    }
    this.quests = JSON.parse(JSON.stringify(QUESTS));
    this.rl = null;
    this.exiting = false;
    this.syncAchievements();
    this.syncQuests();

    // v2.4 additions: community quests + replay recorder
    const loaded = questsMod.loadQuests();
    this.communityQuests = loaded.quests;
    this.questReport = loaded.report;
    this.gameState.questPackTotal = this.communityQuests.length;
    if (!this.gameState.communityQuestState || typeof this.gameState.communityQuestState !== 'object') {
      this.gameState.communityQuestState = {};
    }
    this.replay = new ReplayRecorder(this.gameState);

    // v2.5 dev mode: hot-reload community quests when files change.
    if (this.options.dev) {
      this._startQuestWatcher();
    }

    // apply persisted preferences
    if (this.gameState.locale) setLocale(this.gameState.locale);
    applyTheme(this.gameState.theme || 'dark');

    // v2.7: track locales used (for the Polyglot achievement). The active
    // locale at boot — whether persisted, env-detected, or default — counts.
    if (!Array.isArray(this.gameState.localesUsed)) this.gameState.localesUsed = [];
    const { getLocale } = require('./i18n');
    const cur = getLocale();
    if (cur && !this.gameState.localesUsed.includes(cur)) {
      this.gameState.localesUsed.push(cur);
    }
  }

  /**
   * Re-scan the quests directory and replace the in-memory pack.
   * Returns the new count and any per-file errors. Used by `--dev`
   * hot-reload and by future in-game `:reload-quests` commands.
   *
   * @returns {{ count:number, failed:number }}
   */
  reloadCommunityQuests() {
    try {
      const loaded = questsMod.reloadQuests();
      this.communityQuests = loaded.quests;
      this.questReport = loaded.report;
      this.gameState.questPackTotal = this.communityQuests.length;
      const failed = loaded.report.filter((r) => !r.ok).length;
      return { count: this.communityQuests.length, failed };
    } catch (_) {
      return { count: 0, failed: 0 };
    }
  }

  /**
   * Watch the quests/ directory in --dev mode and reload on change.
   * fs.watch is best-effort across platforms; failures are logged but
   * never crash the game.
   */
  _startQuestWatcher() {
    const fs = require('fs');
    const dir = questsMod.DEFAULT_QUESTS_DIR;
    if (!fs.existsSync(dir)) return;
    try {
      // Coalesce bursts of fs events (editors save with multiple writes).
      let pending = null;
      this._questWatcher = fs.watch(dir, { recursive: true }, () => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          pending = null;
          const r = this.reloadCommunityQuests();
          // Use a quiet log so we don't blow up the prompt; errors only.
          if (colors && colors.dim) {
            console.log();
            console.log(colors.dim(`[dev] reloaded ${r.count} quest(s)` + (r.failed ? `, ${r.failed} failed` : '')));
            if (this.rl) this.rl.prompt();
          }
        }, 150);
      });
      if (this._questWatcher && typeof this._questWatcher.on === 'function') {
        this._questWatcher.on('error', () => { /* ignore */ });
      }
    } catch (_) {
      /* recursive watch unsupported on this platform - silently skip */
    }
  }

  /**
   * Evaluate community quest progress; called from checkQuests().
   */
  evaluateCommunityQuests() {
    if (!Array.isArray(this.communityQuests)) return;
    let done = 0;
    for (const q of this.communityQuests) {
      const res = questsMod.evaluateQuest(q, this.gameState);
      const prev = this.gameState.communityQuestState[q.id] || { done: false };
      if (res.done && !prev.done) {
        this.gameState.communityQuestState[q.id] = { done: true, branch: res.currentBranch || null };
        if (q.rewards && typeof q.rewards.exp === 'number') {
          this.addExp(q.rewards.exp, `community quest: ${q.id}`).catch(() => {});
        }
        if (q.rewards && Array.isArray(q.rewards.items)) {
          for (const item of q.rewards.items) {
            if (!this.gameState.inventory.includes(item)) {
              this.gameState.inventory.push(item);
            }
          }
        }
      }
      if ((this.gameState.communityQuestState[q.id] || {}).done) done++;
    }
    this.gameState.questPackDone = done;
  }

  // -------- Save / Load --------
  loadGameState() {
    try {
      const payload = saveMod.load(this.slot);
      if (payload && payload.state) {
        return { ...DEFAULT_STATE, ...payload.state };
      }
    } catch (e) {
      // fall through with defaults
      console.log(colors.dim && colors.dim(`save load failed: ${e.message}`));
    }
    return { ...DEFAULT_STATE, startTime: Date.now() };
  }

  saveGameState() {
    try {
      const questsState = {};
      for (const [id, quest] of Object.entries(this.quests)) {
        questsState[id] = { completed: !!quest.completed, active: !!quest.active };
      }
      const achievementsState = {};
      for (const [id, ach] of Object.entries(this.achievements)) {
        achievementsState[id] = { unlocked: !!ach.unlocked };
      }
      const state = {
        ...this.gameState,
        currentPath: this.currentPath,
        questsState,
        achievementsState
      };
      const res = saveMod.save(this.slot, state);
      // Surface the 1-MiB warning once per save cycle so hoarders know.
      if (res && res.warn && !this._saveWarnShown) {
        this._saveWarnShown = true;
        console.log(colors.warning && colors.warning(`[save] ${res.warn}`));
        console.log(colors.dim && colors.dim('  tip: use `terminal-quest --export-save ' + this.slot + ' > backup.json`'));
      }
    } catch (e) {
      // silent in interactive mode; caller can surface if needed
    }
  }

  syncAchievements() {
    for (const id of this.gameState.achievements || []) {
      if (this.achievements[id]) this.achievements[id].unlocked = true;
    }
    if (this.gameState.achievementsState) {
      for (const [id, state] of Object.entries(this.gameState.achievementsState)) {
        if (this.achievements[id] && state.unlocked) this.achievements[id].unlocked = true;
      }
    }
  }

  syncQuests() {
    if (this.gameState.questsState) {
      for (const [id, state] of Object.entries(this.gameState.questsState)) {
        if (this.quests[id]) {
          this.quests[id].completed = !!state.completed;
          this.quests[id].active = !!state.active;
        }
      }
    }
    let foundActive = false;
    for (const quest of Object.values(this.quests)) {
      if (quest.completed) {
        quest.active = false;
      } else if (!foundActive) {
        quest.active = true;
        foundActive = true;
      }
    }
  }

  // -------- Interactive lifecycle --------
  async init() {
    await bootSequence({ skip: this.options.skipBoot });
    this.updatePrompt();
    this.showWelcome();

    if (this.gameState.firstLaunch !== false) {
      this.gameState.firstLaunch = false;
      this.gameState.startTime = Date.now();
      this.saveGameState();
    }

    // v2.5 (iter-9): seed phasesSeen with the current phase so `time`
    // reports something on turn 0 instead of "(none)" until the first
    // phase boundary is crossed.
    if (!Array.isArray(this.gameState.phasesSeen)) this.gameState.phasesSeen = [];
    const startPhase = this.getPhase().name;
    if (!this.gameState.phasesSeen.includes(startPhase)) {
      this.gameState.phasesSeen.push(startPhase);
      if (startPhase === 'night') this.gameState.nightVisited = true;
      if (startPhase === 'dawn') this.gameState.dawnVisited = true;
    }

    // Small delayed unlock so intro isn't racy
    setTimeout(() => this.unlockAchievement('first_step').catch(() => {}), 500);

    this.startInputLoop();
  }

  updatePrompt() {
    const p = this.currentPath;
    const displayPath = p.replace('/home/user', '~').replace('/home', '~');
    const levelIndicator = colors.gold(`[Lv.${this.gameState.level}]`);
    const phase = this.getPhase();
    const clock = timeMod.formatClock(this.gameState.turn || 0);
    const timeIndicator = colors.dim(`[${phase.icon} ${clock}]`);
    const season = seasonMod.getSeason(this.gameState.turn || 0);
    const seasonIndicator = colors.dim(`[${season.icon}]`);
    this.prompt = `${seasonIndicator}${timeIndicator} ${levelIndicator} ${colors.primary('explorer@kimi-os')}:${colors.secondary(displayPath)}$`;
  }

  getSeason() {
    return seasonMod.getSeason(this.gameState.turn || 0);
  }

  showWelcome() {
    console.log();
    console.log(colors.success(t('boot.ready')));
    console.log();
    const messages = [t('welcome.loaded')];
    if (this.gameState.firstLaunch === false) {
      messages.push(colors.info(t('welcome.level', { level: this.gameState.level })));
      messages.push(colors.info(t('welcome.achievements', { n: (this.gameState.achievements || []).length })));
      messages.push(colors.dim(t('welcome.status')));
    } else {
      messages.push(colors.info(t('welcome.new')));
      messages.push(colors.info(t('welcome.tutorial')));
    }
    messages.forEach((m) => console.log(colors.dim('  > ') + m));
    console.log();
  }

  // -------- File system helpers --------
  /**
   * Normalise a game-internal path. Uses `path.posix` so Windows's
   * backslash separator never leaks into the virtual filesystem —
   * the virtual FS is always forward-slash regardless of host OS.
   *
   * @param {string} p raw user-supplied path
   * @returns {string} absolute posix path
   */
  normalizePath(p) {
    if (!p) return this.currentPath;
    if (p === '~') return '/home/user';
    if (p.startsWith('~/')) p = '/home/user/' + p.slice(2);
    // Defensive: if a Windows path ever slips in (user paste), coerce.
    p = p.replace(/\\/g, '/');
    const base = p.startsWith('/') ? p : pathPosix.join(this.currentPath || '/', p);
    // posix.resolve collapses . and .. for us safely.
    const resolved = pathPosix.resolve('/', base);
    return resolved;
  }

  resolvePath(p) {
    if (p === '.' || !p) return this.getCurrentDir();
    const norm = this.normalizePath(p);
    return this.getDirByPath(norm);
  }

  getCurrentDir() {
    return this.getDirByPath(this.currentPath);
  }

  getDirByPath(p) {
    const parts = p.split('/').filter(Boolean);
    let current = FILE_SYSTEM.root;
    for (const part of parts) {
      if (current.children && current.children[part]) {
        current = current.children[part];
      } else {
        return null;
      }
    }
    return current;
  }

  getFullPath(relativePath) {
    return this.normalizePath(relativePath);
  }

  getSecurityLevel() {
    const levels = ['public', 'restricted', 'confidential', 'secret', 'top-secret'];
    return levels[this.gameState.explorationLevel - 1] || 'unknown';
  }

  // -------- RPG --------
  async addExp(amount, reason = '') {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.gameState.exp += amount;
    const next = LEVELS[this.gameState.level + 1];
    if (next && this.gameState.exp >= next.expRequired) {
      await this.levelUp();
    }
    if (reason) {
      console.log(colors.gold(`  +${amount} EXP (${reason})`));
    }
  }

  async levelUp() {
    this.gameState.level++;
    const info = LEVELS[this.gameState.level];
    if (!info) return;
    await showLevelUp(this.gameState.level, info.title);
    if (this.gameState.level === 3) {
      console.log(colors.success('Unlocked area: /world/nexus/'));
    }
    if (this.gameState.level === 5) {
      console.log(colors.warning('Unlocked area: /shadow/realm/'));
    }
  }

  async unlockAchievement(id) {
    const ach = this.achievements[id];
    if (!ach || ach.unlocked) return;
    ach.unlocked = true;
    if (!this.gameState.achievements.includes(id)) {
      this.gameState.achievements.push(id);
    }
    await showAchievement(ach);
    if (ach.reward) {
      const m = String(ach.reward).match(/(\d+)/);
      if (m) await this.addExp(parseInt(m[1], 10), `achievement: ${ach.name}`);
    }
    this.saveGameState();
  }

  checkQuests() {
    const questChecks = {
      tutorial: () => this.gameState.visitedFiles.includes('/home/user/start_here.txt'),
      explore_home: () => this.gameState.visitedDirs.includes('/home/user'),
      read_diary: () => this.gameState.visitedFiles.includes('/home/user/diary.txt'),
      find_secret: () => this.gameState.visitedDirs.includes('/home/user/.secret'),
      decode_message: () => this.gameState.decodedFiles.includes('message.enc'),
      meet_guide: () => this.gameState.visitedFiles.includes('/world/nexus/guide.npc'),
      explore_system: () => this.gameState.visitedDirs.includes('/system/core'),
      play_game: () => this.gameState.gamesPlayed > 0,
      collect_keys: () => this.gameState.keyFragments.length >= 3,
      enter_shadow: () => this.gameState.visitedDirs.includes('/shadow/realm'),
      find_master_key: () => this.gameState.foundMasterKey,
      unlock_master: () => this.gameState.masterUnlocked
    };
    for (const [id, quest] of Object.entries(this.quests)) {
      if (!quest.completed && questChecks[id] && questChecks[id]()) {
        quest.completed = true;
        quest.active = false;
        const questIds = Object.keys(this.quests);
        const index = questIds.indexOf(id);
        if (index < questIds.length - 1) this.quests[questIds[index + 1]].active = true;
        console.log();
        console.log(colors.success(`[quest] ${quest.name || quest.desc}`));
        if (quest.reward) {
          const m = String(quest.reward).match(/(\d+)/);
          if (m) this.addExp(parseInt(m[1], 10), 'quest reward');
        }
        console.log();
      }
    }
    if (this.gameState.visitedDirs.length >= 3) {
      this.gameState.explorationLevel = Math.max(this.gameState.explorationLevel, 2);
    }
    if (this.gameState.visitedDirs.includes('/system/core')) {
      this.gameState.explorationLevel = Math.max(this.gameState.explorationLevel, 3);
    }
    if (this.gameState.visitedDirs.includes('/world/nexus')) {
      this.gameState.explorationLevel = Math.max(this.gameState.explorationLevel, 4);
    }
    if (this.gameState.foundMasterKey) {
      this.gameState.explorationLevel = Math.max(this.gameState.explorationLevel, 5);
    }
    // v2.4: track min alignment seen so pacifist can tell.
    // v2.5: the init flag is persisted in the save envelope
    // (`minAlignmentInit`) so reopening the game does not re-seed the
    // minimum to the current alignment. The first time we see the field
    // we seed to current; thereafter we only ratchet downward.
    const cur = Number(this.gameState.alignment) || 0;
    if (this.gameState.minAlignmentInit !== true) {
      this.gameState.minAlignment = cur;
      this.gameState.minAlignmentInit = true;
    } else if (typeof this.gameState.minAlignment !== 'number') {
      this.gameState.minAlignment = cur;
    } else if (cur < this.gameState.minAlignment) {
      this.gameState.minAlignment = cur;
    }
    // v2.4: evaluate pluggable community quests (may grant rewards)
    this.evaluateCommunityQuests();
    // evaluate automatic achievements (from the new extras pool)
    this.evaluateAutoAchievements().catch(() => {});
  }

  // -------- Time & alignment --------
  advanceTime(n = 1) {
    const before = Number(this.gameState.turn) || 0;
    const res = timeMod.advance(this.gameState, n);
    if (!this.gameState.phasesSeen) this.gameState.phasesSeen = [];
    for (const p of res.newPhases) {
      if (!this.gameState.phasesSeen.includes(p.name)) {
        this.gameState.phasesSeen.push(p.name);
      }
      if (p.name === 'night') this.gameState.nightVisited = true;
      if (p.name === 'dawn') this.gameState.dawnVisited = true;
    }
    // v2.6: track season transitions
    const after = Number(this.gameState.turn) || 0;
    const newSeasons = seasonMod.seasonsBetween(before, after);
    if (!this.gameState.seasonsSeen) this.gameState.seasonsSeen = [];
    const beforeSeason = seasonMod.getSeason(before).name;
    if (!this.gameState.seasonsSeen.includes(beforeSeason)) {
      this.gameState.seasonsSeen.push(beforeSeason);
    }
    for (const s of newSeasons) {
      if (!this.gameState.seasonsSeen.includes(s.name)) {
        this.gameState.seasonsSeen.push(s.name);
      }
    }
    res.newSeasons = newSeasons;

    // v2.7 (iter-14): night-shift achievement support. Each time we exit
    // a "night" phase without alignment dropping below the running min,
    // bump nightSurvivedStreak. If a night was crossed and alignment
    // ratchets down, reset to 0.
    for (const p of res.newPhases) {
      if (p.name === 'dawn') {
        // we just exited night — reward the streak if alignment held.
        const minAlign = Number(this.gameState.minAlignment || 0);
        const curAlign = Number(this.gameState.alignment || 0);
        if (curAlign >= minAlign) {
          this.gameState.nightSurvivedStreak =
            Number(this.gameState.nightSurvivedStreak || 0) + 1;
        } else {
          this.gameState.nightSurvivedStreak = 0;
        }
      }
    }

    return res;
  }

  getPhase() {
    return timeMod.getPhase(this.gameState.turn || 0);
  }

  adjustAlignment(delta) {
    const cur = Number(this.gameState.alignment) || 0;
    this.gameState.alignment = Math.max(-10, Math.min(10, cur + (Number(delta) || 0)));
  }

  getNpcMood(alignmentOverride) {
    const a = alignmentOverride !== undefined ? alignmentOverride : (this.gameState.alignment || 0);
    if (a >= 3) return 'friendly';
    if (a <= -3) return 'hostile';
    return 'neutral';
  }

  async evaluateAutoAchievements() {
    const ids = evaluateAutoUnlocks(this.achievements, this.gameState);
    for (const id of ids) {
      await this.unlockAchievement(id);
    }
  }

  // -------- Input loop (simple, no conflicting raw mode) --------
  startInputLoop() {
    // v2.5 (iter-10): completer wires our existing completionsFor() helper
    // into readline. When the user hits <tab> we return matches for the
    // current word — known commands, aliases, and visible objects in cwd.
    const completer = (line) => {
      try {
        const colon = line.startsWith(':') ? ':' : '';
        const trimmed = colon ? line.slice(1) : line;
        // only complete the last word
        const tokens = trimmed.split(/\s+/);
        const last = tokens[tokens.length - 1] || '';
        const verb = tokens.length > 1 ? tokens[0].toLowerCase() : null;
        // v2.6: provide context for talk/use/gift/goto/bookmark when a verb leads.
        const ctxVerbs = new Set(['talk', 'use', 'gift', 'goto', 'bookmark']);
        const context = (verb && ctxVerbs.has(verb))
          ? { verb, argIndex: tokens.length - 1 }
          : null;
        const hits = this.commandSystem.completionsFor(last.toLowerCase(), context);
        return [hits.map((h) => colon + (tokens.length === 1 ? h : tokens.slice(0, -1).join(' ') + ' ' + h)), line];
      } catch (_) {
        return [[], line];
      }
    };
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.prompt + ' ',
      historySize: 200,
      completer,
      // v2.5 (iter-10): seed up-arrow history from the persisted slot.
      // readline expects most-recent-first, while we save oldest-first.
      history: (Array.isArray(this.gameState.commandHistory)
        ? this.gameState.commandHistory.slice(-50).reverse()
        : [])
    });
    this.rl = rl;
    rl.setPrompt(this.prompt + ' ');
    rl.prompt();

    let sigintCount = 0;
    let sigintTimer = null;

    rl.on('SIGINT', () => {
      sigintCount++;
      if (sigintCount >= 2) {
        // Hard exit
        console.log();
        console.log(colors.dim(t('exit.bye')));
        this.saveGameState();
        process.exit(0);
      }
      console.log();
      console.log(colors.warning(`Ctrl+C again within 2s to exit, or type "exit".`));
      rl.prompt();
      clearTimeout(sigintTimer);
      sigintTimer = setTimeout(() => { sigintCount = 0; }, 2000);
    });

    rl.on('line', async (input) => {
      try {
        await this.commandSystem.execute(input);
      } catch (e) {
        console.log(colors.error(`[error] ${e && e.message ? e.message : e}`));
      }
      if (this.exiting) {
        rl.close();
        return;
      }
      this.updatePrompt();
      rl.setPrompt(this.prompt + ' ');
      rl.prompt();
    });

    rl.on('close', () => {
      console.log();
      console.log(colors.dim(t('exit.bye')));
      this.saveGameState();
      console.log(colors.info(t('exit.saved')));
      process.exit(0);
    });

    // graceful termination on SIGTERM
    process.on('SIGTERM', () => {
      this.saveGameState();
      process.exit(0);
    });
  }

  requestExit() {
    this.exiting = true;
  }
}

module.exports = { TerminalGame, DEFAULT_STATE };
