/**
 * Synthetic.new 额度查询模块
 *
 * [输入]: API Key
 * [输出]: 格式化的额度使用情况
 * [定位]: 被 mystatus.ts 调用，处理 Synthetic 账号
 * [同步]: mystatus.ts, types.ts, utils.ts, i18n.ts
 */

import { t } from "./i18n";
import {
  type QueryResult,
  type ZhipuAuthData,
  HIGH_USAGE_THRESHOLD,
} from "./types";
import { formatDuration, createProgressBar, fetchWithTimeout } from "./utils";

interface SyntheticQuotaResponse {
  search?: {
    hourly?: {
      limit: number;
      requests: number;
      renewsAt: string;
    };
  };
  weeklyTokenLimit?: {
    nextRegenAt: string;
    percentRemaining: number;
    maxCredits: string;
    remainingCredits: string;
    nextRegenCredits: string;
  };
  rollingFiveHourLimit?: {
    remaining: number;
    max: number;
    nextTickAt: string;
  };
}

interface QuotaItem {
  label: string;
  usedText: string;
  remainPercent: number;
  renewsAt: string;
}

interface CountQuota {
  limit: number;
  requests: number;
  renewsAt: string;
}

const SYNTHETIC_QUOTA_QUERY_URL = "https://api.synthetic.new/v2/quotas";

async function fetchSyntheticUsage(
  apiKey: string,
): Promise<SyntheticQuotaResponse> {
  const response = await fetchWithTimeout(SYNTHETIC_QUOTA_QUERY_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "OpenCode-Status-Plugin/1.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.syntheticApiError(response.status, errorText));
  }

  return response.json() as Promise<SyntheticQuotaResponse>;
}

function isValidCountQuota(
  quota: CountQuota | undefined,
): quota is CountQuota {
  return !!quota && typeof quota.limit === "number" && typeof quota.requests === "number";
}

function calcRemainPercent(limit: number, used: number): number {
  if (limit <= 0) return 0;
  const remain = Math.max(0, limit - used);
  const rawPercent = (remain / limit) * 100;
  let percent = Math.floor(rawPercent);

  // Avoid displaying 100% when there is any usage.
  if (used > 0 && remain > 0 && percent >= 100) {
    percent = 99;
  }

  return Math.max(0, Math.min(100, percent));
}

function formatSyntheticUsage(data: SyntheticQuotaResponse): string {
  const lines: string[] = [];
  const quotas: QuotaItem[] = [];

  if (data.rollingFiveHourLimit) {
    const limit = Math.max(0, data.rollingFiveHourLimit.max);
    const used = Math.max(0, limit - data.rollingFiveHourLimit.remaining);
    const remainPercent = calcRemainPercent(limit, used);

    quotas.push({
      label: t.syntheticFiveHourLimit,
      usedText: `${used} / ${limit}`,
      remainPercent,
      renewsAt: data.rollingFiveHourLimit.nextTickAt,
    });
  }

  if (data.weeklyTokenLimit) {
    const weekly = data.weeklyTokenLimit;
    const rawPercent = Math.max(0, Math.min(100, weekly.percentRemaining));
    const hasUsage = weekly.remainingCredits !== weekly.maxCredits;
    const remainPercent =
      hasUsage && rawPercent >= 100 ? 99 : Math.floor(rawPercent);

    quotas.push({
      label: t.syntheticWeeklyLimit,
      usedText: `${weekly.remainingCredits} / ${weekly.maxCredits}`,
      remainPercent,
      renewsAt: weekly.nextRegenAt,
    });
  }

  if (isValidCountQuota(data.search?.hourly)) {
    const limit = Math.max(0, data.search.hourly.limit);
    const used = Math.max(0, data.search.hourly.requests);
    const remainPercent = calcRemainPercent(limit, used);

    quotas.push({
      label: t.syntheticSearchLimit,
      usedText: `${used} / ${limit}`,
      remainPercent,
      renewsAt: data.search.hourly.renewsAt,
    });
  }

  if (quotas.length === 0) {
    lines.push(`${t.account}        Synthetic (API)`);
    lines.push("");
    lines.push(t.noQuotaData);
    return lines.join("\n");
  }

  lines.push(`${t.account}        Synthetic (API)`);
  lines.push("");

  for (const [index, quota] of quotas.entries()) {
    const progressBar = createProgressBar(quota.remainPercent);

    if (index > 0) lines.push("");
    lines.push(quota.label);
    lines.push(`${progressBar} ${t.remaining(quota.remainPercent)}`);
    lines.push(`${t.used}: ${quota.usedText}`);

    const renewAtDate = new Date(quota.renewsAt);
    if (!Number.isNaN(renewAtDate.getTime())) {
      const resetSeconds = Math.max(
        0,
        Math.floor((renewAtDate.getTime() - Date.now()) / 1000),
      );
      lines.push(
        `${t.quotaResets}: ${formatDuration(resetSeconds)} (${renewAtDate.toISOString()})`,
      );
    } else {
      lines.push(`${t.quotaResets}: ${quota.renewsAt}`);
    }

    if (quota.remainPercent <= 100 - HIGH_USAGE_THRESHOLD) {
      lines.push("");
      lines.push(t.limitReached);
    }
  }

  return lines.join("\n");
}

export async function querySyntheticUsage(
  authData: ZhipuAuthData | undefined,
): Promise<QueryResult | null> {
  if (!authData || authData.type !== "api" || !authData.key) {
    return null;
  }

  try {
    const usage = await fetchSyntheticUsage(authData.key);
    return {
      success: true,
      output: formatSyntheticUsage(usage),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
