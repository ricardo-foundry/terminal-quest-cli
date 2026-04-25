/**
 * @module commands
 * @description Interactive command dispatcher.
 *
 * `CommandSystem.execute(line)` is the single entry point invoked by the
 * readline loop in game.js. It:
 *   1. records the command in `gameState.commandHistory`
 *   2. expands aliases and history bangs (`!!`, `!<n>`)
 *   3. routes to a per-verb `cmdXxx` handler
 *   4. updates session-scoped counters used by achievements
 *
 * Handlers receive parsed args (string[]) and may print, mutate
 * `this.game.gameState`, or return a Promise. They MUST NOT throw on user
 * error — print a coloured error line and bail out instead.
 */

const { colors, HELP_TEXT, sleep, animations, applyTheme, padVisual, visualWidth } = require('./ui');
const { EASTER_EGGS, NPCS, LEVELS, FILE_SYSTEM } = require('./data');
const { t, setLocale, getLocale, availableLocales } = require('./i18n');
const { availableThemes } = require('./themes');
const saveMod = require('./save');
const minigames = require('./minigames');
const shareMod = require('./share');
const timeMod = require('./time');
const seasonMod = require('./season');
const relMod = require('./relationships');
const { groupByCategory } = require('./achievements');
const leaderboardMod = require('./leaderboard');

// Item classification table. Keys are item ids, values describe category & effect.
const ITEM_META = {
  'abyss-gazer-eye': { category: 'key',        effect: 'Reveals hidden items permanently.' },
  'health-potion':   { category: 'consumable', effect: 'Restores 20 HP (flavour only).' },
  'mana-potion':     { category: 'consumable', effect: 'Restores 20 MP (flavour only).' },
  'key-shard-1':     { category: 'key',        effect: 'Key fragment 1 of 3.' },
  'key-shard-2':     { category: 'key',        effect: 'Key fragment 2 of 3.' },
  'key-shard-3':     { category: 'key',        effect: 'Key fragment 3 of 3.' },
  'torch':           { category: 'equipment',  effect: 'Lights up dark areas.' },
  'detector':        { category: 'equipment',  effect: 'Pings toward nearby fragments.' },
  'rare-stamp':      { category: 'collectible',effect: 'Limited-run archive stamp.' },
  'morse-card':      { category: 'collectible',effect: 'Reference card from the lab.' },
  // v2.6 (iter-13): campfire — burns down the rest of the current season,
  // catapulting the player into the next one. Single-use consumable.
  'campfire':        { category: 'consumable', effect: 'Sleep through the rest of the season.' }
};

function classifyItem(name) {
  if (ITEM_META[name]) return ITEM_META[name];
  if (/potion|elixir/i.test(name)) return { category: 'consumable', effect: 'Restores something.' };
  if (/key|shard|fragment/i.test(name)) return { category: 'key', effect: 'A key-like item.' };
  if (/torch|sword|armor|detector/i.test(name)) return { category: 'equipment', effect: 'Usable equipment.' };
  return { category: 'collectible', effect: 'A keepsake.' };
}

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

// v2.5 (iter-10): meta commands are prefixed with ":" so they never collide
// with in-world commands a quest author might add. The plain forms keep
// working too — the colon is just an explicit "this is a CLI thing" hint.
const META_COMMANDS = new Set([
  'help', 'save', 'load', 'saves', 'theme', 'lang', 'version',
  'exit', 'quit', 'reboot', 'history', 'alias', 'unalias',
  'complete', 'replay', 'communityquests', 'community-quests',
  'achievements', 'quests', 'status',
  // v2.6 (iter-13): :dev <sub> is the canonical form for developer-only
  // sub-commands. Listing it here suppresses the soft "colon is for meta"
  // warning so `:dev wait-season` runs cleanly.
  'dev'
]);

class CommandSystem {
  constructor(game) {
    this.game = game;
    // Seed in-memory history from the persisted commandHistory so up-arrow
    // works across sessions (per save slot).
    const persisted = (game && game.gameState && Array.isArray(game.gameState.commandHistory))
      ? game.gameState.commandHistory.slice(-200)
      : [];
    this.history = persisted;
    this.historyIndex = this.history.length;
  }

  async execute(input) {
    if (typeof input !== 'string') return;
    // Drop NUL bytes + C0/C1 controls except tab — defend against accidental
    // binary paste from clipboard managers and pty muxers.
    // eslint-disable-next-line no-control-regex
    input = input.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
    input = input.trim();
    if (!input) return;
    // Guard against runaway pastes (e.g. someone pipes a file into stdin).
    if (input.length > 1000) {
      console.log(colors.warning(`input truncated to 1000 chars (was ${input.length})`));
      input = input.slice(0, 1000);
    }

    // v2.5 (iter-10): meta-command prefix. ":theme dark" is identical to
    // "theme dark" but flags the intent so contributors writing community
    // quests don't accidentally shadow these names. Unknown meta names are
    // softly warned about (we still try to dispatch).
    let metaPrefixed = false;
    if (input.startsWith(':')) {
      metaPrefixed = true;
      input = input.slice(1).trimStart();
      if (!input) return;
    }

    // history substitution: !! and !<n>
    if (input === '!!') {
      const last = this.history[this.history.length - 1];
      if (!last) { console.log(colors.error('no history')); return; }
      console.log(colors.dim('! ' + last));
      input = last;
    } else {
      const m = input.match(/^!(\d+)$/);
      if (m) {
        const idx = parseInt(m[1], 10) - 1;
        const entry = this.history[idx];
        if (!entry) { console.log(colors.error(`history: !${idx + 1}: event not found`)); return; }
        console.log(colors.dim('! ' + entry));
        input = entry;
      }
    }

    this.history.push(input);
    // cap history to 200 entries in memory, 50 in save file (trim later)
    if (this.history.length > 200) this.history = this.history.slice(-200);
    this.historyIndex = this.history.length;

    // keep persisted rolling history <= 50
    const ps = this.game.gameState;
    if (!Array.isArray(ps.commandHistory)) ps.commandHistory = [];
    ps.commandHistory.push(input);
    if (ps.commandHistory.length > 50) ps.commandHistory = ps.commandHistory.slice(-50);
    ps.sessionCommands = (ps.sessionCommands || 0) + 1;

    // alias expansion: look up the first token only, replace with alias
    // value. Cycles (a=b, b=a) are capped at 8 rewrites so a hand-crafted
    // save file cannot lock the REPL in an infinite loop.
    const aliases = ps.aliases || {};
    const seenAliases = new Set();
    for (let i = 0; i < 8; i++) {
      const fs2 = input.indexOf(' ');
      const head = fs2 === -1 ? input : input.slice(0, fs2);
      if (!aliases[head] || seenAliases.has(head)) break;
      seenAliases.add(head);
      const tail = fs2 === -1 ? '' : input.slice(fs2);
      input = aliases[head] + tail;
    }

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
      admin: () => this.cmdEasterEgg('admin'),

      // v2.1 - new commands
      alias: () => this.cmdAlias(args),
      unalias: () => this.cmdUnalias(args),
      history: () => this.cmdHistory(),
      complete: () => this.cmdComplete(args),
      wait: () => this.cmdWait(args),
      sleep: () => this.cmdWait(args),
      look: () => this.cmdLook(),
      share: () => this.cmdShare(args),
      time: () => this.cmdTime(),
      // v2.4 additions
      replay: () => this.cmdReplay(args),
      communityquests: () => this.cmdCommunityQuests(),
      'community-quests': () => this.cmdCommunityQuests(),
      // v2.6 (iter-12) additions
      gift: () => this.cmdGift(args),
      bookmark: () => this.cmdBookmark(args),
      bookmarks: () => this.cmdBookmarks(),
      goto: () => this.cmdGoto(args),
      season: () => this.cmdSeason(),
      affinity: () => this.cmdAffinity(args),
      '?': () => this.cmdCheatSheet(),
      // v2.6 (iter-13) developer-only sub-commands. Gated inside cmdDev so
      // production sessions print a friendly "dev mode only" message and
      // refuse to mutate state.
      dev: () => this.cmdDev(args),
      // v2.7 (iter-14) additions
      top: () => this.cmdTop(args),
      leaderboard: () => this.cmdTop(args),
      report: () => this.cmdReport(args)
    };

    // v2.4: record the command into the replay buffer if present
    if (this.game.replay && typeof this.game.replay.record === 'function') {
      this.game.replay.record('command', input);
    }

    if (metaPrefixed && !META_COMMANDS.has(cmd) && commands[cmd]) {
      // Soft note: still run the command, but tell the user the colon is
      // reserved for meta things so they can recalibrate next time.
      console.log(colors.dim(`note: ":" is for meta commands; "${cmd}" runs as a regular command.`));
    }

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

    // -------- gate checks (run BEFORE mutating currentPath) --------
    // level gate: shadow realm
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
    }
    // level gate: nexus
    if (targetPath === '/world/nexus' && this.game.gameState.level < 3) {
      console.log(colors.error(t('cd.locked.level', {
        area: '/world/nexus',
        need: 3,
        have: this.game.gameState.level
      })));
      return;
    }
    // phase-based access (lab/archive). Must run before path mutation
    // so a denied access never leaks turn/visit side effects.
    const phase = this.game.getPhase();
    const rule = timeMod.accessRule(targetPath, phase);
    if (!rule.allowed) {
      console.log(colors.error(rule.reason));
      console.log(colors.dim('  tip: try `wait` to advance the day/night cycle.'));
      return;
    }

    // -------- all gates passed; commit the move --------
    if (targetPath === '/shadow/realm' || targetPath.startsWith('/shadow/realm/')) {
      if (!this.game.gameState.achievements.includes('shadow_walker')) {
        this.game.unlockAchievement('shadow_walker').catch(() => {});
      }
    }

    this.game.currentPath = targetPath;
    this.game.updatePrompt();

    if (!this.game.gameState.visitedDirs.includes(targetPath)) {
      this.game.gameState.visitedDirs.push(targetPath);
    }
    // exploration advances time
    this.game.advanceTime(1);
    this.game.evaluateAutoAchievements().catch(() => {});

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

    // v2.6 (iter-13): generic file-driven item pickup. Any file with a
    // `givesItem` field grants that item the first time it is read. This
    // lets quest reward items also exist in the world as findable loot.
    if (file.givesItem && typeof file.givesItem === 'string') {
      if (!Array.isArray(this.game.gameState.inventory)) this.game.gameState.inventory = [];
      const inv = this.game.gameState.inventory;
      if (!inv.includes(file.givesItem)) {
        inv.push(file.givesItem);
        console.log(colors.gold(`[obtained: ${file.givesItem}]`));
      }
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
      console.log(colors.error('Usage: run <snake|guess|matrix|pong|wordle|qte|logic|morse|chess|cipher|sokobax|sliding|connect3>'));
      return;
    }
    const name = args[0].toLowerCase();
    const aliasMap = {
      logic: 'logicPuzzle',
      chess: 'chessPuzzle',
      cipher: 'cipherDecoder',
      'chess-puzzle': 'chessPuzzle',
      'cipher-decoder': 'cipherDecoder',
      // iter-12
      sliding: 'slidingPuzzle',
      'sliding-puzzle': 'slidingPuzzle',
      'connect-3': 'connect3',
      connect3: 'connect3',
      sokoban: 'sokobax'
    };
    const fnName = aliasMap[name] || name;
    const valid = ['snake', 'guess', 'matrix', 'pong', 'wordle', 'qte', 'logicPuzzle', 'morse', 'chessPuzzle', 'cipherDecoder', 'sokobax', 'slidingPuzzle', 'connect3'];
    if (!valid.includes(fnName)) {
      console.log(colors.error(`run: ${name}: game not found`));
      return;
    }

    // Pause the outer readline so minigames own stdin cleanly
    const rl = this.game.rl;
    if (rl) rl.pause();

    let result;
    try {
      result = await minigames[fnName](this.game);
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
    if (inv.length === 0) {
      console.log(colors.dim('-'.repeat(60)));
      console.log(colors.dim(t('inv.empty')));
      console.log();
      return;
    }

    // group by category
    const groups = { consumable: [], equipment: [], key: [], collectible: [] };
    for (const it of inv) {
      const meta = classifyItem(it);
      const cat = groups[meta.category] ? meta.category : 'collectible';
      groups[cat].push({ name: it, effect: meta.effect });
    }

    const labels = {
      consumable:  '消耗品 / Consumables',
      equipment:   '装备   / Equipment',
      key:         '关键物 / Key Items',
      collectible: '收藏   / Collectibles'
    };

    const catWidth = 14;
    const nameWidth = 22;
    const effectWidth = 34;
    const border = '+' + '-'.repeat(catWidth + 2) + '+' + '-'.repeat(nameWidth + 2) + '+' + '-'.repeat(effectWidth + 2) + '+';

    console.log(border);
    console.log(
      '| ' + padVisual(colors.bold('Category'), catWidth) +
      ' | ' + padVisual(colors.bold('Item'), nameWidth) +
      ' | ' + padVisual(colors.bold('Effect'), effectWidth) + ' |'
    );
    console.log(border);
    let any = false;
    for (const [cat, items] of Object.entries(groups)) {
      if (items.length === 0) continue;
      any = true;
      items.forEach((entry, i) => {
        const catCell = i === 0 ? labels[cat] : '';
        const colorFn = cat === 'key' ? colors.gold
          : cat === 'equipment' ? colors.primary
          : cat === 'consumable' ? colors.success
          : colors.accent;
        console.log(
          '| ' + padVisual(colors.dim(catCell), catWidth) +
          ' | ' + padVisual(colorFn(entry.name), nameWidth) +
          ' | ' + padVisual(colors.dim(entry.effect), effectWidth) + ' |'
        );
      });
      console.log(border);
    }
    if (!any) console.log(colors.dim(t('inv.empty')));
    console.log(colors.dim('  tip: type "use <item>" from this list to use it.'));
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
    const meta = classifyItem(itemName);
    if (itemName === 'abyss-gazer-eye') {
      console.log(colors.purple('vision sharpened - hidden items now visible'));
      this.game.gameState.scanMode = true;
    } else if (itemName === 'campfire') {
      // v2.6 (iter-13): skip the rest of the current season in one turn.
      const before = Number(this.game.gameState.turn) || 0;
      const beforeSeason = seasonMod.getSeason(before);
      const dayInto = seasonMod.dayOfSeason(before);
      const turnsLeft = (seasonMod.SEASON_LENGTH - dayInto) + 1;
      this.game.advanceTime(turnsLeft);
      const after = Number(this.game.gameState.turn) || 0;
      const afterSeason = seasonMod.getSeason(after);
      const idx = inv.indexOf(itemName);
      if (idx >= 0) inv.splice(idx, 1);
      console.log(colors.gold(`you light the campfire and let it burn down through the season.`));
      console.log(colors.dim(`  ${beforeSeason.icon} ${beforeSeason.label}  ->  ${afterSeason.icon} ${afterSeason.label}  (+${turnsLeft} turns)`));
    } else if (meta.category === 'consumable') {
      const idx = inv.indexOf(itemName);
      if (idx >= 0) inv.splice(idx, 1);
      console.log(colors.success('you feel briefly better. (consumable used)'));
    } else if (meta.category === 'equipment') {
      console.log(colors.primary(`${itemName} equipped. ${meta.effect}`));
    } else if (meta.category === 'key') {
      console.log(colors.gold(`${itemName} hums faintly.`));
    } else {
      console.log(colors.dim('you turn it over in your hand - nothing else happens.'));
    }
  }

  async cmdTalk(args) {
    if (args.length === 0) {
      console.log(colors.error('Usage: talk <npc> [choice-id]'));
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
    const choiceId = (args[1] || '').toLowerCase();
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

    // v2.6 (iter-12): some NPCs are seasonally unavailable.
    const season = seasonMod.getSeason(this.game.gameState.turn || 0);
    const avail = seasonMod.npcAvailable(npcName, season);
    if (!avail.open) {
      console.log(colors.warning(avail.reason));
      return;
    }

    // Record talk for affinity (capped) and pull npc-specific mood.
    relMod.recordTalk(this.game.gameState, npcName);
    const npcMoodLabel = relMod.moodFor(this.game.gameState, npcName);
    // Map our 5 affinity moods to the 3 dialog mood blocks the data uses.
    const mood = (npcMoodLabel === 'adoring' || npcMoodLabel === 'friendly') ? 'friendly'
      : (npcMoodLabel === 'cold' || npcMoodLabel === 'hostile') ? 'hostile'
      : this.game.getNpcMood();
    const moodBlock = (npc.moods && npc.moods[mood]) || null;
    const greetLine = (moodBlock && moodBlock.greeting) || npc.dialogs.greeting;

    console.log();
    const aff = relMod.getAffinity(this.game.gameState, npcName);
    console.log(colors.accent(`${npc.icon} ${npc.name}`) + colors.dim(`  (${mood}, affinity ${aff >= 0 ? '+' : ''}${aff})`));
    console.log(colors.info(`  "${greetLine}"`));

    // High-affinity special line + one-time gift
    const special = relMod.specialDialog(this.game.gameState, npcName);
    if (special) {
      console.log(colors.gold(`  "${special}"`));
    }
    const grant = relMod.specialItem(this.game.gameState, npcName);
    if (grant) {
      const inv = this.game.gameState.inventory || [];
      if (!inv.includes(grant)) inv.push(grant);
      console.log(colors.gold(`  [received: ${grant}]`));
    }

    if (!this.game.gameState.npcMoodsSeen) this.game.gameState.npcMoodsSeen = [];
    if (!this.game.gameState.npcMoodsSeen.includes(mood)) {
      this.game.gameState.npcMoodsSeen.push(mood);
    }

    // branching choice handling
    if (Array.isArray(npc.choices) && npc.choices.length > 0) {
      if (!choiceId) {
        console.log();
        console.log(colors.dim('  choose a response:'));
        npc.choices.forEach((c, i) => {
          const sign = c.alignment > 0 ? colors.success('+' + c.alignment)
                     : c.alignment < 0 ? colors.error(String(c.alignment))
                     : colors.dim('0');
          console.log(`    ${colors.primary(c.id)}  [${sign}]  ${c.text}`);
        });
        console.log(colors.dim(`  example: talk ${npcName} ${npc.choices[0].id}`));
      } else {
        const choice = npc.choices.find((c) => c.id === choiceId);
        if (!choice) {
          console.log(colors.error(`unknown choice: ${choiceId}`));
        } else {
          this.game.adjustAlignment(choice.alignment);
          console.log(colors.info(`  "${choice.reply}"`));
          console.log(colors.dim(`  alignment: ${this.game.gameState.alignment >= 0 ? '+' : ''}${this.game.gameState.alignment}`));
          await this.game.evaluateAutoAchievements();
        }
      }
    }

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

    const groups = groupByCategory(this.game.achievements);
    const order = ['exploration', 'puzzle', 'combat', 'collection', 'speedrun', 'hidden', 'general'];
    let done = 0, total = 0;

    for (const cat of order) {
      const list = groups[cat];
      if (!list || list.length === 0) continue;
      console.log(colors.bold(`  [${cat}]`));
      for (const ach of list) {
        total++;
        if (ach.unlocked) done++;
        const status = ach.unlocked ? colors.success('[x]') : colors.dim('[ ]');
        const colorFn = ach.unlocked ? colors.primary : colors.dim;
        const reward = ach.reward ? colors.gold(` ${ach.reward}`) : '';
        console.log(`  ${status} ${colorFn(ach.icon + ' ' + ach.name)}${reward}`);
        console.log(colors.dim(`       ${ach.desc}`));
      }
    }
    // catch any achievements without a known category bucket
    for (const [cat, list] of Object.entries(groups)) {
      if (order.includes(cat)) continue;
      console.log(colors.bold(`  [${cat}]`));
      for (const ach of list) {
        total++;
        if (ach.unlocked) done++;
        const status = ach.unlocked ? colors.success('[x]') : colors.dim('[ ]');
        const colorFn = ach.unlocked ? colors.primary : colors.dim;
        console.log(`  ${status} ${colorFn(ach.icon + ' ' + ach.name)}`);
      }
    }
    console.log(colors.dim('-'.repeat(50)));
    console.log(t('ach.progress', { done, total }));
    if (done >= total - 1 && this.game.achievements.completionist && !this.game.achievements.completionist.unlocked) {
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
      const { EXTRA_ACHIEVEMENTS } = require('./achievements');
      this.game.achievements = JSON.parse(
        JSON.stringify({ ...ACHIEVEMENTS, ...EXTRA_ACHIEVEMENTS })
      );
      // JSON round-trip drops functions; re-attach the auto-unlock checkers.
      for (const [id, src] of Object.entries(EXTRA_ACHIEVEMENTS)) {
        if (this.game.achievements[id] && typeof src.check === 'function') {
          this.game.achievements[id].check = src.check;
        }
      }
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
    // v2.7: track unique locales for the Polyglot achievement.
    if (!Array.isArray(this.game.gameState.localesUsed)) {
      this.game.gameState.localesUsed = [];
    }
    if (!this.game.gameState.localesUsed.includes(code)) {
      this.game.gameState.localesUsed.push(code);
    }
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
    if (pattern.length > 200) {
      console.log(colors.error('grep: pattern too long (max 200 chars)'));
      return;
    }
    const file = this.game.resolvePath(filename);
    if (!file || file.type !== 'file') {
      console.log(colors.error(`grep: ${filename}: not found`));
      return;
    }
    const lines = (file.content || '').split('\n');
    let found = false;
    // Always escape user input — we never accept raw regex from the
    // player, preventing pathological ReDoS inputs like `(a+)+`.
    const needle = pattern.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        console.log(`${colors.dim(i + 1 + ':')} ${lines[i]}`);
        found = true;
      }
    }
    if (!found) console.log(colors.dim('no matches'));
  }

  cmdFind(args) {
    // v2.5 (iter-9): an empty pattern used to dump the entire 77-entry tree.
    // Reject it explicitly — players who want a tree have `tree`.
    if (!args[0] || !String(args[0]).trim()) {
      console.log(colors.error('Usage: find <pattern>'));
      console.log(colors.dim('  tip: use `tree` to walk the current directory.'));
      return;
    }
    const pattern = String(args[0]).slice(0, 200);
    const needle = pattern.toLowerCase();
    const results = [];
    const walk = (dir, path) => {
      if (!dir.children) return;
      for (const [name, item] of Object.entries(dir.children)) {
        const full = path + '/' + name;
        if (name.toLowerCase().includes(needle)) {
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

  // ---- v2.1 new commands ----
  cmdAlias(args) {
    const gs = this.game.gameState;
    if (!gs.aliases) gs.aliases = {};
    if (args.length === 0) {
      console.log();
      console.log(colors.bold('Aliases'));
      console.log(colors.dim('-'.repeat(40)));
      const keys = Object.keys(gs.aliases).sort();
      if (keys.length === 0) console.log(colors.dim('  (none)'));
      for (const k of keys) console.log(`  ${colors.primary(k)} = ${colors.dim(gs.aliases[k])}`);
      console.log();
      return;
    }
    const raw = args.join(' ');
    const eq = raw.indexOf('=');
    if (eq === -1) {
      console.log(colors.error('Usage: alias name=value  (or: alias to list)'));
      return;
    }
    const name = raw.slice(0, eq).trim();
    let value = raw.slice(eq + 1).trim();
    if (!name) { console.log(colors.error('alias: empty name')); return; }
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!value) { console.log(colors.error('alias: empty value')); return; }
    gs.aliases[name] = value;
    console.log(colors.success(`alias ${name} = "${value}"`));
  }

  cmdUnalias(args) {
    const gs = this.game.gameState;
    if (!gs.aliases) gs.aliases = {};
    if (args.length === 0) { console.log(colors.error('Usage: unalias <name>')); return; }
    for (const name of args) {
      if (gs.aliases[name]) {
        delete gs.aliases[name];
        console.log(colors.success(`removed alias ${name}`));
      } else {
        console.log(colors.dim(`no alias: ${name}`));
      }
    }
  }

  cmdHistory() {
    // v2.7: gate for the Silent Runner achievement. Once true, never resets.
    this.game.gameState.historyOpened = true;
    const h = this.game.gameState.commandHistory || [];
    console.log();
    console.log(colors.bold('History (last 50)'));
    console.log(colors.dim('-'.repeat(40)));
    if (h.length === 0) console.log(colors.dim('  (empty)'));
    else h.forEach((line, i) => {
      console.log('  ' + colors.dim(String(i + 1).padStart(3)) + '  ' + line);
    });
    console.log();
    console.log(colors.dim('  run: !!  or  !<n>  to repeat an entry'));
    console.log();
  }

  // Tab-complete helper. Exposed as `complete <prefix>` so tests can exercise it,
  // and also wired into readline later.
  cmdComplete(args) {
    const prefix = (args[0] || '').toLowerCase();
    const hits = this.completionsFor(prefix);
    if (hits.length === 0) console.log(colors.dim('(no matches)'));
    else {
      console.log(colors.dim(`matches (${hits.length}):`));
      for (const h of hits) console.log('  ' + h);
    }
  }

  completionsFor(prefix, context) {
    // context: { verb: 'talk'|'use'|'gift'|'goto'|'bookmark', argIndex: number }
    // When provided, restrict completions to context-relevant tokens.
    const out = new Set();
    if (context && context.verb) {
      const verb = context.verb;
      const dir = this.game.resolvePath('.');
      if (verb === 'talk') {
        if (dir && dir.children) {
          for (const [name, item] of Object.entries(dir.children)) {
            if (item && item.npc) {
              const id = name.replace('.npc', '');
              if (id.toLowerCase().startsWith(prefix)) out.add(id);
            }
          }
        }
        return Array.from(out).sort();
      }
      if (verb === 'use' || verb === 'gift') {
        const inv = (this.game.gameState && this.game.gameState.inventory) || [];
        for (const item of inv) {
          if (item.toLowerCase().startsWith(prefix)) out.add(item);
        }
        return Array.from(out).sort();
      }
      if (verb === 'goto' || verb === 'bookmark') {
        const bm = (this.game.gameState && this.game.gameState.bookmarks) || {};
        for (const k of Object.keys(bm)) {
          if (k.toLowerCase().startsWith(prefix)) out.add(k);
        }
        return Array.from(out).sort();
      }
    }
    const known = [
      'help','ls','cd','cat','pwd','clear','tree','exit','quit','reboot',
      'find','grep','scan','decode','analyze','hack','run','matrix',
      'status','inventory','inv','use','talk','map','quests','achievements',
      'unlock','hint','save','load','saves','theme','lang','version',
      'whoami','date','echo','sudo','alias','unalias','history','complete',
      'wait','sleep','look','share','time',
      'replay','communityquests',
      // iter-12
      'gift','bookmark','bookmarks','goto','season','affinity','?'
    ];
    for (const c of known) if (c.startsWith(prefix)) out.add(c);
    // aliases
    const aliases = (this.game && this.game.gameState && this.game.gameState.aliases) || {};
    for (const k of Object.keys(aliases)) if (k.startsWith(prefix)) out.add(k);
    // interactive objects in current dir
    const dir = this.game.resolvePath('.');
    if (dir && dir.children) {
      for (const name of Object.keys(dir.children)) {
        if (name.toLowerCase().startsWith(prefix)) out.add(name);
      }
    }
    return Array.from(out).sort();
  }

  async cmdWait(args) {
    const requested = parseInt(args[0] || '1', 10) || 1;
    const n = Math.max(1, Math.min(24, requested));
    if (requested > n) {
      // v2.5 (iter-10): tell the player we capped them so a `wait 999999`
      // does not look like the command silently no-op'd.
      console.warn(colors.warning(
        `wait: capped to ${n} turn(s) per call (asked for ${requested}). ` +
        `run \`wait\` again to keep advancing time.`
      ));
    }
    const res = this.game.advanceTime(n);
    console.log(colors.dim(`time advances by ${n} turn(s) - now ${timeMod.formatClock(res.turn)} (${res.phase.name})`));
    for (const p of res.newPhases) {
      console.log(colors.info(`  phase change: ${p.icon} ${p.label}`));
    }
    await this.game.evaluateAutoAchievements();
  }

  cmdLook() {
    const dir = this.game.resolvePath('.');
    const phase = this.game.getPhase();
    console.log();
    console.log(colors.bold(`you are at ${this.game.currentPath}`));
    console.log(colors.dim(`  phase: ${phase.icon} ${phase.label}  clock: ${timeMod.formatClock(this.game.gameState.turn || 0)}`));
    if (dir && dir.children) {
      const npcs = Object.keys(dir.children).filter((n) => dir.children[n].npc);
      const files = Object.keys(dir.children).filter((n) => dir.children[n].type === 'file' && !dir.children[n].hidden);
      const dirs = Object.keys(dir.children).filter((n) => dir.children[n].type === 'dir' && !dir.children[n].hidden);
      if (npcs.length) console.log(colors.accent('  NPCs here: ') + npcs.join(', '));
      if (files.length) console.log(colors.dim('  files:  ') + files.slice(0, 6).join(', ') + (files.length > 6 ? ', ...' : ''));
      if (dirs.length) console.log(colors.dim('  paths:  ') + dirs.join(', '));
    }
    console.log();
    // looking around takes 1 turn
    this.game.advanceTime(1);
  }

  cmdTime() {
    const phase = this.game.getPhase();
    const clock = timeMod.formatClock(this.game.gameState.turn || 0);
    console.log();
    console.log(colors.bold('in-game clock'));
    console.log(`  time:   ${clock}`);
    console.log(`  phase:  ${phase.icon} ${phase.label}`);
    console.log(`  turn:   ${this.game.gameState.turn || 0}`);
    const seen = this.game.gameState.phasesSeen || [];
    console.log(colors.dim(`  phases seen this playthrough: ${seen.join(', ') || '(none)'}`));
    console.log();
  }

  async cmdShare(args) {
    const handle = args[0];
    const pkg = require('../package.json');
    const { LEVELS: LVL } = require('./data');
    const title = (LVL[this.game.gameState.level] || {}).title || '';
    const out = shareMod.generate(this.game, { handle, title });
    console.log();
    console.log(colors.dim(`share card saved: ${out.file}`));
    console.log();
    console.log(out.card);
    console.log();
    console.log(colors.dim(`v${pkg.version}  -  copy and paste the box above anywhere!`));
    console.log();
    await this.game.evaluateAutoAchievements();
  }

  async cmdReplay(args) {
    const saveMod2 = require('./save');
    const { loadReplayFromSlot, playReplay } = require('./replay');
    const slot = (args[0] || this.game.slot || saveMod2.DEFAULT_SLOT).trim();
    let events;
    if (slot === this.game.slot) {
      events = this.game.gameState.replay || [];
    } else {
      events = loadReplayFromSlot(slot, saveMod2);
      if (events === null) {
        console.log(colors.error(`replay: slot not found: ${slot}`));
        return;
      }
    }
    console.log(colors.dim(`replaying slot "${slot}" (${events.length} events)`));
    await playReplay(events, {
      delay: 20,
      write: (line) => console.log(colors.dim(line))
    });
  }

  cmdCommunityQuests() {
    const list = this.game.communityQuests || [];
    console.log();
    console.log(colors.bold(`Community quests (${list.length})`));
    console.log(colors.dim('-'.repeat(50)));
    if (list.length === 0) {
      console.log(colors.dim('(no quests loaded from ./quests/)'));
      console.log();
      return;
    }
    const questsMod = require('./quests');
    for (const q of list) {
      const res = questsMod.evaluateQuest(q, this.game.gameState);
      const badge = res.done ? colors.success('[x]') : colors.warning(`[${res.completed}/${res.total}]`);
      console.log(`${badge} ${colors.primary(q.id)}  ${q.title}`);
      if (q.author) console.log(colors.dim(`     by ${q.author}`));
      if (!res.done && res.activeStep) {
        console.log(colors.dim(`     next: ${res.activeStep.description}`));
      }
      if (res.done && res.currentBranch && q.branches && q.branches[res.currentBranch]) {
        console.log(colors.dim(`     ending: ${q.branches[res.currentBranch].text}`));
      }
    }
    console.log();
  }

  // ---- v2.6 (iter-12) commands ----
  cmdCheatSheet() {
    console.log();
    console.log(colors.bold('quick reference (?)'));
    console.log(colors.dim('-'.repeat(50)));
    const rows = [
      ['ls / cd / cat / tree', 'walk the world'],
      ['scan / decode / hack', 'reveal hidden things'],
      ['run <game>',           'play a minigame (try `run sokobax`)'],
      ['talk <npc> [choice]',  'speak with an NPC'],
      ['gift <item> to <npc>', 'raise affinity'],
      ['bookmark <name>',      'save current path as bookmark'],
      ['goto <name>',          'jump to a bookmark (1 turn)'],
      ['bookmarks',            'list saved bookmarks'],
      ['use <item>',           'use an inventory item'],
      ['quests / achievements','review progress'],
      ['status / inv',         'see character + inventory'],
      ['wait <n>',             'spend turns (advances time/season)'],
      ['season / time',        'check world clock + season'],
      ['hint / help',          'get unstuck'],
      ['save / load <slot>',   'manage save slots'],
      ['theme / lang / share', 'meta + share card']
    ];
    for (const [c, d] of rows) {
      console.log('  ' + colors.primary(c.padEnd(22)) + colors.dim(d));
    }
    console.log();
  }

  cmdSeason() {
    const turn = this.game.gameState.turn || 0;
    const season = seasonMod.getSeason(turn);
    const day = seasonMod.dayOfSeason(turn);
    const year = seasonMod.yearOf(turn);
    console.log();
    console.log(colors.bold('Season'));
    console.log(`  current:  ${season.icon} ${season.label}`);
    console.log(`  day:      ${day}/${seasonMod.SEASON_LENGTH}`);
    console.log(`  year:     ${year + 1}`);
    const seen = this.game.gameState.seasonsSeen || [];
    console.log(colors.dim(`  seen this run: ${seen.join(', ') || '(none)'}`));
    console.log();
  }

  // v2.6 (iter-13): developer-only sub-commands. Only active when the game
  // was started with --dev. The first arg is the sub-command name. We keep
  // this surface deliberately small so the player-visible CLI stays clean.
  cmdDev(args) {
    if (!this.game.options || !this.game.options.dev) {
      console.log(colors.error('dev: this command is only available in --dev mode'));
      console.log(colors.dim('  start the game with: terminal-quest --dev'));
      return;
    }
    const sub = (args[0] || '').toLowerCase();
    if (!sub) {
      console.log(colors.bold('dev sub-commands'));
      console.log('  :dev wait-season    advance time to the next season boundary');
      console.log('  :dev help           show this list');
      return;
    }
    if (sub === 'help') {
      console.log(colors.bold('dev sub-commands'));
      console.log('  :dev wait-season    advance time to the next season boundary');
      return;
    }
    if (sub === 'wait-season') {
      const before = Number(this.game.gameState.turn) || 0;
      const beforeSeason = seasonMod.getSeason(before);
      const dayInto = seasonMod.dayOfSeason(before);
      // turns left in current season (dayOfSeason is 1-based)
      const turnsLeft = (seasonMod.SEASON_LENGTH - dayInto) + 1;
      this.game.advanceTime(turnsLeft);
      const after = Number(this.game.gameState.turn) || 0;
      const afterSeason = seasonMod.getSeason(after);
      console.log();
      console.log(colors.success(`[dev] advanced ${turnsLeft} turn(s)`));
      console.log(`  ${beforeSeason.icon} ${beforeSeason.label}  ->  ${afterSeason.icon} ${afterSeason.label}`);
      console.log(colors.dim(`  turn: ${before} -> ${after}`));
      console.log();
      return;
    }
    console.log(colors.error(`dev: unknown sub-command "${sub}"`));
    console.log(colors.dim('  try: :dev help'));
  }

  async cmdGift(args) {
    // syntax: gift <item> to <npc>     OR     gift <item> <npc>
    if (args.length < 2) {
      console.log(colors.error('Usage: gift <item> to <npc>'));
      return;
    }
    let toIdx = -1;
    for (let i = 0; i < args.length; i++) {
      if (args[i].toLowerCase() === 'to') { toIdx = i; break; }
    }
    let item, npcId;
    if (toIdx > 0 && toIdx < args.length - 1) {
      item = args.slice(0, toIdx).join(' ');
      npcId = args.slice(toIdx + 1).join(' ').toLowerCase();
    } else {
      // last token is npc, rest is item
      npcId = args[args.length - 1].toLowerCase();
      item = args.slice(0, -1).join(' ');
    }

    const inv = this.game.gameState.inventory || [];
    if (!inv.includes(item)) {
      console.log(colors.error(`gift: you don't have "${item}"`));
      return;
    }
    if (!NPCS[npcId]) {
      console.log(colors.error(`gift: unknown NPC "${npcId}"`));
      return;
    }
    // Must be co-located with the NPC.
    const dir = this.game.resolvePath('.');
    const npcHere = dir && dir.children && Object.keys(dir.children)
      .some((n) => n.toLowerCase().includes(npcId) && dir.children[n].npc);
    if (!npcHere) {
      console.log(colors.error(`gift: ${NPCS[npcId].name} is not here`));
      return;
    }
    // Apply.
    const res = relMod.giveGift(this.game.gameState, npcId, item);
    if (!res.ok) {
      console.log(colors.error('gift failed'));
      return;
    }
    // Remove the item from inventory.
    const idx = inv.indexOf(item);
    if (idx >= 0) inv.splice(idx, 1);
    const sign = res.delta >= 0 ? colors.success(`+${res.delta}`) : colors.error(`${res.delta}`);
    console.log();
    console.log(`${colors.accent(NPCS[npcId].icon + ' ' + NPCS[npcId].name)}: "${res.ack}"`);
    console.log(colors.dim(`  affinity ${sign} -> ${res.affinity}  (mood: ${relMod.moodFor(this.game.gameState, npcId)})`));

    // Maybe grant a special item if newly adoring.
    const grant = relMod.specialItem(this.game.gameState, npcId);
    if (grant) {
      if (!inv.includes(grant)) inv.push(grant);
      console.log(colors.gold(`  [received: ${grant}]`));
    }
    console.log();
    await this.game.evaluateAutoAchievements();
    // v2.6 (iter-13): a gift can satisfy quest triggers (affinity / hasItem
    // changes). The dispatcher already calls checkQuests after every command,
    // but we also call it explicitly here as a belt-and-braces measure so
    // the quest log updates immediately even if a future caller bypasses
    // the central dispatch.
    if (typeof this.game.checkQuests === 'function') {
      this.game.checkQuests();
    }
  }

  cmdAffinity(args) {
    const map = this.game.gameState.npcAffinity || {};
    if (args[0]) {
      const id = args[0].toLowerCase();
      const v = relMod.getAffinity(this.game.gameState, id);
      const m = relMod.moodFor(this.game.gameState, id);
      console.log(`  ${id}: ${v}  (${m})`);
      return;
    }
    console.log();
    console.log(colors.bold('NPC affinity'));
    console.log(colors.dim('-'.repeat(40)));
    const ids = Object.keys(NPCS);
    for (const id of ids) {
      const v = relMod.getAffinity(this.game.gameState, id);
      const m = relMod.moodFor(this.game.gameState, id);
      const bar = v >= 0
        ? colors.success('+'.repeat(Math.min(10, Math.floor(v / 10))))
        : colors.error('-'.repeat(Math.min(10, Math.floor(Math.abs(v) / 10))));
      console.log(`  ${id.padEnd(12)} ${String(v).padStart(4)}  ${m.padEnd(9)} ${bar}`);
    }
    console.log();
  }

  cmdBookmark(args) {
    const name = (args[0] || '').trim();
    if (!name) {
      console.log(colors.error('Usage: bookmark <name>'));
      return;
    }
    if (!/^[a-zA-Z0-9_\-]{1,32}$/.test(name)) {
      console.log(colors.error('bookmark: name must be 1-32 chars [a-z0-9_-]'));
      return;
    }
    if (!this.game.gameState.bookmarks) this.game.gameState.bookmarks = {};
    this.game.gameState.bookmarks[name] = this.game.currentPath;
    console.log(colors.success(`bookmark "${name}" -> ${this.game.currentPath}`));
  }

  cmdBookmarks() {
    const bm = this.game.gameState.bookmarks || {};
    console.log();
    console.log(colors.bold('Bookmarks'));
    console.log(colors.dim('-'.repeat(40)));
    const keys = Object.keys(bm).sort();
    if (keys.length === 0) {
      console.log(colors.dim('  (none) - try: bookmark home'));
    } else {
      for (const k of keys) {
        console.log(`  ${colors.primary(k.padEnd(20))} ${colors.dim(bm[k])}`);
      }
    }
    console.log();
  }

  cmdGoto(args) {
    const name = (args[0] || '').trim();
    if (!name) {
      console.log(colors.error('Usage: goto <bookmark-name>'));
      return;
    }
    const bm = this.game.gameState.bookmarks || {};
    if (!bm[name]) {
      console.log(colors.error(`goto: no bookmark "${name}"`));
      console.log(colors.dim('  tip: type `bookmarks` to list saved paths.'));
      return;
    }
    const target = bm[name];
    const dir = this.game.getDirByPath(target);
    if (!dir || dir.type !== 'dir') {
      console.log(colors.error(`goto: bookmark target gone: ${target}`));
      return;
    }
    // gating like cd
    const phase = this.game.getPhase();
    const rule = timeMod.accessRule(target, phase);
    if (!rule.allowed) {
      console.log(colors.error(rule.reason));
      return;
    }
    this.game.currentPath = target;
    this.game.updatePrompt();
    if (!this.game.gameState.visitedDirs.includes(target)) {
      this.game.gameState.visitedDirs.push(target);
    }
    // bookmarks burn one turn (still cheaper than re-walking).
    this.game.advanceTime(1);
    console.log(colors.dim(`-> ${target}`));
  }

  // v2.7 (iter-14): leaderboard + Markdown report --------------------------
  cmdTop(args) {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'export') {
      const text = leaderboardMod.exportText();
      console.log();
      console.log(text);
      console.log();
      console.log(colors.dim('  tip: copy the block above to share. ' +
        '`top import < file.txt` will read it back.'));
      return;
    }
    if (sub === 'import') {
      // read from stdin or from `top import <path>`. We default to a
      // heredoc-style: the player runs `top import` and the next read line
      // is the data. To keep the REPL simple we instead require a path arg.
      const filePath = args[1];
      if (!filePath) {
        console.log(colors.error('Usage: top import <file>'));
        return;
      }
      try {
        const fs = require('fs');
        const body = fs.readFileSync(filePath, 'utf8');
        const r = leaderboardMod.importText(body);
        console.log(`imported ${r.imported} entr${r.imported === 1 ? 'y' : 'ies'}, ` +
          `skipped ${r.skipped}.`);
        if (r.errors.length) {
          for (const e of r.errors) console.log(colors.dim('  ! ' + e));
        }
      } catch (e) {
        console.log(colors.error(`top import: cannot read ${filePath}: ${e.message}`));
      }
      return;
    }
    const n = parseInt(args[0], 10);
    const limit = Number.isFinite(n) && n > 0 ? n : leaderboardMod.TOP_N_DEFAULT;
    const entries = leaderboardMod.topN(limit);
    console.log();
    console.log(colors.bold(`Top ${limit} (local saves)`));
    console.log(colors.dim('-'.repeat(70)));
    if (entries.length === 0) {
      console.log(colors.dim('  (no save slots yet — run `save` to create one)'));
      console.log();
      return;
    }
    console.log(colors.dim(
      '  rank  slot              level  exp    ach  quests  playtime  score'));
    entries.forEach((e, i) => {
      const rank = String(i + 1).padStart(4);
      const slot = String(e.slot).padEnd(16);
      const lv = (`Lv.${e.level}`).padEnd(5);
      const exp = String(e.exp).padEnd(6);
      const ach = String(e.achievements).padEnd(3);
      const q = String(e.totalQuests).padEnd(6);
      const pt = leaderboardMod.fmtPlaytime(e.playtimeMs).padEnd(8);
      const score = String(Math.round(e.score)).padStart(6);
      const isMe = e.slot === this.game.slot;
      const line = `  ${rank}  ${slot}  ${lv}  ${exp}  ${ach}  ${q}  ${pt}  ${score}`;
      console.log(isMe ? colors.success(line) : line);
    });
    console.log();
    console.log(colors.dim(
      '  `top export` to share, `top <n>` to widen, `report` for a Markdown writeup.'));
    console.log();
  }

  cmdReport(args) {
    // generate a Markdown war-story report at:
    //   ~/.terminal-quest/reports/<slot>-<ts>.md
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const slotName = (args[0] || this.game.slot || saveMod.DEFAULT_SLOT).trim();
    const reportsDir = path.join(os.homedir(), '.terminal-quest', 'reports');
    try {
      fs.mkdirSync(reportsDir, { recursive: true });
    } catch (e) {
      console.log(colors.error(`report: cannot create ${reportsDir}: ${e.message}`));
      return;
    }
    // Read the slot we want to report on. If it's the current slot we
    // can use the live in-memory state for fully-fresh data; otherwise we
    // load from disk.
    let state, savedAt;
    if (slotName === this.game.slot) {
      state = this.game.gameState;
      savedAt = Date.now();
    } else {
      const payload = saveMod.load(slotName);
      if (!payload || !payload.state) {
        console.log(colors.error(`report: no save found in slot "${slotName}"`));
        return;
      }
      state = payload.state;
      savedAt = payload.savedAt || Date.now();
    }

    const md = buildReportMarkdown(slotName, state, this.game, savedAt);
    const ts = new Date(savedAt).toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const filename = `${slotName}-${ts}.md`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const full = path.join(reportsDir, filename);
    try {
      fs.writeFileSync(full, md);
      console.log();
      console.log(colors.success(`report written: ${full}`));
      console.log(colors.dim(`  ${md.length} bytes  -  Markdown, viewable in any editor.`));
      console.log();
    } catch (e) {
      console.log(colors.error(`report: cannot write ${full}: ${e.message}`));
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

// v2.7 (iter-14) -----------------------------------------------------------
// Plain-text Markdown report. Lives outside the class so the tests can
// import it directly without spinning up a TerminalGame instance.
function buildReportMarkdown(slot, state, game, savedAt) {
  const lines = [];
  const date = new Date(savedAt || Date.now()).toISOString().replace('T', ' ').slice(0, 19);
  const playtimeSec = Math.max(
    0,
    Math.floor((Number(state.playtimeMs || 0) / 1000)),
    Math.floor(((savedAt || Date.now()) - (state.startTime || savedAt || Date.now())) / 1000)
  );
  const h = Math.floor(playtimeSec / 3600);
  const m = Math.floor((playtimeSec % 3600) / 60);
  const playStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

  lines.push(`# Terminal Quest report — slot \`${slot}\``);
  lines.push('');
  lines.push(`*generated ${date}*`);
  lines.push('');
  lines.push('## Snapshot');
  lines.push('');
  lines.push(`- **Level:** ${state.level || 1}`);
  lines.push(`- **EXP:** ${state.exp || 0}`);
  lines.push(`- **Playtime:** ${playStr}`);
  lines.push(`- **Locale:** ${state.locale || 'en'}`);
  lines.push(`- **Theme:** ${state.theme || 'dark'}`);
  lines.push(`- **Alignment:** ${state.alignment || 0} (min seen: ${state.minAlignment || 0})`);
  lines.push('');

  // Achievements
  const achList = Array.isArray(state.achievements) ? state.achievements : [];
  lines.push(`## Achievements (${achList.length})`);
  lines.push('');
  if (achList.length === 0) {
    lines.push('_No achievements unlocked yet._');
  } else {
    // Resolve names from the live game registry if available.
    const reg = (game && game.achievements) || {};
    for (const id of achList) {
      const meta = reg[id];
      if (meta) {
        lines.push(`- ${meta.icon || '*'} **${meta.name}** — ${meta.desc}`);
      } else {
        lines.push(`- ${id}`);
      }
    }
  }
  lines.push('');

  // Quests completed
  lines.push('## Quests completed');
  lines.push('');
  const builtIn = state.questsState
    ? Object.entries(state.questsState).filter(([, q]) => q && q.completed)
    : [];
  if (builtIn.length === 0) {
    lines.push('_No built-in quests completed._');
  } else {
    for (const [id] of builtIn) lines.push(`- built-in: \`${id}\``);
  }
  const community = state.communityQuestState
    ? Object.entries(state.communityQuestState).filter(([, q]) => q && q.done)
    : [];
  if (community.length > 0) {
    for (const [id, q] of community) {
      lines.push(`- community: \`${id}\`${q.branch ? ` (branch: ${q.branch})` : ''}`);
    }
  }
  lines.push('');

  // Footprint (visited dirs)
  const dirs = Array.isArray(state.visitedDirs) ? state.visitedDirs : [];
  lines.push(`## Footprint (${dirs.length} directories visited)`);
  lines.push('');
  if (dirs.length === 0) {
    lines.push('_No directories visited._');
  } else {
    for (const d of dirs.slice(0, 25)) lines.push(`- \`${d}\``);
    if (dirs.length > 25) lines.push(`- ...and ${dirs.length - 25} more`);
  }
  lines.push('');

  // Favourite NPC (highest affinity)
  const npcAff = state.npcAffinity || {};
  const npcEntries = Object.entries(npcAff).sort((a, b) => Number(b[1]) - Number(a[1]));
  lines.push('## Favourite NPC');
  lines.push('');
  if (npcEntries.length === 0) {
    lines.push('_No NPC interactions recorded._');
  } else {
    const [topId, topVal] = npcEntries[0];
    lines.push(`- **${topId}** — affinity ${topVal}`);
    if (npcEntries.length > 1) {
      lines.push('');
      lines.push('Other relationships:');
      for (const [id, v] of npcEntries.slice(1, 6)) {
        lines.push(`- ${id}: ${v}`);
      }
    }
  }
  lines.push('');

  // Inventory
  const inv = Array.isArray(state.inventory) ? state.inventory : [];
  lines.push(`## Inventory (${inv.length})`);
  lines.push('');
  if (inv.length === 0) {
    lines.push('_Empty._');
  } else {
    for (const it of inv) lines.push(`- \`${it}\``);
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('*Generated by `terminal-quest report` (v2.7).*');
  lines.push('');
  return lines.join('\n');
}

module.exports = { CommandSystem, tokenize, buildReportMarkdown };
