# opencode-mystatus

[![npm version](https://img.shields.io/npm/v/opencode-mystatus.svg)](https://www.npmjs.com/package/opencode-mystatus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[OpenCode](https://opencode.ai) 插件，用于查询多个 AI 平台的账号额度使用情况。

[English](./README.md)

![AI额度一键查](./assets/mystatus-banner-zh.jpeg)

## 支持的平台

| 平台         | 账号类型          | 数据来源                                       |
| ------------ | ----------------- | ---------------------------------------------- |
| OpenAI       | Plus / Team / Pro | `~/.local/share/opencode/auth.json`            |
| 智谱 AI      | Coding Plan       | `~/.local/share/opencode/auth.json`            |
| Z.ai         | Coding Plan       | `~/.local/share/opencode/auth.json`            |
| Google Cloud | Antigravity       | `~/.config/opencode/antigravity-accounts.json` |

## 安装

### 让 AI 帮你安装

将以下内容粘贴到任意 AI 代理（Claude Code、OpenCode、Cursor 等）：

```
Install the opencode-mystatus plugin by following: https://raw.githubusercontent.com/vbgate/opencode-mystatus/main/README.md
```

<details>
<summary><b>AI 代理安装指令</b></summary>

安装此插件需要执行以下步骤：

1. 在 `~/.config/opencode/opencode.json` 的 `plugin` 数组中添加 `"opencode-mystatus@1.0.1"`

2. 在同一文件的 `command` 对象中添加斜杠命令：

```json
{
  "plugin": ["opencode-mystatus@1.0.1"],
  "command": {
    "mystatus": {
      "description": "Query quota usage for all AI accounts",
      "template": "Use the mystatus tool to query quota usage. Return the result as-is without modification."
    }
  }
}
```

3. 告诉用户重启 OpenCode。

</details>

### 手动安装

1. 在 `~/.config/opencode/opencode.json` 中添加插件和斜杠命令：

```json
{
  "plugin": ["opencode-mystatus@1.0.1"],
  "command": {
    "mystatus": {
      "description": "Query quota usage for all AI accounts",
      "template": "Use the mystatus tool to query quota usage. Return the result as-is without modification."
    }
  }
}
```

2. 重启 OpenCode

### 从本地文件安装

将插件文件复制到 OpenCode 配置目录：

1. 将 `plugin/mystatus.ts` 和 `plugin/lib/` 复制到 `~/.config/opencode/plugin/`
2. 将 `command/mystatus.md` 复制到 `~/.config/opencode/command/`
3. 重启 OpenCode

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

## Z.ai 账号额度

Account:        9c89****AQVM (Z.ai)

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

- **OpenAI、智谱 AI 和 Z.ai**: `~/.local/share/opencode/auth.json`
- **Google Cloud**: `~/.config/opencode/antigravity-accounts.json`

### Google Cloud 设置

如需查询 Google Cloud (Antigravity) 账号额度，需要先安装 [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) 插件来完成 Google 账号认证。

## 安全性

本插件可以安全放心使用：

**读取的本地文件（只读）：**

- `~/.local/share/opencode/auth.json` - OpenCode 官方认证存储
- `~/.config/opencode/antigravity-accounts.json` - Antigravity 插件的账号存储

**请求的 API 接口（均为官方接口）：**

- `https://chatgpt.com/backend-api/wham/usage` - OpenAI 官方额度查询接口
- `https://bigmodel.cn/api/monitor/usage/quota/limit` - 智谱 AI 官方额度查询接口
- `https://api.z.ai/api/monitor/usage/quota/limit` - Z.ai 官方额度查询接口
- `https://oauth2.googleapis.com/token` - Google 官方 OAuth 接口
- `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels` - Google Cloud 官方接口

**隐私保护：**

- 插件不会保存、上传或缓存任何用户数据
- 敏感信息（API Key）在输出时自动脱敏显示
- 源代码完全开源，可随时审查

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
