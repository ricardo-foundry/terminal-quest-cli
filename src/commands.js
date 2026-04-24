// ============================================
// Terminal Quest CLI - command dispatcher
// ============================================

const { colors, HELP_TEXT, sleep, animations, applyTheme, padVisual, visualWidth } = require('./ui');
const { EASTER_EGGS, NPCS, LEVELS, FILE_SYSTEM } = require('./data');
const { t, setLocale, getLocale, availableLocales } = require('./i18n');
const { availableThemes } = require('./themes');
const saveMod = require('./save');
const minigames = require('./minigames');

// Tokenise an input line into argv. Supports single/double quotes.
function tokenize(input) {
  const out = [];
  let cur = '';
  let quote = null;
  let escaped = false;
  for (const ch of input) {
    if (escaped) {
      cur += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      if (cur !== '') { out.push(cur); cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur !== '') out.push(cur);
  return out;
}

class CommandSystem {
  constructor(game) {
    this.game = game;
    this.history = [];
    this.historyIndex = -1;
  }

  async execute(input) {
    if (typeof input !== 'string') return;
    input = input.trim();
    if (!input) return;

    this.history.push(input);
    this.historyIndex = this.history.length;

    const parts = tokenize(input);
    if (parts.length === 0) return;
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // echo command in dim for replay clarity (optional)
    // we skip echoing by default because readline already echoes input

    const commands = {
      help: () => this.cmdHelp(args),
      ls: () => this.cmdLs(args),
      cd: () => this.cmdCd(args),
      cat: () => this.cmdCat(args),
      pwd: () => this.cmdPwd(),
      clear: () => this.cmdClear(),
      tree: () => this.cmdTree(),
      exit: () => this.cmdExit(),
      quit: () => this.cmdExit(),
      reboot: () => this.cmdReboot(),

      find: () => this.cmdFind(args),
      grep: () => this.cmdGrep(args),

      scan: () => this.cmdScan(),
      decode: () => this.cmdDecode(args),
      analyze: () => this.cmdAnalyze(),
      hack: () => this.cmdHack(),

      run: () => this.cmdRun(args),
      matrix: () => this.cmdMatrix(),

      status: () => this.cmdStatus(),
      inventory: () => this.cmdInventory(),
      inv: () => this.cmdInventory(),
      use: () => this.cmdUse(args),
      talk: () => this.cmdTalk(args),
      map: () => this.cmdMap(),
      quests: () => this.cmdQuests(),
      achievements: () => this.cmdAchievements(),
      unlock: () => this.cmdUnlock(args),
      hint: () => this.cmdHint(),

      save: () => this.cmdSave(args),
      load: () => this.cmdLoad(args),
      saves: () => this.cmdSaves(),
      theme: () => this.cmdTheme(args),
      lang: () => this.cmdLang(args),
      version: () => this.cmdVersion(),

      whoami: () => this.cmdWhoami(),
      date: () => this.cmdDate(),
      echo: () => this.cmdEcho(args),
      sudo: () => this.cmdSudo(),

      love: () => this.cmdEasterEgg('love'),
      coffee: () => this.cmdEasterEgg('coffee'),
      42: () => this.cmdEasterEgg('42'),
      hello: () => this.cmdEasterEgg('hello'),
      easteregg: () => this.cmdEasterEgg('easteregg'),
      admin: () => this.cmdEasterEgg('admin')
    };

    if (commands[cmd]) {
      await commands[cmd]();
    } else if (EASTER_EGGS[cmd]) {
      console.log(colors.info(EASTER_EGGS[cmd]));
      if (cmd === 'coffee' && !this.game.gameState.achievements.includes('coffee_lover')) {
        await this.game.addExp(5, 'coffee');
        await this.game.unlockAchievement('coffee_lover');
      }
    } else {
      console.log(colors.error(t('cmd.unknown', { cmd })));
      console.log(colors.dim(t('cmd.hint')));
    }

    this.game.checkQuests();
    this.game.saveGameState();
  }

  // ---- basic ----
  async cmdHelp(args) {
    console.log(HELP_TEXT.basic());
    if (this.game.gameState.explorationLevel > 1 || this.game.gameState.scanMode) {
      console.log(HELP_TEXT.advanced());
    }
    console.log(HELP_TEXT.rpg());
    console.log(HELP_TEXT.meta());
    if (this.game.gameState.achievements.length > 2 || this.game.gameState.gamesPlayed > 0) {
      console.log(HELP_TEXT.secret());
    }
    console.log(HELP_TEXT.tips());
    this.game.gameState.helpCount = (this.game.gameState.helpCount || 0) + 1;
    if (this.game.gameState.helpCount >= 5) await this.game.unlockAchievement('curious');
  }

  async cmdLs(args) {
    const options = args.filter((a) => a.startsWith('-'));
    const paths = args.filter((a) => !a.startsWith('-'));
    const inputPath = paths[0] || '.';
    const flagsCombined = options.join('');
    const showHidden = flagsCombined.includes('a') || this.game.gameState.scanMode;
    const dir = this.game.resolvePath(inputPath);

    if (!dir || dir.type !== 'dir') {
      console.log(colors.error(t('ls.noent', { path: inputPath })));
      return;
    }

    const children = dir.children || {};
    const entries = Object.entries(children).sort((a, b) => {
      if (a[1].type !== b[1].type) return a[1].type === 'dir' ? -1 : 1;
      return a[0].localeCompare(b[0]);
    });
    const visible = entries.filter(([name, item]) => !item.hidden || showHidden);

    console.log();
    if (visible.length === 0) {
      console.log(colors.dim(t('ls.empty')));
    } else {
      for (const [name, item] of visible) {
        let icon, color;
        if (item.type === 'dir') { icon = '[D]'; color = colors.secondary; }
        else if (item.executable) {
          if (item.npc) { icon = '[N]'; color = colors.accent; }
          else if (item.game) { icon = '[G]'; color = colors.warning; }
          else { icon = '[X]'; color = colors.success; }
        } else if (item.encrypted) { icon = '[E]'; color = colors.error; }
        else if (item.hidden) { icon = '[.]'; color = colors.dim; }
        else { icon = '[F]'; color = colors.white; }

        // display name is the raw child-key; do NOT re-prefix a leading dot.
        console.log(`  ${icon}  ${color(name)}`);
      }
      console.log();
      const dirs = visible.filter((e) => e[1].type === 'dir').length;
      const files = visible.filter((e) => e[1].type === 'file').length;
      console.log(colors.dim(t('ls.total', { dirs, files })));
    }
    console.log();

    // Record visit of the listed directory
    const fullPath = this.game.normalizePath(inputPath);
    if (!this.game.gameState.visitedDirs.includes(fullPath)) {
      this.game.gameState.visitedDirs.push(fullPath);
    }
    if (this.game.gameState.visitedDirs.length >= 5) {
      await this.game.unlockAchievement('explorer');
    }
    if (showHidden && entries.some(([, item]) => item.hidden)) {
      await this.game.unlockAchievement('hacker');
    }
  }

  cmdCd(args) {
    const inputPath = args[0] || '/home/user';
    const targetPath = this.game.normalizePath(
      inputPath === '' || inputPath === '~' ? '/home/user' : inputPath
    );
    const dir = this.game.getDirByPath(targetPath);

    if (!dir) {
      console.log(colors.error(t('cd.noent', { path: inputPath })));
      return;
    }
    if (dir.type !== 'dir') {
      console.log(colors.error(t('cd.notdir', { path: inputPath })));
      return;
    }

    // level gates
    if (targetPath === '/shadow/realm' || targetPath.startsWith('/shadow/realm/')) {
      if (this.game.gameState.level < 5) {
        console.log(colors.error(t('cd.locked.level', {
          area: '/shadow/realm',
          need: 5,
          have: this.game.gameState.level
        })));
        console.log(colors.dim(t('cd.hint.levelup')));
        return;
      }
      if (!this.game.gameState.achievements.includes('shadow_walker')) {
        this.game.unlockAchievement('shadow_walker').catch(() => {});
      }
    }
    if (targetPath === '/world/nexus' && this.game.gameState.level < 3) {
      console.log(colors.error(t('cd.locked.level', {
        area: '/world/nexus',
        need: 3,
        have: this.game.gameState.level
      })));
      return;
    }

    this.game.currentPath = targetPath;
    this.game.updatePrompt();

    if (!this.game.gameState.visitedDirs.includes(targetPath)) {
      this.game.gameState.visitedDirs.push(targetPath);
    }

    if (targetPath === '/system/core') {
      console.log(colors.warning('entering system core'));
      this.game.gameState.explorationLevel = Math.max(this.game.gameState.explorationLevel, 3);
    } else if (targetPath === '/shadow/realm') {
      console.log(colors.error('you entered the shadow realm...'));
      this.game.gameState.explorationLevel = Math.max(this.game.gameState.explorationLevel, 5);
    }
  }

  async cmdCat(args) {
    if (args.length === 0) {
      console.log(colors.error(t('cat.usage')));
      return;
    }
    const filename = args[0];
    const file = this.game.resolvePath(filename);
    if (!file) {
      console.log(colors.error(t('cat.noent', { file: filename })));
      return;
    }
    if (file.type === 'dir') {
      console.log(colors.error(t('cat.isdir', { file: filename })));
      return;
    }
    if (file.encrypted && !this.game.gameState.decodedFiles.includes(this.game.normalizePath(filename))
        && !this.game.gameState.decodedFiles.includes(filename)) {
      console.log(colors.error(t('cat.encrypted', { file: filename })));
      return;
    }

    console.log();
    console.log(colors.info(file.content || '(empty)'));
    console.log();

    const fullPath = this.game.normalizePath(filename);
    if (!this.game.gameState.visitedFiles.includes(fullPath)) {
      this.game.gameState.visitedFiles.push(fullPath);
    }

    // key fragments
    if (file.content && /密钥片段|key fragment/i.test(file.content)) {
      const match = file.content.match(/(?:片段|fragment)[:：\s]*(AW4K3|_TH3_|4I)/i);
      if (match) {
        const frag = match[1];
        if (!this.game.gameState.keyFragments.includes(frag)) {
          this.game.gameState.keyFragments.push(frag);
          console.log(colors.success(t('key.got', { frag })));
          await this.game.addExp(50, 'key fragment');
          if (this.game.gameState.keyFragments.length >= 3) {
            await this.game.unlockAchievement('collector');
            console.log(colors.rainbow('\n' + t('key.all', { key: 'AW4K3_TH3_4I' })));
            console.log(colors.info(t('key.unlock.hint')));
          }
        }
      }
    }

    if (file.content && /终极密钥|master key/i.test(file.content)) {
      if (!this.game.gameState.foundMasterKey) {
        this.game.gameState.foundMasterKey = true;
        await this.game.addExp(100, 'master key');
      }
    }

    if (fullPath.endsWith('.void/whisper.txt') && !this.game.gameState.voidVisited) {
      this.game.gameState.voidVisited = true;
      await this.game.addExp(100, 'void');
      if (!this.game.gameState.inventory.includes('abyss-gazer-eye')) {
        this.game.gameState.inventory.push('abyss-gazer-eye');
      }
      console.log(colors.purple('[obtained: abyss-gazer-eye]'));
    }
  }

  cmdPwd() { console.log(this.game.currentPath); }
  cmdClear() { console.clear(); }

  // ---- advanced ----
  async cmdScan() {
    await animations.spinner('scanning', 800);
    this.game.gameState.scanMode = true;
    console.log(colors.success(t('scan.done')));
    const dir = this.game.resolvePath('.');
    if (dir && dir.children) {
      const n = Object.values(dir.children).filter((i) => i.hidden).length;
      if (n > 0) console.log(colors.warning(t('scan.hidden', { n })));
    }
    await this.game.addExp(10, 'scan');
  }

  async cmdDecode(args) {
    if (args.length === 0) {
      console.log(colors.error(t('decode.usage')));
      return;
    }
    const filename = args[0];
    const file = this.game.resolvePath(filename);
    if (!file) {
      console.log(colors.error(t('decode.noent', { file: filename })));
      return;
    }
    if (!file.encrypted && !filename.endsWith('.enc')) {
      console.log(colors.error(t('decode.notenc')));
      return;
    }
    console.log(colors.info(t('decode.running')));
    await animations.hackDecode('decryption complete', 600);
    await sleep(100);
    console.log(colors.success(`
-----------------------------------------
 Decrypted message
-----------------------------------------
Hello, explorer.

If you are reading this, you have come far.
Collect all three key fragments.

Fragment 1: AW4K3
Location: /home/user/.secret/

- KIMI-AI
-----------------------------------------
`));
    const full = this.game.normalizePath(filename);
    if (!this.game.gameState.decodedFiles.includes(filename)) {
      this.game.gameState.decodedFiles.push(filename);
    }
    if (!this.game.gameState.decodedFiles.includes(full)) {
      this.game.gameState.decodedFiles.push(full);
    }
    await this.game.unlockAchievement('codebreaker');
    await this.game.addExp(40, 'decode');
  }

  async cmdAnalyze() {
    console.log(colors.info('analyzing environment...'));
    await animations.progressBar(600, 8, 'analyze');
    const dir = this.game.resolvePath('.');
    const dirName = this.game.currentPath.split('/').pop() || 'root';
    console.log();
    console.log(colors.bold('Analysis:'));
    console.log(colors.dim('-'.repeat(40)));
    console.log(`${colors.primary('path:')} ${this.game.currentPath}`);
    console.log(`${colors.primary('dir:')} ${dirName}`);
    let hiddenCount = 0;
    if (dir && dir.children) {
      const total = Object.keys(dir.children).length;
      hiddenCount = Object.values(dir.children).filter((i) => i.hidden).length;
      console.log(`${colors.primary('items:')} ${total} (hidden: ${hiddenCount})`);
    }
    console.log(`${colors.primary('security:')} ${this.game.getSecurityLevel()}`);
    if (hiddenCount > 0 && !this.game.gameState.scanMode) {
      console.log(colors.warning('Tip: run "scan" to reveal hidden items'));
    }
    console.log(colors.dim('-'.repeat(40)));
    await this.game.addExp(5, 'analyze');
  }

  async cmdHack() {
    console.log(colors.error('entering hacker mode'));
    await animations.progressBar(1200, 10, 'exploit');
    this.game.gameState.scanMode = true;
    this.game.gameState.explorationLevel = Math.max(this.game.gameState.explorationLevel, 5);
    console.log(colors.success('hacker mode active'));
    await this.game.addExp(50, 'hack');
  }

  // ---- games ----
  async cmdRun(args) {
    if (args.length === 0) {
      console.log(colors.error('Usage: run <snake|guess|matrix|pong|wordle>'));
      return;
    }
    const name = args[0].toLowerCase();
    const valid = ['snake', 'guess', 'matrix', 'pong', 'wordle'];
    if (!valid.includes(name)) {
      console.log(colors.error(`run: ${name}: game not found`));
      return;
    }

    // Pause the outer readline so minigames own stdin cleanly
    const rl = this.game.rl;
    if (rl) rl.pause();

    let result;
    try {
      result = await minigames[name](this.game);
    } finally {
      if (rl) rl.resume();
    }

    this.game.gameState.gamesPlayed = (this.game.gameState.gamesPlayed || 0) + 1;
    if (!this.game.gameState.gamesList) this.game.gameState.gamesList = [];
    const completed = result && result.completed !== false; // only count real plays
    if (completed && !this.game.gameState.gamesList.includes(name)) {
      this.game.gameState.gamesList.push(name);
    }
    if (completed) {
      await this.game.unlockAchievement('gamer');
      if (this.game.gameState.gamesList.length >= 5) {
        await this.game.unlockAchievement('game_master');
      }
      if (name === 'snake' && result && result.score >= 50) await this.game.unlockAchievement('snake_charmer');
      if (name === 'guess' && result && result.attempts === 1 && result.win) await this.game.unlockAchievement('psychic');
      if (name === 'wordle' && result && result.attempts === 1 && result.win) await this.game.unlockAchievement('wordle_wizard');
    }
  }

  async cmdMatrix() {
    const rl = this.game.rl;
    if (rl) rl.pause();
    try {
      await minigames.matrix(this.game);
    } finally {
      if (rl) rl.resume();
    }
  }

  // ---- RPG ----
  cmdStatus() {
    const gs = this.game.gameState;
    const levelInfo = LEVELS[gs.level] || LEVELS[1];
    const next = LEVELS[gs.level + 1];
    const expPercent = next ? Math.floor((gs.exp / next.expRequired) * 100) : 100;
    const bar = '#'.repeat(Math.floor(expPercent / 5)) + '-'.repeat(20 - Math.floor(expPercent / 5));
    const width = 50;
    const border = '='.repeat(width);

    console.log();
    console.log(colors.gold(`+${border}+`));
    console.log(colors.gold(`| ${padVisual(colors.bold(t('status.title')), width - 2)}|`));
    console.log(colors.gold(`+${border}+`));
    console.log(colors.gold(`| ${padVisual(`${t('status.level')}: Lv.${gs.level} ${levelInfo.title}`, width - 2)}|`));
    console.log(colors.gold(`| ${padVisual(`${t('status.exp')}: ${gs.exp}`, width - 2)}|`));
    console.log(colors.gold(`| ${padVisual(`${t('status.progress')}: [${bar}] ${expPercent}%`, width - 2)}|`));
    if (next) {
      console.log(colors.gold(`| ${padVisual(t('status.next', { n: next.expRequired - gs.exp }), width - 2)}|`));
    } else {
      console.log(colors.gold(`| ${padVisual(t('status.maxed'), width - 2)}|`));
    }
    console.log(colors.gold(`+${border}+`));
    const totalAch = Object.keys(this.game.achievements).length;
    const totalQ = Object.keys(this.game.quests).length;
    console.log(colors.gold(`| ${padVisual(`${t('status.dirs')}: ${gs.visitedDirs.length}`, width - 2)}|`));
    console.log(colors.gold(`| ${padVisual(`${t('status.files')}: ${gs.visitedFiles.length}`, width - 2)}|`));
    console.log(colors.gold(`| ${padVisual(`${t('status.games')}: ${gs.gamesPlayed}`, width - 2)}|`));
    console.log(colors.gold(`| ${padVisual(`${t('status.achievements')}: ${gs.achievements.length} / ${totalAch}`, width - 2)}|`));
    console.log(colors.gold(`| ${padVisual(`${t('status.quests')}: ${Object.values(this.game.quests).filter((q) => q.completed).length} / ${totalQ}`, width - 2)}|`));
    console.log(colors.gold(`+${border}+`));
    console.log();
  }

  cmdInventory() {
    const inv = this.game.gameState.inventory || [];
    console.log();
    console.log(colors.bold(t('inv.title')));
    console.log(colors.dim('-'.repeat(40)));
    if (inv.length === 0) console.log(colors.dim(t('inv.empty')));
    else inv.forEach((item, i) => console.log(`  ${i + 1}. ${colors.accent(item)}`));
    console.log();
  }

  async cmdUse(args) {
    if (args.length === 0) {
      console.log(colors.error(t('use.usage')));
      return;
    }
    const itemName = args.join(' ');
    const inv = this.game.gameState.inventory || [];
    if (!inv.includes(itemName)) {
      console.log(colors.error(t('use.missing', { item: itemName })));
      return;
    }
    console.log(colors.info(`using ${itemName}`));
    if (itemName === 'abyss-gazer-eye') {
      console.log(colors.purple('vision sharpened - hidden items now visible'));
      this.game.gameState.scanMode = true;
    } else {
      console.log(colors.dim('nothing happens'));
    }
  }

  async cmdTalk(args) {
    if (args.length === 0) {
      console.log(colors.error('Usage: talk <npc>'));
      const dir = this.game.resolvePath('.');
      if (dir && dir.children) {
        const npcs = Object.entries(dir.children).filter(([, it]) => it.npc);
        if (npcs.length > 0) {
          console.log(colors.info('NPCs here:'));
          npcs.forEach(([name]) => console.log(`  - ${name.replace('.npc', '')}`));
        }
      }
      return;
    }
    const npcName = args[0].toLowerCase();
    const npc = NPCS[npcName];
    if (!npc) {
      console.log(colors.error(`npc not found: ${npcName}`));
      return;
    }
    const dir = this.game.resolvePath('.');
    const file = Object.keys(dir && dir.children ? dir.children : {}).find((n) => n.toLowerCase().includes(npcName));
    if (!file) {
      console.log(colors.error(`${npc.name} is not here`));
      return;
    }
    console.log();
    console.log(colors.accent(`${npc.icon} ${npc.name}:`));
    console.log(colors.info(`  "${npc.dialogs.greeting}"`));
    console.log();

    // track visit of the NPC file
    const fullPath = this.game.normalizePath(file);
    if (!this.game.gameState.visitedFiles.includes(fullPath)) {
      this.game.gameState.visitedFiles.push(fullPath);
    }
  }

  cmdMap() {
    console.log();
    console.log(colors.bold('World map'));
    console.log(colors.dim('-'.repeat(50)));
    console.log(colors.secondary(`
    /home/user/          [Lv.1] start
       |
       +- .secret/       [hidden] key 1
       |
    /system/core/        [Lv.2] core
       |
       +- key fragment 2 [hidden]
       |
    /world/nexus/        [Lv.3] nexus
       |
       +- guide AI
       +- trade shop
       |
    /shadow/realm/       [Lv.5] ! danger
       |
       +- master key     [goal]
       +- .void/         [???]
`));
    console.log();
  }

  cmdQuests() {
    console.log();
    console.log(colors.bold(t('quests.title')));
    console.log(colors.dim('-'.repeat(50)));
    let done = 0, total = 0;
    for (const quest of Object.values(this.game.quests)) {
      total++;
      if (quest.completed) done++;
      if (!quest.active && !quest.completed) continue;
      const status = quest.completed ? colors.success('[x]') : (quest.active ? colors.warning('[>]') : colors.dim('[ ]'));
      const colorFn = quest.completed ? colors.dim : (quest.active ? colors.primary : colors.dim);
      const reward = quest.reward ? colors.gold(` [${quest.reward}]`) : '';
      console.log(`${status} ${colorFn(quest.name || quest.desc)}${reward}`);
      if (!quest.completed) console.log(colors.dim(`   ${quest.desc}`));
    }
    console.log(colors.dim('-'.repeat(50)));
    console.log(colors.success(t('quests.progress', { done, total })));
    console.log();
  }

  cmdAchievements() {
    console.log();
    console.log(colors.bold(t('ach.title')));
    console.log(colors.dim('-'.repeat(50)));
    let done = 0, total = 0;
    for (const ach of Object.values(this.game.achievements)) {
      total++;
      if (ach.unlocked) done++;
      const status = ach.unlocked ? colors.success('[x]') : colors.dim('[ ]');
      const colorFn = ach.unlocked ? colors.primary : colors.dim;
      const reward = ach.reward ? colors.gold(` ${ach.reward}`) : '';
      console.log(`${status} ${colorFn(ach.icon + ' ' + ach.name)}${reward}`);
      console.log(colors.dim(`   ${ach.desc}`));
    }
    console.log(colors.dim('-'.repeat(50)));
    console.log(t('ach.progress', { done, total }));
    if (done >= total - 1 && !this.game.achievements.completionist.unlocked) {
      this.game.unlockAchievement('completionist').catch(() => {});
    }
  }

  async cmdUnlock(args) {
    if (!args || args.length === 0 || args[0].toLowerCase() !== 'master') {
      console.log(colors.error('Usage: unlock master'));
      return;
    }
    if (this.game.gameState.keyFragments.length < 3) {
      console.log(colors.error(t('key.incomplete', { have: this.game.gameState.keyFragments.length })));
      return;
    }
    console.log(colors.info('verifying master key'));
    await animations.typeWrite('AW4K3_TH3_4I', 50);
    await sleep(200);
    this.game.gameState.masterUnlocked = true;
    await this.game.unlockAchievement('master');
    await this.game.addExp(500, 'master unlock');
    console.log(colors.rainbow('*** the ultimate secret is revealed ***'));
    console.log(colors.success(`
You finished every quest.
You found every secret.
Thank you for exploring.
  - KIMI-AI
`));
  }

  cmdHint() {
    const gs = this.game.gameState;
    const hints = [
      { cond: () => true, text: 'Use "scan" to reveal hidden files' },
      { cond: () => gs.visitedFiles.includes('/home/user/start_here.txt'), text: 'Check /home/user/.secret/' },
      { cond: () => gs.visitedFiles.includes('/home/user/diary.txt'), text: 'Head to /system/core/ for fragment 2' },
      { cond: () => gs.keyFragments.length >= 2, text: 'Fragment 3 awaits in /shadow/realm/ (Lv.5)' },
      { cond: () => gs.level < 3, text: 'Play minigames to gain EXP' },
      { cond: () => gs.level >= 3 && !gs.visitedDirs.includes('/world/nexus'), text: 'Find the guide in /world/nexus/' }
    ];
    const applicable = hints.filter((h) => h.cond());
    const h = applicable[applicable.length - 1];
    console.log(colors.info(`hint: ${h ? h.text : 'keep exploring'}`));
  }

  // ---- save / load / theme / lang / version ----
  cmdSave(args) {
    const slot = (args[0] || this.game.slot || saveMod.DEFAULT_SLOT).trim();
    try {
      this.game.slot = slot;
      this.game.saveGameState();
      console.log(colors.success(t('save.ok', { slot })));
    } catch (e) {
      console.log(colors.error(t('save.fail', { err: e.message })));
    }
  }

  cmdLoad(args) {
    if (!args[0]) {
      console.log(colors.error(t('load.usage')));
      return;
    }
    const slot = args[0].trim();
    try {
      const payload = saveMod.load(slot);
      if (!payload) throw new Error('slot not found');
      // merge into running state
      this.game.slot = slot;
      this.game.gameState = { ...this.game.gameState, ...payload.state };
      this.game.currentPath = this.game.gameState.currentPath || '/home/user';
      // reset in-memory achievements / quests then re-sync
      const { ACHIEVEMENTS, QUESTS } = require('./data');
      this.game.achievements = JSON.parse(JSON.stringify(ACHIEVEMENTS));
      this.game.quests = JSON.parse(JSON.stringify(QUESTS));
      this.game.syncAchievements();
      this.game.syncQuests();
      this.game.updatePrompt();
      console.log(colors.success(t('load.ok', { slot })));
    } catch (e) {
      console.log(colors.error(t('load.fail', { slot, err: e.message })));
    }
  }

  cmdSaves() {
    const slots = saveMod.listSlots();
    console.log();
    console.log(colors.bold(t('saves.title')));
    console.log(colors.dim('-'.repeat(50)));
    if (slots.length === 0) {
      console.log(colors.dim(t('saves.empty')));
    } else {
      for (const s of slots) {
        const d = new Date(s.savedAt).toISOString().replace('T', ' ').slice(0, 19);
        console.log(`  ${colors.primary(s.slot.padEnd(16))}  Lv.${s.level || '?'}  ${s.exp || 0} EXP  ${colors.dim(d)}`);
      }
    }
    console.log();
  }

  cmdTheme(args) {
    if (!args[0]) {
      console.log(colors.error(t('theme.usage')));
      console.log(colors.dim(`  available: ${availableThemes().join(', ')}`));
      return;
    }
    const name = args[0].toLowerCase();
    if (!availableThemes().includes(name)) {
      console.log(colors.error(t('theme.unknown', { name })));
      return;
    }
    applyTheme(name);
    this.game.gameState.theme = name;
    this.game.updatePrompt();
    console.log(colors.success(t('theme.set', { name })));
  }

  cmdLang(args) {
    if (!args[0]) {
      console.log(colors.error(t('lang.usage')));
      console.log(colors.dim(`  available: ${availableLocales().join(', ')}`));
      return;
    }
    const code = args[0].toLowerCase();
    if (!setLocale(code)) {
      console.log(colors.error(t('lang.unknown', { name: code })));
      return;
    }
    this.game.gameState.locale = code;
    console.log(colors.success(t('lang.set', { name: code })));
  }

  cmdVersion() {
    const pkg = require('../package.json');
    console.log(`${pkg.name} v${pkg.version}`);
    console.log(`node ${process.version}  platform ${process.platform}`);
    console.log(`locale ${getLocale()}  theme ${colors.currentThemeName || 'dark'}`);
    console.log(`save dir ${saveMod.SAVE_DIR}`);
  }

  // ---- misc ----
  cmdWhoami() {
    console.log(colors.info(EASTER_EGGS['whoami']));
    console.log(colors.success('user: explorer'));
    console.log(colors.secondary(`level: Lv.${this.game.gameState.level} ${LEVELS[this.game.gameState.level]?.title || ''}`));
  }

  cmdDate() {
    console.log(new Date().toString());
    const uptime = Math.floor((Date.now() - this.game.gameState.startTime) / 1000);
    const minutes = Math.floor(uptime / 60);
    const seconds = uptime % 60;
    console.log(colors.dim(`uptime: ${minutes}m${seconds}s`));
  }

  cmdEcho(args) {
    console.log(args.join(' '));
  }

  cmdGrep(args) {
    if (args.length < 2) {
      console.log(colors.error('Usage: grep <pattern> <file>'));
      return;
    }
    const pattern = args[0];
    const filename = args[1];
    const file = this.game.resolvePath(filename);
    if (!file || file.type !== 'file') {
      console.log(colors.error(`grep: ${filename}: not found`));
      return;
    }
    const lines = (file.content || '').split('\n');
    let found = false;
    const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        console.log(`${colors.dim(i + 1 + ':')} ${lines[i]}`);
        found = true;
      }
    }
    if (!found) console.log(colors.dim('no matches'));
  }

  cmdFind(args) {
    const pattern = args[0] || '';
    const results = [];
    const walk = (dir, path) => {
      if (!dir.children) return;
      for (const [name, item] of Object.entries(dir.children)) {
        const full = path + '/' + name;
        if (name.toLowerCase().includes(pattern.toLowerCase())) {
          results.push({ path: full, type: item.type });
        }
        if (item.type === 'dir') walk(item, full);
      }
    };
    walk(FILE_SYSTEM.root, '');
    if (results.length === 0) console.log(colors.dim('no matches'));
    else {
      console.log(colors.success(`found ${results.length}:`));
      results.forEach((r) => {
        const prefix = r.type === 'dir' ? '[D]' : '[F]';
        console.log(`  ${prefix} ${r.path}`);
      });
    }
  }

  cmdTree() {
    console.log();
    console.log(colors.bold('tree'));
    const scan = !!this.game.gameState.scanMode;
    const recurse = (dir, prefix) => {
      if (!dir.children) return;
      const entries = Object.entries(dir.children)
        .filter(([, it]) => !it.hidden || scan)
        .sort((a, b) => {
          if (a[1].type !== b[1].type) return a[1].type === 'dir' ? -1 : 1;
          return a[0].localeCompare(b[0]);
        });
      entries.forEach(([name, item], idx) => {
        const last = idx === entries.length - 1;
        const conn = last ? '+-- ' : '+-- ';
        let prefixColor;
        if (item.type === 'dir') prefixColor = colors.secondary('[D]');
        else if (item.game) prefixColor = colors.warning('[G]');
        else if (item.npc) prefixColor = colors.accent('[N]');
        else if (item.hidden) prefixColor = colors.dim('[.]');
        else prefixColor = colors.dim('[F]');
        console.log(prefix + conn + prefixColor + ' ' + name);
        if (item.type === 'dir') {
          recurse(item, prefix + (last ? '    ' : '|   '));
        }
      });
    };
    const dir = this.game.resolvePath('.');
    const dirName = this.game.currentPath.split('/').pop() || 'root';
    console.log(colors.secondary('[D]') + ' ' + dirName);
    recurse(dir, '');
    console.log();
  }

  cmdExit() {
    console.log(colors.dim(t('exit.bye')));
    this.game.saveGameState();
    console.log(colors.info(t('exit.saved')));
    this.game.requestExit();
  }

  async cmdReboot() {
    console.log(colors.warning('rebooting...'));
    await animations.progressBar(600, 8, 'reboot');
    this.game.saveGameState();
    console.clear();
    process.exit(0);
  }

  cmdSudo() {
    console.log(colors.error(EASTER_EGGS['sudo']));
  }

  async cmdEasterEgg(cmd) {
    console.log(colors.info(EASTER_EGGS[cmd]));
    if (cmd === 'love') {
      console.log(colors.rainbow('<3 <3 <3'));
      await this.game.addExp(10, 'love');
    }
    if (cmd === '42') {
      await sleep(300);
      console.log(colors.dim('but what is the real question?'));
    }
    if (cmd === 'easteregg') {
      this.game.gameState.easterEggCount = (this.game.gameState.easterEggCount || 0) + 1;
      if (this.game.gameState.easterEggCount >= 5) {
        await this.game.unlockAchievement('easter_egg_hunter');
      }
    }
  }

  historyUp() {
    if (this.historyIndex > 0) { this.historyIndex--; return this.history[this.historyIndex]; }
    return null;
  }
  historyDown() {
    if (this.historyIndex < this.history.length - 1) { this.historyIndex++; return this.history[this.historyIndex]; }
    return '';
  }
}

module.exports = { CommandSystem, tokenize };
