# opencode-mystatus

[![npm version](https://img.shields.io/npm/v/opencode-mystatus.svg)](https://www.npmjs.com/package/opencode-mystatus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [OpenCode](https://opencode.ai) plugin to query account quota usage for multiple AI platforms.

[中文文档](./README.zh-CN.md)

![Check AI Quota in One Click](./assets/mystatus-banner-en.jpeg)

## Supported Platforms

| Platform     | Account Type      | Data Source                                    |
| ------------ | ----------------- | ---------------------------------------------- |
| OpenAI       | Plus / Team / Pro | `~/.local/share/opencode/auth.json`            |
| Zhipu AI     | Coding Plan       | `~/.local/share/opencode/auth.json`            |
| Z.ai         | Coding Plan       | `~/.local/share/opencode/auth.json`            |
| Google Cloud | Antigravity       | `~/.config/opencode/antigravity-accounts.json` |

## Installation

### Let an LLM do it

Paste this into any LLM agent (Claude Code, OpenCode, Cursor, etc.):

```
Install the opencode-mystatus plugin by following: https://raw.githubusercontent.com/vbgate/opencode-mystatus/main/README.md
```

<details>
<summary><b>Instructions for LLM agents</b></summary>

To install this plugin, perform these steps:

1. Add `"opencode-mystatus@1.0.1"` to the `plugin` array in `~/.config/opencode/opencode.json`

2. Add the slash command to the `command` object in the same file:

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

3. Tell the user to restart OpenCode.

</details>

### Manual Installation

1. Add the plugin and slash command to your `~/.config/opencode/opencode.json`:

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

2. Restart OpenCode

### From Local Files

Copy the plugin files to your OpenCode config directory:

1. Copy `plugin/mystatus.ts` and `plugin/lib/` to `~/.config/opencode/plugin/`
2. Copy `command/mystatus.md` to `~/.config/opencode/command/`
3. Restart OpenCode

## Usage

### Option 1: Slash Command

Use the `/mystatus` command to get complete quota information:

```
/mystatus
```

### Option 2: Natural Language

Simply ask in natural language, for example:

- "Check my OpenAI quota"
- "How much Codex quota do I have left?"
- "Show my AI account status"

OpenCode will automatically use the mystatus tool to answer your question.

## Output Example

```
## OpenAI Account Quota

Account:        user@example.com (team)

3-hour limit
██████████████████████████████ 85% remaining
Resets in: 2h 30m

## Zhipu AI Account Quota

Account:        9c89****AQVM (Coding Plan)

5-hour token limit
██████████████████████████████ 95% remaining
Used: 0.5M / 10.0M
Resets in: 4h

## Z.ai Account Quota

Account:        9c89****AQVM (Z.ai)

5-hour token limit
██████████████████████████████ 95% remaining
Used: 0.5M / 10.0M
Resets in: 4h

## Google Cloud Account Quota

### user@gmail.com

G3 Pro     4h 59m     ████████████████████ 100%
G3 Image   4h 59m     ████████████████████ 100%
G3 Flash   4h 59m     ████████████████████ 100%
Claude     2d 9h      ░░░░░░░░░░░░░░░░░░░░ 0%
```

## Features

- Query quota usage across multiple AI platforms in one command
- Visual progress bars showing remaining quota
- Reset time countdown
- Multi-language support (Chinese / English)
- Multiple Google Cloud accounts support
- API key masking for security

## Configuration

No additional configuration required. The plugin automatically reads credentials from:

- **OpenAI, Zhipu AI & Z.ai**: `~/.local/share/opencode/auth.json`
- **Google Cloud**: `~/.config/opencode/antigravity-accounts.json`

### Google Cloud Setup

To query Google Cloud (Antigravity) account quota, you need to install the [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) plugin first to authenticate your Google account.

## Security

This plugin is safe to use:

**Local Files Accessed (read-only):**

- `~/.local/share/opencode/auth.json` - OpenCode's official auth storage
- `~/.config/opencode/antigravity-accounts.json` - Antigravity plugin's account storage

**API Endpoints (all official):**

- `https://chatgpt.com/backend-api/wham/usage` - OpenAI official quota API
- `https://bigmodel.cn/api/monitor/usage/quota/limit` - Zhipu AI official quota API
- `https://api.z.ai/api/monitor/usage/quota/limit` - Z.ai official quota API
- `https://oauth2.googleapis.com/token` - Google official OAuth API
- `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels` - Google Cloud official API

**Privacy:**

- No data is stored, uploaded, or cached by this plugin
- Sensitive information (API keys) is automatically masked in output
- Source code is fully open for review

## Google Cloud Models

The plugin displays quota for these models:

| Display Name | Model Key                                      |
| ------------ | ---------------------------------------------- |
| G3 Pro       | `gemini-3-pro-high` / `gemini-3-pro-low`       |
| G3 Image     | `gemini-3-pro-image`                           |
| G3 Flash     | `gemini-3-flash`                               |
| Claude       | `claude-opus-4-5-thinking` / `claude-opus-4-5` |

## Development

```bash
# Using npm
npm install
npm run typecheck
npm run build

# Or using Bun
bun install
bun run typecheck
bun run build
```

## License

MIT
