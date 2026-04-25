/**
 * @module i18n
 * @description Lightweight bilingual locale system (en / zh).
 *
 * Strings live in nested DICTS keyed by short dot-paths (e.g. `cmd.unknown`).
 * `t(key, params?)` performs `{name}` substitution and falls back through
 *   active-locale -> en -> the raw key.
 *
 * Locale detection order on boot:
 *   1. explicit `--lang <code>` CLI flag
 *   2. persisted `gameState.locale` from the active save
 *   3. `process.env.LANG` (zh_CN.UTF-8 -> zh, fr_FR -> en fallback)
 *   4. default 'en'
 */

const DICTS = {
  en: {
    // generic
    'cmd.unknown': 'Command not found: {cmd}',
    'cmd.hint': 'Type "help" to list available commands',
    'cmd.usage': 'Usage: {usage}',
    'ok': 'OK',
    'done': 'Done',

    // boot
    'boot.ready': 'System ready.',
    'welcome.loaded': 'Core modules loaded',
    'welcome.banner': 'Welcome back, explorer!',
    'welcome.level': 'Current level: Lv.{level}',
    'welcome.achievements': 'Achievements: {n}',
    'welcome.status': 'Type "status" for details',
    'welcome.new': 'Type "help" to start your adventure',
    'welcome.tutorial': 'Type "cat start_here.txt" for the tutorial',

    // ls / cd / cat
    'ls.empty': '  (empty)',
    'ls.total': '  Total: {dirs} dirs, {files} files',
    'ls.noent': "ls: cannot access '{path}': No such file or directory",
    'cd.noent': "cd: no such file or directory: {path}",
    'cd.notdir': "cd: not a directory: {path}",
    'cd.locked.level': 'Level too low! {area} requires Lv.{need} (you: Lv.{have})',
    'cd.hint.levelup': 'Tip: play minigames or finish quests to level up',
    'cat.usage': 'Usage: cat <file>',
    'cat.noent': "cat: {file}: No such file or directory",
    'cat.isdir': "cat: {file}: Is a directory",
    'cat.encrypted': 'File is encrypted. Use: decode {file}',

    // scan / decode
    'scan.running': 'Scanning system...',
    'scan.done': 'Scan mode enabled',
    'scan.hidden': 'Detected {n} hidden item(s) in this directory',
    'decode.usage': 'Usage: decode <file>',
    'decode.noent': 'decode: {file}: not found',
    'decode.notenc': 'decode: file does not need decoding',
    'decode.running': 'Decrypting...',

    // keys
    'key.got': 'Acquired key fragment: {frag}',
    'key.all': 'All key fragments collected! Master key: {key}',
    'key.unlock.hint': 'Type "unlock master" to use the key',
    'key.incomplete': 'Master key incomplete ({have}/3)',

    // RPG
    'status.title': 'Character Status',
    'status.level': 'Level',
    'status.exp': 'EXP',
    'status.progress': 'Progress',
    'status.next': 'Needs {n} EXP to next level',
    'status.maxed': 'Max level reached',
    'status.dirs': 'Visited dirs',
    'status.files': 'Files read',
    'status.games': 'Games played',
    'status.achievements': 'Achievements',
    'status.quests': 'Quests',
    'inv.title': 'Inventory',
    'inv.empty': '  (empty)',
    'use.usage': 'Usage: use <item>',
    'use.missing': 'You do not have: {item}',
    'quests.title': 'Quests',
    'quests.progress': 'Progress: {done}/{total}',
    'ach.title': 'Achievements',
    'ach.progress': 'Progress: {done}/{total}',

    // save / theme / lang
    'save.ok': 'Game saved to slot "{slot}"',
    'save.fail': 'Could not save game: {err}',
    'save.usage': 'Usage: save [slot-name]',
    'load.ok': 'Loaded slot "{slot}"',
    'load.fail': 'Could not load slot "{slot}": {err}',
    'load.usage': 'Usage: load <slot-name>',
    'saves.title': 'Save slots',
    'saves.empty': '  (no saves yet)',
    'theme.usage': 'Usage: theme <dark|light|retro>',
    'theme.set': 'Theme set to {name}',
    'theme.unknown': 'Unknown theme: {name}',
    'lang.usage': 'Usage: lang <en|zh>',
    'lang.set': 'Language set to {name}',
    'lang.unknown': 'Unknown language: {name}',

    // exit
    'exit.confirm': 'Save before exit? [Y/n] ',
    'exit.bye': 'Goodbye, explorer.',
    'exit.saved': 'Progress saved.',

    // achievements
    'ach.unlocked': 'Achievement unlocked!',
    'ach.reward': 'Reward: {reward}',
    'levelup.title': 'LEVEL UP',
    'levelup.now': 'Lv.{from} → Lv.{to}',
    'levelup.gained': 'Title: {title}',

    // v2.6 (iter-12)
    'gift.usage':       'Usage: gift <item> to <npc>',
    'gift.no_item':     "gift: you don't have \"{item}\"",
    'gift.no_npc':      'gift: unknown NPC "{npc}"',
    'gift.npc_absent':  'gift: {name} is not here',
    'gift.received':    '[received: {item}]',
    'bookmark.usage':   'Usage: bookmark <name>',
    'bookmark.bad':     'bookmark: name must be 1-32 chars [a-z0-9_-]',
    'bookmark.set':     'bookmark "{name}" -> {path}',
    'bookmarks.empty':  '  (none) - try: bookmark home',
    'goto.usage':       'Usage: goto <bookmark-name>',
    'goto.unknown':     'goto: no bookmark "{name}"',
    'goto.gone':        'goto: bookmark target gone: {path}',
    'season.title':     'Season',
    'affinity.title':   'NPC affinity',
    'cheatsheet.title': 'quick reference (?)'
  },

  zh: {
    'cmd.unknown': '命令未找到: {cmd}',
    'cmd.hint': '输入 "help" 查看可用命令',
    'cmd.usage': '用法: {usage}',
    'ok': '完成',
    'done': '完成',

    'boot.ready': '系统就绪。',
    'welcome.loaded': '核心模块已加载',
    'welcome.banner': '欢迎回来，探索者！',
    'welcome.level': '当前等级: Lv.{level}',
    'welcome.achievements': '已获得成就: {n} 个',
    'welcome.status': '输入 "status" 查看详细状态',
    'welcome.new': '输入 "help" 开始你的冒险',
    'welcome.tutorial': '输入 "cat start_here.txt" 阅读新手指南',

    'ls.empty': '  (空目录)',
    'ls.total': '  总计: {dirs} 目录, {files} 文件',
    'ls.noent': "ls: 无法访问 '{path}': 没有那个文件或目录",
    'cd.noent': "cd: 无法访问 '{path}': 没有那个文件或目录",
    'cd.notdir': "cd: '{path}' 不是目录",
    'cd.locked.level': '等级不足！{area} 需要 Lv.{need}（当前 Lv.{have}）',
    'cd.hint.levelup': '提示: 玩游戏或完成任务可以提升等级',
    'cat.usage': '用法: cat <文件名>',
    'cat.noent': "cat: {file}: 没有那个文件或目录",
    'cat.isdir': "cat: {file}: 是一个目录",
    'cat.encrypted': '文件已加密，请使用: decode {file}',

    'scan.running': '扫描系统中...',
    'scan.done': '扫描模式已启用',
    'scan.hidden': '检测到当前目录存在 {n} 个隐藏项目',
    'decode.usage': '用法: decode <文件名>',
    'decode.noent': 'decode: {file}: 文件未找到',
    'decode.notenc': 'decode: 该文件不需要解码',
    'decode.running': '解码中...',

    'key.got': '获得密钥片段: {frag}',
    'key.all': '集齐所有密钥片段！主密钥: {key}',
    'key.unlock.hint': '输入 "unlock master" 使用密钥',
    'key.incomplete': '密钥不完整（{have}/3）',

    'status.title': '角色状态',
    'status.level': '等级',
    'status.exp': '经验',
    'status.progress': '进度',
    'status.next': '还需 {n} EXP 升级',
    'status.maxed': '已达到最高等级',
    'status.dirs': '访问目录',
    'status.files': '阅读文件',
    'status.games': '游戏次数',
    'status.achievements': '成就',
    'status.quests': '任务',
    'inv.title': '背包',
    'inv.empty': '  (空)',
    'use.usage': '用法: use <物品名>',
    'use.missing': '你没有: {item}',
    'quests.title': '任务列表',
    'quests.progress': '进度: {done}/{total}',
    'ach.title': '成就列表',
    'ach.progress': '进度: {done}/{total}',

    'save.ok': '游戏已保存到存档 "{slot}"',
    'save.fail': '存档失败: {err}',
    'save.usage': '用法: save [存档名]',
    'load.ok': '已加载存档 "{slot}"',
    'load.fail': '无法加载存档 "{slot}": {err}',
    'load.usage': '用法: load <存档名>',
    'saves.title': '存档列表',
    'saves.empty': '  (暂无存档)',
    'theme.usage': '用法: theme <dark|light|retro>',
    'theme.set': '主题已切换为 {name}',
    'theme.unknown': '未知主题: {name}',
    'lang.usage': '用法: lang <en|zh>',
    'lang.set': '语言已切换为 {name}',
    'lang.unknown': '未知语言: {name}',

    'exit.confirm': '退出前保存进度？[Y/n] ',
    'exit.bye': '再见，探索者。',
    'exit.saved': '进度已保存。',

    'ach.unlocked': '成就解锁!',
    'ach.reward': '奖励: {reward}',
    'levelup.title': '等级提升',
    'levelup.now': 'Lv.{from} → Lv.{to}',
    'levelup.gained': '称号: {title}',

    // v2.6 (iter-12)
    'gift.usage':       '用法: gift <物品> to <NPC>',
    'gift.no_item':     'gift: 你没有 "{item}"',
    'gift.no_npc':      'gift: 未知 NPC "{npc}"',
    'gift.npc_absent':  'gift: {name} 不在这里',
    'gift.received':    '[获得: {item}]',
    'bookmark.usage':   '用法: bookmark <名称>',
    'bookmark.bad':     'bookmark: 名称需 1-32 个字符 [a-z0-9_-]',
    'bookmark.set':     '已收藏 "{name}" -> {path}',
    'bookmarks.empty':  '  (空) - 试试: bookmark home',
    'goto.usage':       '用法: goto <书签名>',
    'goto.unknown':     'goto: 没有书签 "{name}"',
    'goto.gone':        'goto: 书签目标已消失: {path}',
    'season.title':     '季节',
    'affinity.title':   'NPC 好感度',
    'cheatsheet.title': '快速参考 (?)'
  },

  // Japanese — community-contributed example translation. Covers the
  // ~80 most player-visible keys; missing keys fall back to English
  // automatically (see t() below). Adding a translation here is the
  // canonical "good first PR" — see docs/I18N_COVERAGE.md.
  ja: {
    'cmd.unknown': 'コマンドが見つかりません: {cmd}',
    'cmd.hint': '"help" と入力すると使えるコマンドの一覧が出ます',
    'cmd.usage': '使い方: {usage}',
    'ok': 'OK',
    'done': '完了',

    'boot.ready': 'システム起動完了。',
    'welcome.loaded': 'コアモジュールを読み込みました',
    'welcome.banner': 'おかえりなさい、探索者!',
    'welcome.level': '現在のレベル: Lv.{level}',
    'welcome.achievements': '実績: {n} 件',
    'welcome.status': '"status" で詳細を表示',
    'welcome.new': '"help" と入力して冒険を始めよう',
    'welcome.tutorial': '"cat start_here.txt" でチュートリアルを読む',

    'ls.empty': '  (空のディレクトリ)',
    'ls.total': '  合計: {dirs} ディレクトリ, {files} ファイル',
    'ls.noent': "ls: '{path}' にアクセスできません: そのファイルやディレクトリはありません",
    'cd.noent': "cd: そのファイルやディレクトリはありません: {path}",
    'cd.notdir': "cd: ディレクトリではありません: {path}",
    'cd.locked.level': 'レベル不足です! {area} は Lv.{need} 必要です (現在 Lv.{have})',
    'cd.hint.levelup': 'ヒント: ミニゲームをするかクエストを進めるとレベルが上がります',
    'cat.usage': '使い方: cat <ファイル>',
    'cat.noent': "cat: {file}: そのファイルやディレクトリはありません",
    'cat.isdir': "cat: {file}: ディレクトリです",
    'cat.encrypted': 'ファイルは暗号化されています。decode {file} を使ってください',

    'scan.running': 'システムをスキャン中...',
    'scan.done': 'スキャンモードを有効にしました',
    'scan.hidden': 'このディレクトリに隠しアイテムが {n} 件あります',
    'decode.usage': '使い方: decode <ファイル>',
    'decode.noent': 'decode: {file}: 見つかりません',
    'decode.notenc': 'decode: このファイルは復号する必要がありません',
    'decode.running': '復号中...',

    'key.got': '鍵の断片を取得: {frag}',
    'key.all': 'すべての鍵の断片を集めました! マスターキー: {key}',
    'key.unlock.hint': '"unlock master" を入力して鍵を使う',
    'key.incomplete': 'マスターキーが不完全です ({have}/3)',

    'status.title': 'キャラクター ステータス',
    'status.level': 'レベル',
    'status.exp': '経験値',
    'status.progress': '進捗',
    'status.next': '次のレベルまで {n} EXP',
    'status.maxed': '最大レベルに到達',
    'status.dirs': '訪問したディレクトリ',
    'status.files': '読んだファイル',
    'status.games': 'プレイしたゲーム',
    'status.achievements': '実績',
    'status.quests': 'クエスト',
    'inv.title': '所持品',
    'inv.empty': '  (なし)',
    'use.usage': '使い方: use <アイテム>',
    'use.missing': '所持していません: {item}',
    'quests.title': 'クエスト',
    'quests.progress': '進捗: {done}/{total}',
    'ach.title': '実績',
    'ach.progress': '進捗: {done}/{total}',

    'save.ok': 'スロット "{slot}" にセーブしました',
    'save.fail': 'セーブに失敗しました: {err}',
    'save.usage': '使い方: save [スロット名]',
    'load.ok': 'スロット "{slot}" を読み込みました',
    'load.fail': 'スロット "{slot}" の読み込みに失敗: {err}',
    'load.usage': '使い方: load <スロット名>',
    'saves.title': 'セーブスロット',
    'saves.empty': '  (まだセーブはありません)',
    'theme.usage': '使い方: theme <dark|light|retro>',
    'theme.set': 'テーマを {name} に設定しました',
    'theme.unknown': '不明なテーマ: {name}',
    'lang.usage': '使い方: lang <en|zh|ja>',
    'lang.set': '言語を {name} に切り替えました',
    'lang.unknown': '不明な言語: {name}',

    'exit.confirm': '終了する前にセーブしますか? [Y/n] ',
    'exit.bye': 'さようなら、探索者。',
    'exit.saved': '進捗を保存しました。',

    'ach.unlocked': '実績解除!',
    'ach.reward': '報酬: {reward}',
    'levelup.title': 'レベル アップ',
    'levelup.now': 'Lv.{from} → Lv.{to}',
    'levelup.gained': '称号: {title}',

    // v2.6 (iter-12)
    'gift.usage':       '使い方: gift <アイテム> to <NPC>',
    'gift.no_item':     'gift: "{item}" を持っていません',
    'gift.no_npc':      'gift: 不明な NPC "{npc}"',
    'gift.npc_absent':  'gift: {name} はここにいません',
    'gift.received':    '[入手: {item}]',
    'bookmark.usage':   '使い方: bookmark <名前>',
    'bookmark.bad':     'bookmark: 名前は 1-32 文字 [a-z0-9_-] です',
    'bookmark.set':     'ブックマーク "{name}" -> {path}',
    'bookmarks.empty':  '  (なし) - お試し: bookmark home',
    'goto.usage':       '使い方: goto <ブックマーク名>',
    'goto.unknown':     'goto: ブックマーク "{name}" がありません',
    'goto.gone':        'goto: ブックマーク先が消えました: {path}',
    'season.title':     '季節',
    'affinity.title':   'NPC の親密度',
    'cheatsheet.title': 'クイック リファレンス (?)'
  }
};

let currentLocale = 'en';

function detectLocale() {
  const raw =
    process.env.TERMINAL_QUEST_LANG ||
    process.env.LC_ALL ||
    process.env.LC_MESSAGES ||
    process.env.LANG ||
    '';
  const lower = raw.toLowerCase();
  if (lower.startsWith('zh')) return 'zh';
  if (lower.startsWith('ja')) return 'ja';
  return 'en';
}

function setLocale(code) {
  if (DICTS[code]) {
    currentLocale = code;
    return true;
  }
  return false;
}

function getLocale() {
  return currentLocale;
}

function availableLocales() {
  return Object.keys(DICTS);
}

function t(key, params) {
  const dict = DICTS[currentLocale] || DICTS.en;
  let str = dict[key];
  if (str === undefined) {
    // fall back to English then key
    str = DICTS.en[key] !== undefined ? DICTS.en[key] : key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
    }
  }
  return str;
}

// initialize based on env on load
setLocale(detectLocale());

module.exports = { t, setLocale, getLocale, availableLocales, detectLocale, DICTS };
