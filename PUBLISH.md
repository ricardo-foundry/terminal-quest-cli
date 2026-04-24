# 📦 发布到 NPM 指南

## ✅ 发布前检查清单

- [x] package.json 配置正确
- [x] 版本号已更新
- [x] README.md 完善
- [x] LICENSE 文件存在
- [x] 入口文件可执行权限
- [x] npm pack 测试通过

## 🚀 发布步骤

### 1. 登录 NPM

```bash
npm login
```

输入你的 NPM 账号：
- Username: 你的 npm 用户名
- Password: 你的 npm 密码
- Email: 你的邮箱（会发送 OTP 验证码）

### 2. 发布包

```bash
# 进入项目目录
cd /Users/ricardo/Documents/公司学习文件/kimi-ai-project/terminal-quest-cli

# 正式发布
npm publish
```

### 3. 验证发布

```bash
# 查看已发布的包
npm view terminal-quest-cli

# 测试安装
npm install -g terminal-quest-cli

# 运行游戏
terminal-quest
```

## 📝 包信息

- **包名**: terminal-quest-cli
- **版本**: 2.0.0
- **大小**: 32.0 kB (压缩后) / 115.8 kB (解压后)
- **入口**: bin/terminal-quest.js
- **命令**: terminal-quest, tq, adventure

## 🔄 后续版本更新

更新版本号后再次发布：

```bash
# 更新补丁版本 (2.0.1)
npm version patch

# 更新次要版本 (2.1.0)
npm version minor

# 更新主要版本 (3.0.0)
npm version major

# 发布
npm publish
```

## 🏷️ 添加标签（可选）

```bash
# 添加 beta 标签
npm publish --tag beta

# 添加 latest 标签
npm dist-tag add terminal-quest-cli@2.0.0 latest
```

## 📊 发布后检查

访问 https://www.npmjs.com/package/terminal-quest-cli 查看包页面。

## 🆘 常见问题

### 包名已被占用
如果 `terminal-quest-cli` 已被占用，需要修改 package.json 中的 name 字段。

### 发布失败
- 检查是否已登录: `npm whoami`
- 检查版本号是否已存在: `npm view terminal-quest-cli versions`
- 确保网络连接正常

### 撤销发布（24小时内）
```bash
npm unpublish terminal-quest-cli@2.0.0
```
