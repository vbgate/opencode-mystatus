/**
 * Anthropic Claude 额度查询模块
 *
 * [输入]: auth.json → anthropic (OAuth access/refresh tokens)
 * [输出]: 格式化的 5-hour / 7-day 限额使用情况
 * [定位]: 被 mystatus.ts 调用，处理 Anthropic Claude Pro/Max 账号
 * [同步]: mystatus.ts, types.ts, utils.ts, i18n.ts
 *
 * 技术背景:
 *   Anthropic 提供了一个内部端点供 Claude Code 使用，用于查询订阅配额：
 *     GET https://api.anthropic.com/api/oauth/usage
 *   认证需要通过 OAuth access token (sk-ant-oat01-...) 发送 Bearer header，
 *   并附带 anthropic-beta 和 User-Agent 头部，否则会返回 401/403。
 *   注意：该端点目前为内部/未公开接口，行为可能随版本变化。
 */

import { t } from "./i18n";
import { type QueryResult, type AnthropicAuthData } from "./types";
import {
  createProgressBar,
  calcRemainPercent,
  formatDuration,
  fetchWithTimeout,
} from "./utils";

// ============================================================================
// 常量
// ============================================================================

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const ANTHROPIC_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";

/**
 * Claude Code 官方 OAuth client_id，用于 refresh token 交换。
 * 来源：Claude Code 官方客户端 OAuth 流程逆向分析（公开已知）。
 */
const CLAUDE_CODE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

/**
 * Anthropic beta 标头：激活 oauth/usage 端点所必需，否则返回 401。
 */
const ANTHROPIC_BETA = "oauth-2025-04-20";

/**
 * User-Agent 需要标识为 claude-code，否则服务器会更积极地限速（429）。
 */
const ANTHROPIC_USER_AGENT = "claude-code/1.0.17";

// ============================================================================
// 类型定义
// ============================================================================

interface AnthropicUsageResponse {
  five_hour?: { utilization: number; resets_at: string };
  seven_day?: { utilization: number; resets_at: string };
  extra_usage?: unknown;
}

// ============================================================================
// Token 刷新
// ============================================================================

/**
 * 使用 refresh token 获取新的 access token。
 * Anthropic 使用 refresh token rotation，每次刷新后旧的 refresh token 失效。
 * 注意：此处无法将新 token 写回 auth.json，调用方应提示用户重新登录。
 */
async function refreshAccessToken(
  refreshToken: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLAUDE_CODE_CLIENT_ID,
    });

    const response = await fetch(ANTHROPIC_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// API 调用
// ============================================================================

/**
 * 查询 Anthropic Claude 订阅配额。
 * 使用 oauth/usage 内部端点（Claude Code HUD 所用的同一端点）。
 */
async function fetchAnthropicUsage(
  accessToken: string,
): Promise<AnthropicUsageResponse> {
  const response = await fetchWithTimeout(ANTHROPIC_USAGE_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "anthropic-beta": ANTHROPIC_BETA,
      "User-Agent": ANTHROPIC_USER_AGENT,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.anthropicApiError(response.status, errorText));
  }

  return response.json() as Promise<AnthropicUsageResponse>;
}

// ============================================================================
// 格式化输出
// ============================================================================

/**
 * 将 ISO 时间戳转换为剩余时间（秒）
 */
function secondsUntil(isoTime: string): number {
  try {
    return Math.max(0, Math.floor((new Date(isoTime).getTime() - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

/**
 * 格式化单个使用窗口（5h / 7d）
 */
function formatWindow(
  label: string,
  utilization: number,
  resets_at: string,
): string[] {
  const remainPercent = calcRemainPercent(utilization);
  const progressBar = createProgressBar(remainPercent);
  const resetSecs = secondsUntil(resets_at);
  const resetStr = resetSecs > 0 ? formatDuration(resetSecs) : t.resetsSoon;

  return [
    label,
    `${progressBar} ${t.remaining(remainPercent)}`,
    t.resetIn(resetStr),
  ];
}

/**
 * 格式化 Anthropic 使用情况输出
 */
function formatAnthropicUsage(data: AnthropicUsageResponse): string {
  const lines: string[] = [];

  lines.push(`${t.account}        Claude Pro/Max`);
  lines.push("");

  if (data.five_hour) {
    lines.push(...formatWindow(t.anthropicFiveHourLimit, data.five_hour.utilization, data.five_hour.resets_at));
  }

  if (data.seven_day) {
    if (data.five_hour) lines.push("");
    lines.push(...formatWindow(t.anthropicSevenDayLimit, data.seven_day.utilization, data.seven_day.resets_at));
  }

  if (!data.five_hour && !data.seven_day) {
    lines.push(t.anthropicNoLimits);
  }

  return lines.join("\n");
}

// ============================================================================
// 导出接口
// ============================================================================

export type { AnthropicAuthData };

/**
 * 查询 Anthropic Claude 订阅配额
 * @param authData Anthropic OAuth 认证数据
 * @returns 查询结果，如果账号不存在或无效返回 null
 */
export async function queryAnthropicUsage(
  authData: AnthropicAuthData | undefined,
): Promise<QueryResult | null> {
  if (!authData || authData.type !== "oauth") return null;

  let accessToken = authData.access;

  // 如果 access token 过期或缺失，尝试刷新
  if (!accessToken || (authData.expires && authData.expires < Date.now())) {
    if (!authData.refresh) {
      return { success: false, error: t.anthropicTokenExpired };
    }
    const refreshed = await refreshAccessToken(authData.refresh);
    if (!refreshed) {
      return { success: false, error: t.anthropicRefreshFailed };
    }
    accessToken = refreshed;
  }

  try {
    const usage = await fetchAnthropicUsage(accessToken);
    return {
      success: true,
      output: formatAnthropicUsage(usage),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
