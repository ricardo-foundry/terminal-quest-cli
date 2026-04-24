// ============================================
// Terminal Quest CLI - main game loop
// ============================================

const readline = require('readline');
const { colors, bootSequence, showAchievement, showLevelUp, applyTheme } = require('./ui');
const { FILE_SYSTEM, ACHIEVEMENTS, QUESTS, LEVELS } = require('./data');
const { CommandSystem } = require('./commands');
const saveMod = require('./save');
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
  locale: undefined // auto-detect when missing
};

class TerminalGame {
  constructor(options = {}) {
    this.options = options;
    this.slot = options.slot || saveMod.DEFAULT_SLOT;
    this.commandSystem = new CommandSystem(this);
    this.gameState = this.loadGameState();
    this.currentPath = this.gameState.currentPath || '/home/user';
    this.achievements = JSON.parse(JSON.stringify(ACHIEVEMENTS));
    this.quests = JSON.parse(JSON.stringify(QUESTS));
    this.rl = null;
    this.exiting = false;
    this.syncAchievements();
    this.syncQuests();

    // apply persisted preferences
    if (this.gameState.locale) setLocale(this.gameState.locale);
    applyTheme(this.gameState.theme || 'dark');
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
      saveMod.save(this.slot, state);
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

    // Small delayed unlock so intro isn't racy
    setTimeout(() => this.unlockAchievement('first_step').catch(() => {}), 500);

    this.startInputLoop();
  }

  updatePrompt() {
    const p = this.currentPath;
    const displayPath = p.replace('/home/user', '~').replace('/home', '~');
    const levelIndicator = colors.gold(`[Lv.${this.gameState.level}]`);
    this.prompt = `${levelIndicator} ${colors.primary('explorer@kimi-os')}:${colors.secondary(displayPath)}$`;
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
  normalizePath(p) {
    if (!p) return this.currentPath;
    if (p === '~') return '/home/user';
    if (p.startsWith('~/')) p = '/home/user/' + p.slice(2);
    let base;
    if (p.startsWith('/')) {
      base = p;
    } else {
      base = this.currentPath === '/' ? '/' + p : this.currentPath + '/' + p;
    }
    const parts = base.split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }
    return '/' + stack.join('/');
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
  }

  // -------- Input loop (simple, no conflicting raw mode) --------
  startInputLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.prompt + ' ',
      historySize: 200
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
