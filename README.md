# opencode-mystatus

[![npm version](https://img.shields.io/npm/v/opencode-mystatus.svg)](https://www.npmjs.com/package/opencode-mystatus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [OpenCode](https://opencode.ai) plugin to query account quota usage for multiple AI platforms.

[中文文档](./README.zh-CN.md)

## Supported Platforms

| Platform     | Account Type      | Data Source                                    |
| ------------ | ----------------- | ---------------------------------------------- |
| OpenAI       | Plus / Team / Pro | `~/.local/share/opencode/auth.json`            |
| Zhipu AI     | Coding Plan       | `~/.local/share/opencode/auth.json`            |
| Google Cloud | Antigravity       | `~/.config/opencode/antigravity-accounts.json` |

## Installation

### Let an LLM do it

Paste this into any LLM agent (Claude Code, OpenCode, Cursor, etc.):

```
Install the opencode-mystatus plugin by following: https://raw.githubusercontent.com/vbgate/opencode-mystatus/main/README.md
```

### From npm

Add to your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-mystatus"]
}
```

### From local files

Copy the plugin files to `.opencode/plugin/` in your project or `~/.config/opencode/plugin/` for global use.

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

- **OpenAI & Zhipu AI**: `~/.local/share/opencode/auth.json`
- **Google Cloud**: `~/.config/opencode/antigravity-accounts.json`

### Google Cloud Setup

To query Google Cloud (Antigravity) account quota, you need to install the [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) plugin first to authenticate your Google account.

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
