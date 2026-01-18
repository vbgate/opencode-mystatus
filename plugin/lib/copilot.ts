/**
 * GitHub Copilot Premium Requests Quota Module
 *
 * [Input]: GitHub token from ~/.local/share/opencode/auth.json (github-copilot provider)
 * [Output]: Formatted quota usage information with progress bars
 * [Location]: Called by mystatus.ts to handle GitHub Copilot accounts
 * [Sync]: mystatus.ts, types.ts, utils.ts, i18n.ts
 *
 * [Updated]: Jan 2026 - Handle new OpenCode official partnership auth flow
 * The new OAuth tokens (gho_) need to be exchanged for Copilot session tokens
 * before calling the internal quota API.
 */

import { t } from "./i18n";
import {
  type QueryResult,
  type CopilotAuthData,
  type CopilotQuotaConfig,
  type CopilotTier,
} from "./types";
import { createProgressBar, fetchWithTimeout } from "./utils";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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

interface CopilotTokenResponse {
  token: string;
  expires_at: number;
  refresh_in: number;
  endpoints: {
    api: string;
  };
}

// Public Billing API response types
interface BillingUsageItem {
  product: string;
  sku: string;
  model?: string;
  unitType: string;
  grossQuantity: number;
  netQuantity: number;
  limit?: number;
}

interface BillingUsageResponse {
  timePeriod: { year: number; month?: number };
  user: string;
  usageItems: BillingUsageItem[];
}

// ============================================================================
// Constants
// ============================================================================

const GITHUB_API_BASE_URL = "https://api.github.com";
const COPILOT_API_BASE_URL = "https://api.githubcopilot.com";

// Config file path for user's fine-grained PAT
const COPILOT_QUOTA_CONFIG_PATH = path.join(
  os.homedir(),
  ".config",
  "opencode",
  "copilot-quota-token.json",
);

// Updated to match current VS Code Copilot extension version
const COPILOT_VERSION = "0.35.0";
const EDITOR_VERSION = "vscode/1.107.0";
const EDITOR_PLUGIN_VERSION = `copilot-chat/${COPILOT_VERSION}`;
const USER_AGENT = `GitHubCopilotChat/${COPILOT_VERSION}`;

// Headers matching opencode-copilot-auth plugin (required for token exchange)
const COPILOT_HEADERS = {
  "User-Agent": USER_AGENT,
  "Editor-Version": EDITOR_VERSION,
  "Editor-Plugin-Version": EDITOR_PLUGIN_VERSION,
  "Copilot-Integration-Id": "vscode-chat",
};

// ============================================================================
// Token Exchange (New auth flow for official OpenCode partnership)
// ============================================================================

/**
 * Read optional Copilot quota config from user's config file
 * Returns null if file doesn't exist or is invalid
 */
function readQuotaConfig(): CopilotQuotaConfig | null {
  try {
    if (!fs.existsSync(COPILOT_QUOTA_CONFIG_PATH)) {
      return null;
    }
    const content = fs.readFileSync(COPILOT_QUOTA_CONFIG_PATH, "utf-8");
    const config = JSON.parse(content) as CopilotQuotaConfig;

    // Validate required fields
    if (!config.token || !config.username || !config.tier) {
      return null;
    }

    // Validate tier is valid
    const validTiers: CopilotTier[] = [
      "free",
      "pro",
      "pro+",
      "business",
      "enterprise",
    ];
    if (!validTiers.includes(config.tier)) {
      return null;
    }

    return config;
  } catch {
    return null;
  }
}

/**
 * Fetch quota using the public GitHub REST API
 * Requires a fine-grained PAT with "Plan" read permission
 */
async function fetchPublicBillingUsage(
  config: CopilotQuotaConfig,
): Promise<BillingUsageResponse> {
  const response = await fetchWithTimeout(
    `${GITHUB_API_BASE_URL}/users/${config.username}/settings/billing/premium_request/usage`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.copilotApiError(response.status, errorText));
  }

  return response.json() as Promise<BillingUsageResponse>;
}

/**
 * Exchange OAuth token for a Copilot session token
 * Required for the new OpenCode official partnership auth flow (Jan 2026+)
 */
async function exchangeForCopilotToken(
  oauthToken: string,
): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      `${GITHUB_API_BASE_URL}/copilot_internal/v2/token`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${oauthToken}`,
          ...COPILOT_HEADERS,
        },
      },
    );

    if (!response.ok) {
      // Token exchange failed - might be old token format or API change
      return null;
    }

    const tokenData: CopilotTokenResponse = await response.json();
    return tokenData.token;
  } catch {
    return null;
  }
}

// ============================================================================
// API Call
// ============================================================================

/**
 * Build headers for GitHub API requests (quota endpoint)
 */
function buildGitHubHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...COPILOT_HEADERS,
  };
}

/**
 * Build headers for legacy token format
 */
function buildLegacyHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `token ${token}`,
    ...COPILOT_HEADERS,
  };
}

/**
 * Fetch GitHub Copilot usage data
 * Tries multiple authentication methods to handle both old and new token formats
 */
async function fetchCopilotUsage(
  authData: CopilotAuthData,
): Promise<CopilotUsageResponse> {
  // Use refresh token as the OAuth token (required)
  // In new auth flow, access === refresh (both are the OAuth token)
  const oauthToken = authData.refresh || authData.access;
  if (!oauthToken) {
    throw new Error("No OAuth token found in auth data");
  }

  const cachedAccessToken = authData.access;
  const tokenExpiry = authData.expires || 0;

  // Strategy 1: If we have a valid cached access token (from previous exchange), use it
  if (
    cachedAccessToken &&
    cachedAccessToken !== oauthToken &&
    tokenExpiry > Date.now()
  ) {
    const response = await fetchWithTimeout(
      `${GITHUB_API_BASE_URL}/copilot_internal/user`,
      { headers: buildGitHubHeaders(cachedAccessToken) },
    );

    if (response.ok) {
      return response.json() as Promise<CopilotUsageResponse>;
    }
  }

  // Strategy 2: Try direct call with OAuth token (works with older token formats)
  const directResponse = await fetchWithTimeout(
    `${GITHUB_API_BASE_URL}/copilot_internal/user`,
    { headers: buildLegacyHeaders(oauthToken) },
  );

  if (directResponse.ok) {
    return directResponse.json() as Promise<CopilotUsageResponse>;
  }

  // Strategy 3: Exchange OAuth token for Copilot session token (new auth flow)
  const copilotToken = await exchangeForCopilotToken(oauthToken);

  if (copilotToken) {
    const exchangedResponse = await fetchWithTimeout(
      `${GITHUB_API_BASE_URL}/copilot_internal/user`,
      { headers: buildGitHubHeaders(copilotToken) },
    );

    if (exchangedResponse.ok) {
      return exchangedResponse.json() as Promise<CopilotUsageResponse>;
    }

    const errorText = await exchangedResponse.text();
    throw new Error(t.copilotApiError(exchangedResponse.status, errorText));
  }

  // All strategies failed - likely due to OpenCode's OAuth token lacking copilot scope
  // The new OpenCode partnership uses a different OAuth client that doesn't grant
  // access to the /copilot_internal/* endpoints
  throw new Error(
    t.copilotQuotaUnavailable + "\n\n" + t.copilotQuotaWorkaround,
  );
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
  width: number = 20,
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

// Copilot plan limits (premium requests per month)
// Source: https://docs.github.com/en/copilot/about-github-copilot/subscription-plans-for-github-copilot
const COPILOT_PLAN_LIMITS: Record<CopilotTier, number> = {
  free: 50, // Copilot Free: 50 premium requests/month
  pro: 300, // Copilot Pro: 300 premium requests/month
  "pro+": 1500, // Copilot Pro+: 1500 premium requests/month
  business: 300, // Copilot Business: 300 premium requests/month
  enterprise: 1000, // Copilot Enterprise: 1000 premium requests/month
};

/**
 * Format public billing API response
 * Different structure from internal API - aggregates usage items
 * Uses grossQuantity (total requests made) since netQuantity shows post-discount amount
 */
function formatPublicBillingUsage(
  data: BillingUsageResponse,
  tier: CopilotTier,
): string {
  const lines: string[] = [];

  // Account info
  lines.push(`${t.account}        GitHub Copilot (@${data.user})`);
  lines.push("");

  // Aggregate all premium request usage (sum grossQuantity across all models)
  const premiumItems = data.usageItems.filter(
    (item) =>
      item.sku === "Copilot Premium Request" || item.sku.includes("Premium"),
  );

  const totalUsed = premiumItems.reduce(
    (sum, item) => sum + item.grossQuantity,
    0,
  );

  // Get limit from tier
  const limit = COPILOT_PLAN_LIMITS[tier];

  const remaining = Math.max(0, limit - totalUsed);
  const percentRemaining = Math.round((remaining / limit) * 100);
  const progressBar = createProgressBar(percentRemaining, 20);
  lines.push(
    `${t.premiumRequests.padEnd(14)} ${progressBar} ${percentRemaining}% (${totalUsed}/${limit})`,
  );

  // Show model breakdown
  const modelItems = data.usageItems.filter(
    (item) => item.model && item.grossQuantity > 0,
  );

  if (modelItems.length > 0) {
    lines.push("");
    lines.push(t.modelBreakdown || "Model breakdown:");
    // Sort by usage descending
    const sortedItems = [...modelItems].sort(
      (a, b) => b.grossQuantity - a.grossQuantity,
    );
    for (const item of sortedItems.slice(0, 5)) {
      // Show top 5 models
      lines.push(`  ${item.model}: ${item.grossQuantity} ${item.unitType}`);
    }
  }

  // Time period info
  lines.push("");
  const period = data.timePeriod;
  const periodStr = period.month
    ? `${period.year}-${String(period.month).padStart(2, "0")}`
    : `${period.year}`;
  lines.push(`${t.billingPeriod || "Period"}: ${periodStr}`);

  return lines.join("\n");
}

// ============================================================================
// Export Interface
// ============================================================================

export type { CopilotAuthData };

/**
 * Query GitHub Copilot account quota
 * @param authData GitHub Copilot authentication data (optional if using PAT config)
 * @returns Query result, null if no account configured
 */
export async function queryCopilotUsage(
  authData: CopilotAuthData | undefined,
): Promise<QueryResult | null> {
  // Strategy 1: Try public billing API with user's fine-grained PAT
  const quotaConfig = readQuotaConfig();
  if (quotaConfig) {
    try {
      const billingUsage = await fetchPublicBillingUsage(quotaConfig);
      return {
        success: true,
        output: formatPublicBillingUsage(billingUsage, quotaConfig.tier),
      };
    } catch (err) {
      // PAT config exists but failed - report the error
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Strategy 2: Try internal API with OAuth token (legacy, may not work with new OpenCode auth)
  // Check if account exists and has a refresh token (the GitHub OAuth token)
  if (!authData || authData.type !== "oauth" || !authData.refresh) {
    // No auth data and no PAT config - show setup instructions
    return {
      success: false,
      error: t.copilotQuotaUnavailable + "\n\n" + t.copilotQuotaWorkaround,
    };
  }

  try {
    const usage = await fetchCopilotUsage(authData);
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
