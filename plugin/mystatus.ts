/**
 * OpenCode 额度状态查询插件
 *
 * [输入]: ~/.local/share/opencode/auth.json 和 ~/.config/opencode/antigravity-accounts.json 中的认证信息
 * [输出]: 带进度条的额度使用情况展示
 * [定位]: 通过 mystatus 工具查询各账号额度
 * [同步]: lib/openai.ts, lib/zhipu.ts, lib/google.ts, lib/types.ts, lib/i18n.ts
 */

import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import { t } from "./lib/i18n";
import { type AuthData, type QueryResult, REQUEST_TIMEOUT_MS } from "./lib/types";
import { queryOpenAIUsage } from "./lib/openai";
import { queryZaiUsage, queryZhipuUsage } from "./lib/zhipu";
import { queryGoogleUsage } from "./lib/google";
import { queryCopilotUsage } from "./lib/copilot";

// ============================================================================
// 平台查询配置
// ============================================================================

/**
 * 平台查询配置
 */
interface PlatformQuery {
  name: string;
  title: string;
  queryFn: () => Promise<QueryResult | null>;
  timeoutMs: number;
}

/**
 * 带超时的平台查询包装器
 * 确保每个平台查询有独立超时，失败不影响其他平台
 */
async function queryWithTimeout(
  queryFn: () => Promise<QueryResult | null>,
  timeoutMs: number,
  platformName: string,
): Promise<QueryResult | null> {
  try {
    const result = await Promise.race([
      queryFn(),
      new Promise<QueryResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              success: false,
              error: `[${platformName}] ${t.timeoutError(timeoutMs / 1000)}`,
            }),
          timeoutMs,
        ),
      ),
    ]);
    return result;
  } catch (err) {
    return {
      success: false,
      error: `[${platformName}] ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================================
// 插件导出（唯一导出，避免其他函数被当作插件加载）
// ============================================================================

export const MyStatusPlugin: Plugin = async () => {
  return {
    tool: {
      mystatus: tool({
        description:
          "Query account quota usage for all configured AI platforms. Returns remaining quota percentages, usage stats, and reset countdowns with visual progress bars. Currently supports OpenAI (ChatGPT/Codex), Zhipu AI, Z.ai, Google Antigravity, and GitHub Copilot.",
        args: {},
        async execute() {
          // 1. 读取 auth.json
          const authPath = join(homedir(), ".local/share/opencode/auth.json");
          let authData: AuthData;

          try {
            const content = await readFile(authPath, "utf-8");
            authData = JSON.parse(content);
          } catch (err) {
            return t.authError(
              authPath,
              err instanceof Error ? err.message : String(err),
            );
          }

          // 2. 系统化并行查询所有平台（每个平台有独立超时）
          const platforms: PlatformQuery[] = [
            {
              name: "OpenAI",
              title: t.openaiTitle,
              queryFn: () => queryOpenAIUsage(authData.openai),
              timeoutMs: REQUEST_TIMEOUT_MS,
            },
            {
              name: "ZhipuAI",
              title: t.zhipuTitle,
              queryFn: () => queryZhipuUsage(authData["zhipuai-coding-plan"]),
              timeoutMs: REQUEST_TIMEOUT_MS,
            },
            {
              name: "Z.ai",
              title: t.zaiTitle,
              queryFn: () => queryZaiUsage(authData["zai-coding-plan"]),
              timeoutMs: REQUEST_TIMEOUT_MS,
            },
            {
              name: "Google",
              title: t.googleTitle,
              queryFn: () => queryGoogleUsage(),
              timeoutMs: REQUEST_TIMEOUT_MS,
            },
            {
              name: "Copilot",
              title: t.copilotTitle,
              queryFn: () => queryCopilotUsage(authData["github-copilot"]),
              timeoutMs: REQUEST_TIMEOUT_MS,
            },
          ];

          // 使用 Promise.allSettled 确保即使一个平台失败也会继续查询其他平台
          const settledResults = await Promise.allSettled(
            platforms.map((p) => queryWithTimeout(p.queryFn, p.timeoutMs, p.name)),
          );

          // 将 settled results 转换为统一的结果数组
          const queryResults: Array<{ platform: PlatformQuery; result: QueryResult | null }> = [];

          for (let i = 0; i < platforms.length; i++) {
            const platform = platforms[i];
            const settled = settledResults[i];

            let result: QueryResult | null = null;

            if (settled.status === "fulfilled") {
              result = settled.value;
            } else {
              // Promise 被拒绝（理论上不应该发生，因为 queryWithTimeout 已捕获错误）
              result = {
                success: false,
                error: `[${platform.name}] ${settled.reason}`,
              };
            }

            queryResults.push({ platform, result });
          }

          // 3. 系统化收集结果 - 每个平台独立处理，确保一个失败不影响其他
          const outputResults: string[] = [];
          const errors: string[] = [];

          for (const { platform, result } of queryResults) {
            collectResult(result, platform.title, outputResults, errors);
          }

          // 4. 汇总输出
          if (outputResults.length === 0 && errors.length === 0) {
            return t.noAccounts;
          }

          let output = outputResults.join("\n");

          if (errors.length > 0) {
            if (output) output += "\n\n";
            output += t.queryFailed + errors.join("\n");
          }

          return output;
        },
      }),
    },
  };
};

/**
 * 收集查询结果到 results 和 errors 数组
 * 注意：这是内部函数，不导出，避免被 OpenCode 当作插件加载
 */
function collectResult(
  result: QueryResult | null,
  title: string,
  results: string[],
  errors: string[],
): void {
  if (!result) return;

  if (result.success && result.output) {
    if (results.length > 0) results.push(""); // 分隔符
    results.push(title);
    results.push("");
    results.push(result.output);
  } else if (result.error) {
    errors.push(result.error);
  }
}
