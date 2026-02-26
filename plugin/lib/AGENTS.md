# plugin/lib/ - Platform Implementations

**Parent:** ./AGENTS.md

## OVERVIEW

Platform-specific quota query implementations. Each file handles one AI provider.

## FILES

| File       | Platform           | Auth Source          |
| ---------- | ------------------ | -------------------- |
| openai.ts  | OpenAI (ChatGPT)   | OAuth access token   |
| zhipu.ts   | Zhipu AI + Z.ai    | API key              |
| google.ts  | Google Antigravity | OAuth refresh token  |
| copilot.ts | GitHub Copilot     | OAuth + optional PAT |
| types.ts   | Shared types       | -                    |
| utils.ts   | Helpers            | -                    |
| i18n.ts    | Translations       | -                    |

## PATTERN (Adding New Platform)

```typescript
// 1. Add types to types.ts
export interface XxxAuthData {
  type: string;
  key?: string;
}

// 2. Create lib/xxx.ts with:
export async function queryXxxUsage(
  authData: XxxAuthData | undefined,
): Promise<QueryResult | null> {
  if (!authData || !authData.key) return null;
  try {
    const data = await fetchXxxData(authData.key);
    return { success: true, output: formatXxxUsage(data) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// 3. Export from mystatus.ts and add to Promise.all
```

## CONVENTIONS

- Return `null` if auth missing (skip silently)
- Return `{success: false, error}` on API failures
- Use `fetchWithTimeout` from utils.ts for API calls
- Format output with progress bars (█ chars)
- JWT parsing in openai.ts - reuse pattern if needed
