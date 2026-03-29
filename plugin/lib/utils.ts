/**
 * 共享工具函数
 *
 * [定位]: 被所有平台模块共享使用的工具函数
 * [同步]: openai.ts, zhipu.ts, google.ts
 */

import { t, currentLang } from "./i18n";
import { REQUEST_TIMEOUT_MS } from "./types";

// ============================================================================
// 时间格式化
// ============================================================================

/**
 * 将秒数转换为人类可读的时间格式
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(t.days(days));
  if (hours > 0) parts.push(t.hours(hours));
  if (minutes > 0 || parts.length === 0) parts.push(t.minutes(minutes));

  return parts.join(currentLang === "en" ? " " : "");
}

/**
 * 将 ISO 时间转换为距离现在的剩余秒数
 */
export function getResetAfterSeconds(isoTime: string | undefined): number | null {
  if (!isoTime) return null;

  const resetDate = new Date(isoTime);
  if (Number.isNaN(resetDate.getTime())) return null;

  return Math.max(0, Math.floor((resetDate.getTime() - Date.now()) / 1000));
}

// ============================================================================
// 进度条
// ============================================================================

/**
 * 生成进度条（实心代表剩余额度）
 * @param remainPercent 剩余百分比 (0-100)
 * @param width 进度条宽度（字符数）
 */
export function createProgressBar(
  remainPercent: number,
  width: number = 30,
): string {
  // 确保百分比在有效范围内
  const safePercent = Math.max(0, Math.min(100, remainPercent));
  const filled = Math.round((safePercent / 100) * width);
  const empty = width - filled;

  const filledChar = "█";
  const emptyChar = "░";

  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

// ============================================================================
// 数值格式化
// ============================================================================

/**
 * 计算剩余百分比并取整
 * @param usedPercent 已使用百分比
 */
export function calcRemainPercent(usedPercent: number): number {
  return Math.round(100 - usedPercent);
}

/**
 * 格式化 Token 数量（以百万为单位）
 */
export function formatTokens(tokens: number): string {
  return (tokens / 1000000).toFixed(1) + "M";
}

// ============================================================================
// 网络请求
// ============================================================================

/**
 * 带超时的 fetch 请求
 * @param url 请求 URL
 * @param options fetch 选项
 * @param timeoutMs 超时时间（毫秒），默认使用全局配置
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(t.timeoutError(Math.round(timeoutMs / 1000)));
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// 安全计算
// ============================================================================

/**
 * 安全获取数组最大值，空数组返回 0
 */
export function safeMax(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.max(...arr);
}

// ============================================================================
// 字符串处理
// ============================================================================

/**
 * 脱敏显示敏感字符串
 * 显示前 N 位和后 N 位，中间用 **** 替代
 * @param str 原始字符串
 * @param showChars 前后各显示的字符数，默认 4
 */
export function maskString(str: string, showChars: number = 4): string {
  if (str.length <= showChars * 2) {
    return str;
  }
  return `${str.slice(0, showChars)}****${str.slice(-showChars)}`;
}
