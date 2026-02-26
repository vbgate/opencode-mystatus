/**
 * OpenAI 额度查询模块
 *
 * [输入]: OAuth access token
 * [输出]: 格式化的额度使用情况
 * [定位]: 被 mystatus.ts 调用，处理 OpenAI 账号
 * [同步]: mystatus.ts, types.ts, utils.ts, i18n.ts
 */

import { t } from "./i18n";
import { type QueryResult, type OpenAIAuthData } from "./types";
import {
  formatDuration,
  createProgressBar,
  calcRemainPercent,
  fetchWithTimeout,
} from "./utils";

// ============================================================================
// 类型定义
// ============================================================================

interface RateLimitWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_after_seconds: number;
}

interface OpenAIUsageResponse {
  plan_type: string;
  rate_limit: {
    limit_reached: boolean;
    primary_window: RateLimitWindow;
    secondary_window: RateLimitWindow | null;
  } | null;
}

// ============================================================================
// JWT 解析
// ============================================================================

interface JwtPayload {
  "https://api.openai.com/profile"?: {
    email?: string;
  };
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: string;
  };
}

/**
 * Base64URL 解码
 */
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  return Buffer.from(padded, "base64").toString("utf8");
}

/**
 * 解析 JWT token，提取 payload
 */
function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    return JSON.parse(payloadJson) as JwtPayload;
  } catch (err) {
    console.error("[OpenAI] Failed to parse JWT:", err);
    return null;
  }
}

/**
 * 从 JWT 中提取用户邮箱
 */
function getEmailFromJwt(token: string): string | null {
  const payload = parseJwt(token);
  return payload?.["https://api.openai.com/profile"]?.email ?? null;
}

/**
 * 从 JWT 中提取 ChatGPT 账号 ID（用于团队/组织账号）
 */
function getAccountIdFromJwt(token: string): string | null {
  const payload = parseJwt(token);
  return payload?.["https://api.openai.com/auth"]?.chatgpt_account_id ?? null;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 将窗口时长（秒）转换为可读的窗口名称
 */
function formatWindowName(seconds: number): string {
  const days = Math.round(seconds / 86400);

  if (days >= 1) {
    return t.dayLimit(days);
  }
  return t.hourLimit(Math.round(seconds / 3600));
}

/**
 * 格式化单个窗口的使用情况
 */
function formatWindow(window: RateLimitWindow): string[] {
  const windowName = formatWindowName(window.limit_window_seconds);
  const remainPercent = calcRemainPercent(window.used_percent);
  const progressBar = createProgressBar(remainPercent);
  const resetTime = formatDuration(window.reset_after_seconds);

  return [
    windowName,
    `${progressBar} ${t.remaining(remainPercent)}`,
    t.resetIn(resetTime),
  ];
}

// ============================================================================
// API 调用
// ============================================================================

const OPENAI_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

/**
 * 获取 OpenAI 使用情况
 */
async function fetchOpenAIUsage(
  accessToken: string,
): Promise<OpenAIUsageResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "OpenCode-Status-Plugin/1.0",
  };

  const accountId = getAccountIdFromJwt(accessToken);
  if (accountId) {
    headers["ChatGPT-Account-Id"] = accountId;
  }

  const response = await fetchWithTimeout(OPENAI_USAGE_URL, {
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.apiError(response.status, errorText));
  }

  return response.json() as Promise<OpenAIUsageResponse>;
}

// ============================================================================
// 格式化输出
// ============================================================================

/**
 * 格式化 OpenAI 使用情况
 */
function formatOpenAIUsage(
  data: OpenAIUsageResponse,
  email: string | null,
): string {
  const { plan_type, rate_limit } = data;
  const lines: string[] = [];

  // 标题行：Account: email (plan)
  const accountDisplay = email || t.unknown;
  lines.push(`${t.account}        ${accountDisplay} (${plan_type})`);
  lines.push("");

  // 主窗口
  if (rate_limit?.primary_window) {
    lines.push(...formatWindow(rate_limit.primary_window));
  }

  // 次窗口（如果存在）
  if (rate_limit?.secondary_window) {
    lines.push("");
    lines.push(...formatWindow(rate_limit.secondary_window));
  }

  // 限额状态提示
  if (rate_limit?.limit_reached) {
    lines.push("");
    lines.push(t.limitReached);
  }

  return lines.join("\n");
}

// ============================================================================
// 导出接口
// ============================================================================

export type { OpenAIAuthData };

/**
 * 查询 OpenAI 账号额度
 * @param authData OpenAI 认证数据
 * @returns 查询结果，如果账号不存在或无效返回 null
 */
export async function queryOpenAIUsage(
  authData: OpenAIAuthData | undefined,
): Promise<QueryResult | null> {
  // 检查账号是否存在且有效
  if (!authData || authData.type !== "oauth" || !authData.access) {
    return null;
  }

  // 检查 OAuth token 是否过期
  if (authData.expires && authData.expires < Date.now()) {
    return {
      success: false,
      error: t.tokenExpired,
    };
  }

  try {
    const email = getEmailFromJwt(authData.access);
    const usage = await fetchOpenAIUsage(authData.access);
    return {
      success: true,
      output: formatOpenAIUsage(usage, email),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
