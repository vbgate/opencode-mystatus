# opencode-mystatus

[![npm version](https://img.shields.io/npm/v/opencode-mystatus.svg)](https://www.npmjs.com/package/opencode-mystatus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[OpenCode](https://opencode.ai) 插件，用于查询多个 AI 平台的账号额度使用情况。

[English](./README.md)

## 支持的平台

| 平台         | 账号类型          | 数据来源                                       |
| ------------ | ----------------- | ---------------------------------------------- |
| OpenAI       | Plus / Team / Pro | `~/.local/share/opencode/auth.json`            |
| 智谱 AI      | Coding Plan       | `~/.local/share/opencode/auth.json`            |
| Google Cloud | Antigravity       | `~/.config/opencode/antigravity-accounts.json` |

## 安装

### 让 AI 帮你安装

将以下内容粘贴到任意 AI 代理（Claude Code、OpenCode、Cursor 等）：

```
Install the opencode-mystatus plugin by following: https://raw.githubusercontent.com/vbgate/opencode-mystatus/main/README.md
```

### 从 npm 安装

在 `~/.config/opencode/opencode.json` 中添加：

```json
{
  "plugin": ["opencode-mystatus"]
}
```

### 从本地文件安装

将插件文件复制到项目的 `.opencode/plugin/` 目录，或复制到 `~/.config/opencode/plugin/` 以全局使用。

## 使用方法

### 方式一：斜杠命令

使用 `/mystatus` 命令获取完整的额度信息：

```
/mystatus
```

### 方式二：自然语言

直接用自然语言提问，例如：

- "帮我查看 Codex 的额度"
- "我的 OpenAI 还剩多少额度？"
- "查看 AI 账号状态"

OpenCode 会自动调用 mystatus 工具来回答你的问题。

## 输出示例

```
## OpenAI 账号额度

Account:        user@example.com (team)

3小时限额
██████████████████████████████ 剩余 85%
重置: 2小时30分钟后

## 智谱 AI 账号额度

Account:        9c89****AQVM (Coding Plan)

5 小时 Token 限额
██████████████████████████████ 剩余 95%
已用: 0.5M / 10.0M
重置: 4小时后

## Google Cloud 账号额度

### user@gmail.com

G3 Pro     4h 59m     ████████████████████ 100%
G3 Image   4h 59m     ████████████████████ 100%
G3 Flash   4h 59m     ████████████████████ 100%
Claude     2d 9h      ░░░░░░░░░░░░░░░░░░░░ 0%
```

## 功能特性

- 一条命令查询多个 AI 平台的额度使用情况
- 可视化进度条显示剩余额度
- 重置时间倒计时
- 多语言支持（中文 / 英文）
- 支持多个 Google Cloud 账号
- API Key 脱敏显示，保护安全

## 配置

无需额外配置。插件自动从以下位置读取认证信息：

- **OpenAI 和智谱 AI**: `~/.local/share/opencode/auth.json`
- **Google Cloud**: `~/.config/opencode/antigravity-accounts.json`

### Google Cloud 设置

如需查询 Google Cloud (Antigravity) 账号额度，需要先安装 [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) 插件来完成 Google 账号认证。

## Google Cloud 模型

插件显示以下模型的额度：

| 显示名称 | 模型 Key                                       |
| -------- | ---------------------------------------------- |
| G3 Pro   | `gemini-3-pro-high` / `gemini-3-pro-low`       |
| G3 Image | `gemini-3-pro-image`                           |
| G3 Flash | `gemini-3-flash`                               |
| Claude   | `claude-opus-4-5-thinking` / `claude-opus-4-5` |

## 开发

```bash
# 使用 npm
npm install
npm run typecheck
npm run build

# 或使用 Bun
bun install
bun run typecheck
bun run build
```

## 许可证

MIT
