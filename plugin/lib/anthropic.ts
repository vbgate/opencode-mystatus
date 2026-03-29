import { t } from "./i18n";
import { type AnthropicAuthData, type QueryResult } from "./types";
import {
  calcRemainPercent,
  createProgressBar,
  fetchWithTimeout,
  formatDuration,
  getResetAfterSeconds,
} from "./utils";

interface AnthropicUsageWindow {
  utilization: number;
  resets_at?: string;
}

interface AnthropicExtraUsage {
  is_enabled?: boolean;
  used_credits?: number;
  monthly_limit?: number;
}

interface AnthropicUsageResponse {
  five_hour?: AnthropicUsageWindow;
  seven_day?: AnthropicUsageWindow;
  extra_usage?: AnthropicExtraUsage;
}

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const ANTHROPIC_BETA = "oauth-2025-04-20";

function formatCredits(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatWindow(
  title: string,
  window: AnthropicUsageWindow | undefined,
): string[] {
  if (!window)
    return [];

  const remainPercent = calcRemainPercent(window.utilization);
  const progressBar = createProgressBar(remainPercent);
  const lines = [title, `${progressBar} ${t.remaining(remainPercent)}`];
  const resetAfterSeconds = getResetAfterSeconds(window.resets_at);

  if (resetAfterSeconds !== null) {
    lines.push(t.resetIn(formatDuration(resetAfterSeconds)));
  }

  return lines;
}

async function fetchAnthropicUsage(
  accessToken: string,
): Promise<AnthropicUsageResponse> {
  const response = await fetchWithTimeout(ANTHROPIC_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "anthropic-beta": ANTHROPIC_BETA,
      "Content-Type": "application/json",
      "User-Agent": "OpenCode-Status-Plugin/1.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.anthropicApiError(response.status, errorText));
  }

  return response.json() as Promise<AnthropicUsageResponse>;
}

function formatAnthropicUsage(data: AnthropicUsageResponse): string {
  const lines: string[] = [];

  lines.push(`${t.account}        ${t.anthropicAccountName}`);

  const fiveHourLines = formatWindow(t.fiveHourLimit, data.five_hour);
  const sevenDayLines = formatWindow(t.sevenDayLimit, data.seven_day);

  if (fiveHourLines.length > 0) {
    lines.push("");
    lines.push(...fiveHourLines);
  }

  if (sevenDayLines.length > 0) {
    lines.push("");
    lines.push(...sevenDayLines);
  }

  if (data.extra_usage?.is_enabled && data.extra_usage.monthly_limit) {
    lines.push("");
    lines.push(
      `${t.extraUsage}: ${formatCredits(data.extra_usage.used_credits || 0)} / ${formatCredits(data.extra_usage.monthly_limit)}`,
    );
  }

  if (lines.length === 1) {
    lines.push("");
    lines.push(t.noQuotaData);
  }

  return lines.join("\n");
}

export async function queryAnthropicUsage(
  authData: AnthropicAuthData | undefined,
): Promise<QueryResult | null> {
  if (!authData || authData.type !== "oauth" || !authData.access) {
    return null;
  }

  if (authData.expires && authData.expires < Date.now()) {
    return {
      success: false,
      error: t.anthropicTokenExpired,
    };
  }

  try {
    const usage = await fetchAnthropicUsage(authData.access);
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
