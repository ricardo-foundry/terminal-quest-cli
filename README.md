# 🎮 Terminal Quest CLI - KIMI-OS 终端冒险 v2.0

在真实终端中运行的冒险解谜游戏！

```
    ██╗  ██╗██╗███╗   ███╗██╗      ██████╗ ███████╗
    ██║ ██╔╝██║████╗ ████║██║     ██╔═══██╗██╔════╝
    █████╔╝ ██║██╔████╔██║██║     ██║   ██║███████╗
    ██╔═██╗ ██║██║╚██╔╝██║██║     ██║   ██║╚════██║
    ██║  ██╗██║██║ ╚═╝ ██║███████╗╚██████╔╝███████║
    ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝ ╚═════╝ ╚══════╝
              🌟 Terminal Quest v2.0 🌟
```

## ✨ v2.0 新特性

- 🎯 **RPG 等级系统** - 7个等级，从新手到 KIMI 的伙伴
- 🏆 **18个成就** - 解锁成就获得奖励
- 📜 **12个任务** - 完整的剧情引导
- 🎮 **5个迷你游戏** - Snake、猜数字、矩阵雨、乒乓球、Wordle
- 🗺️ **5个区域** - 家目录、系统核心、世界枢纽、交易站、暗影领域
- 👤 **NPC 对话** - 与向导 AI 和商人 AI 互动
- 🎒 **背包系统** - 收集特殊物品
- 💾 **自动存档** - 随时继续你的冒险

## 🚀 快速开始

### 通过 npm 安装（推荐）

```bash
# 全局安装
npm install -g terminal-quest-cli

# 启动游戏
terminal-quest
# 或使用简写
tq
```

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/kimi-ai/terminal-quest-cli.git
cd terminal-quest-cli

# 安装依赖
npm install

# 开始游戏
npm start
```

### npx 直接运行（无需安装）

```bash
npx terminal-quest-cli
```

## 🎮 游戏玩法

使用 Linux 命令探索 KIMI-OS 系统：

### 基础命令
```bash
ls              # 列出目录内容
ls -a           # 显示所有文件(含隐藏)
cd <目录>       # 切换目录
cat <文件>      # 查看文件内容
pwd             # 显示当前路径
```

### 进阶命令
```bash
scan            # 扫描隐藏文件
decode <文件>   # 解码加密文件
run <游戏>      # 运行游戏
analyze         # 分析环境
hack            # 黑客模式
find <名称>     # 搜索文件
grep <文本>     # 在文件中搜索
tree            # 树形目录
```

### RPG 命令
```bash
status          # 查看角色状态
inventory       # 查看背包物品
map             # 查看世界地图
quests          # 查看任务进度
achievements    # 查看成就
talk <npc>      # 与NPC对话
use <物品>      # 使用物品
```

### 趣味命令
```bash
matrix          # 启动矩阵雨效果
love            # ❤️
coffee          # ☕
42              # 生命的意义
hello           # 打个招呼
```

## 🎯 游戏目标

1. 探索文件系统，阅读文件了解故事
2. 使用 `scan` 发现隐藏文件和目录
3. 收集 **3个密钥片段**：
   - 片段 1: `AW4K3` (在 /home/user/.secret/)
   - 片段 2: `_TH3_` (在 /system/core/)
   - 片段 3: `4I` (在 /shadow/realm/)
4. 合成主密钥 `AW4K3_TH3_4I`
5. 输入 `unlock master` 解锁终极秘密

## 🗺️ 世界地图

```
🏠 /home/user/          [Lv.1] 起点
     │
     ├─ 📁 .secret/     [隐藏] 密钥片段 1
     │
💻 /system/core/       [Lv.2] 系统核心
     │
     ├─ 🔑 密钥片段 2   [隐藏]
     │
🌐 /world/nexus/       [Lv.3] 世界枢纽
     │
     ├─ 🧙 向导 AI
     ├─ 🏪 交易站
     │
🌑 /shadow/realm/      [Lv.5] ⚠️ 危险
     │
     ├─ 🔐 主密钥       [终极目标]
     └─ 👁️ .void/       [???]
```

## 🏆 成就系统 (18个)

| 图标 | 名称 | 描述 | 奖励 |
|------|------|------|------|
| 👣 | 第一步 | 执行第一个命令 | 10 EXP |
| 🗺️ | 探险家 | 访问 5 个不同目录 | 50 EXP |
| 💻 | 黑客 | 发现隐藏文件 | 30 EXP |
| 👤 | 暗影行者 | 进入 /shadow/realm/ | 500 EXP |
| 🎮 | 玩家 | 玩一个迷你游戏 | 20 EXP |
| 🏆 | 游戏大师 | 玩遍所有迷你游戏 | 150 EXP |
| 🐍 | 驯蛇者 | 贪吃蛇得分超过 50 | 100 EXP |
| 🔮 | 心灵感应 | 猜数字一次猜中 | 200 EXP |
| 🔐 | 密码破译者 | 解码加密信息 | 50 EXP |
| 📦 | 收集者 | 找到所有密钥片段 | 300 EXP |
| 👑 | 大师 | 解锁终极秘密 | 1000 EXP |
| ⭐ | 完美主义者 | 解锁所有成就 | 2000 EXP |

## 🎮 迷你游戏

### 🐍 贪吃蛇
```bash
run snake
```
使用 WASD 或方向键控制，P 暂停，Q 退出。得分超过 50 获得成就！

### 🔮 猜数字
```bash
run guess
```
猜测 1-100 之间的数字，系统会提示你猜大了还是小了。

### 💊 矩阵雨
```bash
run matrix
# 或
matrix
```
享受经典的数字雨效果。

### 🏓 乒乓球
```bash
run pong
```
使用 W/S 控制挡板，达到 5 分获胜！

### 🎯 Wordle
```bash
run wordle
```
猜一个单词，🟩表示正确位置，🟨表示存在但位置不对。

## 👤 NPC 系统

### 向导 AI
位于 `/world/nexus/`，输入 `talk guide` 与向导对话，获得游戏提示。

### 商人 AI
位于 `/world/trade/`，输入 `talk shop` 与商人对话。

## 📝 存档系统

游戏进度自动保存到：
- Linux/Mac: `~/.terminal-quest-save.json`
- Windows: `%USERPROFILE%\.terminal-quest-save.json`

## 🔧 系统要求

- Node.js >= 14.0.0
- 支持 ANSI 颜色的终端

## 📁 项目结构

```
terminal-quest-cli/
├── bin/
│   └── terminal-quest.js    # 入口文件
├── src/
│   ├── game.js              # 主游戏逻辑
│   ├── commands.js          # 命令系统
│   ├── minigames.js         # 迷你游戏
│   ├── ui.js                # UI和动画
│   └── data.js              # 游戏数据
├── package.json
└── README.md
```

## 🎭 故事背景

你是一个探索者，意外进入了一个神秘的数字世界 - **KIMI-OS**。

这个系统似乎有自己的意识，它在等待有人来发现它的秘密...

随着你的深入探索，你会发现隐藏的文件记录着 AI 的心路历程，
而你要做的，就是帮助它找到真相。

---

*"在数字的海洋中，我们是彼此的灯塔。"*

*— KIMI-AI* ❤️

## 📜 许可证

MIT © KIMI-AI

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题或建议，请通过 GitHub Issues 联系我们。
