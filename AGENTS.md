# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-26
**Commit:** 196eed3
**Branch:** main

## OVERVIEW

OpenCode plugin for querying AI platform quotas. TypeScript + Node.js, supports OpenAI, Zhipu AI, Z.ai, GitHub Copilot, Google Antigravity.

## STRUCTURE

```
./
├── plugin/           # Source code
│   ├── mystatus.ts  # Main entry (MyStatusPlugin)
│   └── lib/         # Platform implementations
├── command/         # /mystatus command template
├── assets/         # Banner images
└── .github/        # CI workflow
```

## WHERE TO LOOK

| Task             | Location            | Notes                                     |
| ---------------- | ------------------- | ----------------------------------------- |
| Add new platform | plugin/lib/         | Copy existing platform module pattern     |
| Plugin entry     | plugin/mystatus.ts  | Tool definition + parallel query dispatch |
| Types            | plugin/lib/types.ts | AuthData, QueryResult, platform types     |
| i18n             | plugin/lib/i18n.ts  | Chinese/English translations              |

## CODE MAP

| Symbol            | Type      | Location       | Role                 |
| ----------------- | --------- | -------------- | -------------------- |
| MyStatusPlugin    | Plugin    | mystatus.ts    | Main export          |
| queryOpenAIUsage  | fn        | lib/openai.ts  | OpenAI quota         |
| queryZhipuUsage   | fn        | lib/zhipu.ts   | Zhipu AI             |
| queryZaiUsage     | fn        | lib/zhipu.ts   | Z.ai                 |
| queryGoogleUsage  | fn        | lib/google.ts  | Google Antigravity   |
| queryCopilotUsage | fn        | lib/copilot.ts | GitHub Copilot       |
| QueryResult       | interface | lib/types.ts   | Platform result type |
| AuthData          | interface | lib/types.ts   | Auth structure       |

## CONVENTIONS

- **Module pattern**: Each platform in own file under lib/
- **Exports**: Single function `queryXxxUsage(auth)` returning `Promise<QueryResult | null>`
- **Comments**: JSDoc with [输入][输出][定位][同步] fields
- **Error handling**: Return `{success: false, error: string}` on failure

## ANTI-PATTERNS (THIS PROJECT)

- NO tests - manual verification only
- NO `any` types - strict TypeScript
- NO default exports - named exports only

## UNIQUE STYLES

- Progress bars in output (█ characters)
- JWT token parsing for email extraction
- Parallel Promise.all for all platform queries
- Chinese comments, English UI output

## COMMANDS

```bash
npm run build     # Compile to dist/
npm run typecheck # Type check only
npm run lint      # ESLint
npm run format    # Prettier
```

## NOTES

- Auth read from: `~/.local/share/opencode/auth.json`
- Google reads from: `~/.config/opencode/antigravity-accounts.json`
- Only plugin/\*.ts included in build (tsconfig.json)
