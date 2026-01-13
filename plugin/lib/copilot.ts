/**
 * GitHub Copilot Premium Requests Quota Module
 *
 * [Input]: GitHub token from ~/.local/share/opencode/auth.json (github-copilot provider)
 * [Output]: Formatted quota usage information with progress bars
 * [Location]: Called by mystatus.ts to handle GitHub Copilot accounts
 * [Sync]: mystatus.ts, types.ts, utils.ts, i18n.ts
 */

import { t } from "./i18n";
import { type QueryResult, type CopilotAuthData } from "./types";
import { createProgressBar, fetchWithTimeout, maskString } from "./utils";

// ============================================================================
// Type Definitions
// ============================================================================

interface QuotaDetail {
  entitlement: number;
  overage_count: number;
  overage_permitted: boolean;
  percent_remaining: number;
  quota_id: string;
  quota_remaining: number;
  remaining: number;
  unlimited: boolean;
}

interface QuotaSnapshots {
  chat?: QuotaDetail;
  completions?: QuotaDetail;
  premium_interactions: QuotaDetail;
}

interface CopilotUsageResponse {
  access_type_sku: string;
  analytics_tracking_id: string;
  assigned_date: string;
  can_signup_for_limited: boolean;
  chat_enabled: boolean;
  copilot_plan: string;
  organization_login_list: unknown[];
  organization_list: unknown[];
  quota_reset_date: string;
  quota_snapshots: QuotaSnapshots;
}

// ============================================================================
// Constants
// ============================================================================

const GITHUB_API_BASE_URL = "https://api.github.com";
const COPILOT_VERSION = "0.26.7";
const EDITOR_PLUGIN_VERSION = `copilot-chat/${COPILOT_VERSION}`;
const USER_AGENT = `GitHubCopilotChat/${COPILOT_VERSION}`;
const API_VERSION = "2025-04-01";

// ============================================================================
// API Call
// ============================================================================

/**
 * Build headers for GitHub API requests
 */
function buildGitHubHeaders(token: string): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `token ${token}`,
    "editor-version": "vscode/1.96.0",
    "editor-plugin-version": EDITOR_PLUGIN_VERSION,
    "user-agent": USER_AGENT,
    "x-github-api-version": API_VERSION,
    "x-vscode-user-agent-library-version": "electron-fetch",
  };
}

/**
 * Fetch GitHub Copilot usage data
 */
async function fetchCopilotUsage(
  token: string
): Promise<CopilotUsageResponse> {
  const response = await fetchWithTimeout(
    `${GITHUB_API_BASE_URL}/copilot_internal/user`,
    {
      headers: buildGitHubHeaders(token),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.copilotApiError(response.status, errorText));
  }

  return response.json() as Promise<CopilotUsageResponse>;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a single quota line
 */
function formatQuotaLine(
  name: string,
  quota: QuotaDetail | undefined,
  width: number = 20
): string {
  if (!quota) return "";

  if (quota.unlimited) {
    return `${name.padEnd(14)} Unlimited`;
  }

  const total = quota.entitlement;
  const used = total - quota.remaining;
  const percentRemaining = Math.round(quota.percent_remaining);
  const progressBar = createProgressBar(percentRemaining, width);

  return `${name.padEnd(14)} ${progressBar} ${percentRemaining}% (${used}/${total})`;
}

/**
 * Calculate days until reset
 */
function getResetCountdown(resetDate: string): string {
  const reset = new Date(resetDate);
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();

  if (diffMs <= 0) return t.resetsSoon;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h`;
}

/**
 * Format GitHub Copilot usage information
 */
function formatCopilotUsage(data: CopilotUsageResponse): string {
  const lines: string[] = [];

  // Account info
  lines.push(`${t.account}        GitHub Copilot (${data.copilot_plan})`);
  lines.push("");

  // Premium requests (main quota)
  const premium = data.quota_snapshots.premium_interactions;
  if (premium) {
    const premiumLine = formatQuotaLine(t.premiumRequests, premium);
    if (premiumLine) lines.push(premiumLine);

    // Show overage info if applicable
    if (premium.overage_count > 0) {
      lines.push(`${t.overage}: ${premium.overage_count} ${t.overageRequests}`);
    }
  }

  // Chat quota (if separate)
  const chat = data.quota_snapshots.chat;
  if (chat && !chat.unlimited) {
    const chatLine = formatQuotaLine(t.chatQuota, chat);
    if (chatLine) lines.push(chatLine);
  }

  // Completions quota (if separate)
  const completions = data.quota_snapshots.completions;
  if (completions && !completions.unlimited) {
    const completionsLine = formatQuotaLine(t.completionsQuota, completions);
    if (completionsLine) lines.push(completionsLine);
  }

  // Reset date
  lines.push("");
  const resetCountdown = getResetCountdown(data.quota_reset_date);
  lines.push(`${t.quotaResets}: ${resetCountdown} (${data.quota_reset_date})`);

  return lines.join("\n");
}

// ============================================================================
// Export Interface
// ============================================================================

export type { CopilotAuthData };

/**
 * Query GitHub Copilot account quota
 * @param authData GitHub Copilot authentication data
 * @returns Query result, null if account doesn't exist or is invalid
 */
export async function queryCopilotUsage(
  authData: CopilotAuthData | undefined
): Promise<QueryResult | null> {
  // Check if account exists and has a refresh token (the GitHub OAuth token)
  if (!authData || authData.type !== "oauth" || !authData.refresh) {
    return null;
  }

  try {
    const usage = await fetchCopilotUsage(authData.refresh);
    return {
      success: true,
      output: formatCopilotUsage(usage),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
