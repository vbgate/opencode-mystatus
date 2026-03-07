/**
 * Claude (Anthropic) Usage Module — OAuth Rate Limit Headers
 *
 * [Input]: OAuth tokens from ~/.local/share/opencode/auth.json (anthropic key)
 * [Output]: Formatted rate limit usage (5h session + 7d weekly)
 * [Location]: Called by mystatus.ts to handle Claude/Anthropic accounts
 * [Sync]: mystatus.ts, types.ts, utils.ts, i18n.ts
 *
 * Uses OAuth rate-limit headers from the Anthropic Messages API:
 * - Makes a minimal API call with anthropic-beta: oauth-2025-04-20
 * - Parses anthropic-ratelimit-unified-5h/7d-utilization headers
 *
 * Works with Claude Pro/Max subscription accounts (OAuth tokens).
 * Falls back to Admin API for organization accounts (if admin key is configured).
 *
 * Reference: https://github.com/nsanden/claude-rate-monitor
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { t, currentLang } from "./i18n";
import {
  type QueryResult,
  type AnthropicAuthData,
  type ClaudeAdminConfig,
} from "./types";
import { fetchWithTimeout, formatDuration, createProgressBar } from "./utils";

// ============================================================================
// Constants
// ============================================================================

const ANTHROPIC_API_BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_BETA = "oauth-2025-04-20";
const PROBE_MODEL = "claude-haiku-4-5-20251001";

// OAuth refresh
const ANTHROPIC_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const ANTHROPIC_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

// Admin API fallback config path
const CLAUDE_ADMIN_CONFIG_PATH = path.join(
  os.homedir(),
  ".config",
  "opencode",
  "claude-admin-key.json",
);

// Rate limit header prefix
const RL_PREFIX = "anthropic-ratelimit-unified";

// ============================================================================
// Types
// ============================================================================

/** Parsed rate limit window (5h or 7d) */
interface RateLimitWindow {
  /** Usage fraction (0.0 to 1.0+, can exceed 1.0 on overage) */
  utilization: number;
  /** Remaining percent (0-100, clamped) */
  remainPercent: number;
  /** Reset time as Unix epoch seconds */
  resetEpoch: number;
  /** "active", "warning", or "rate_limited" */
  status: string;
}

/** Combined rate limit info from all headers */
interface RateLimitInfo {
  session5h: RateLimitWindow;
  weekly7d: RateLimitWindow;
  overallStatus: string;
  overageStatus: string;
}

// ============================================================================
// OAuth Token Refresh
// ============================================================================

/**
 * Refresh an expired OAuth access token.
 * Uses PKCE public client flow (no client_secret needed).
 */
async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: ANTHROPIC_CLIENT_ID,
  });

  const response = await fetchWithTimeout(ANTHROPIC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.claudeApiError(response.status, errorText));
  }

  return response.json();
}

/**
 * Get a valid access token, refreshing if expired.
 */
async function getValidAccessToken(
  authData: AnthropicAuthData,
): Promise<string> {
  if (!authData.access) {
    throw new Error(
      currentLang === "zh"
        ? "缺少 OAuth access token"
        : "Missing OAuth access token",
    );
  }

  // Check if token is expired (with 60s buffer)
  const isExpired = authData.expires && Date.now() > authData.expires - 60000;

  if (!isExpired) {
    return authData.access;
  }

  // Token expired — refresh
  if (!authData.refresh) {
    throw new Error(
      currentLang === "zh"
        ? "OAuth token 已过期且无 refresh token"
        : "OAuth token expired with no refresh token",
    );
  }

  const result = await refreshAccessToken(authData.refresh);
  return result.access_token;
}

// ============================================================================
// Rate Limit Probe
// ============================================================================

/**
 * Parse a single rate limit window from response headers.
 * @param headers Response headers
 * @param period "5h" or "7d"
 */
function parseWindow(headers: Headers, period: string): RateLimitWindow {
  const utilization = parseFloat(
    headers.get(`${RL_PREFIX}-${period}-utilization`) || "0",
  );
  return {
    utilization,
    remainPercent: Math.max(0, Math.round((1 - utilization) * 100)),
    resetEpoch: parseInt(
      headers.get(`${RL_PREFIX}-${period}-reset`) || "0",
      10,
    ),
    status: headers.get(`${RL_PREFIX}-${period}-status`) || "unknown",
  };
}

/**
 * Make a minimal API call to get rate limit headers.
 * Uses claude-haiku-4-5 (cheapest model, ~$0.001 per probe).
 */
async function probeRateLimits(accessToken: string): Promise<RateLimitInfo> {
  const response = await fetchWithTimeout(`${ANTHROPIC_API_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": ANTHROPIC_BETA,
    },
    body: JSON.stringify({
      model: PROBE_MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });

  // Rate limit headers are returned even on 429 responses
  if (!response.ok && response.status !== 429) {
    const errorText = await response.text();
    throw new Error(t.claudeApiError(response.status, errorText));
  }

  const h = response.headers;

  return {
    session5h: parseWindow(h, "5h"),
    weekly7d: parseWindow(h, "7d"),
    overallStatus: h.get(`${RL_PREFIX}-status`) || "unknown",
    overageStatus: h.get(`${RL_PREFIX}-overage-status`) || "unknown",
  };
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format reset time from epoch seconds to human-readable duration.
 */
function formatResetTime(epochSeconds: number): string {
  if (!epochSeconds || epochSeconds <= 0) return "-";

  const diffSeconds = epochSeconds - Math.floor(Date.now() / 1000);
  if (diffSeconds <= 0) return currentLang === "zh" ? "已重置" : "reset";

  return formatDuration(diffSeconds);
}

/**
 * Status indicator emoji for rate limit status.
 */
function statusIcon(status: string): string {
  switch (status) {
    case "rate_limited":
      return "🔴";
    case "warning":
      return "🟡";
    case "active":
      return "🟢";
    default:
      return "";
  }
}

/**
 * Format the OAuth rate limit output (subscription accounts).
 */
function formatOAuthOutput(info: RateLimitInfo): string {
  const lines: string[] = [];

  // Account info
  lines.push(
    `${t.account}        Claude (${currentLang === "zh" ? "订阅" : "Subscription"})`,
  );

  // 5-hour session window
  lines.push("");
  lines.push(t.claudeSessionLimit);
  lines.push(
    `${createProgressBar(info.session5h.remainPercent)} ${t.remaining(info.session5h.remainPercent)} ${statusIcon(info.session5h.status)}`,
  );
  lines.push(t.resetIn(formatResetTime(info.session5h.resetEpoch)));

  // 7-day weekly window
  lines.push("");
  lines.push(t.claudeWeeklyLimit);
  lines.push(
    `${createProgressBar(info.weekly7d.remainPercent)} ${t.remaining(info.weekly7d.remainPercent)} ${statusIcon(info.weekly7d.status)}`,
  );
  lines.push(t.resetIn(formatResetTime(info.weekly7d.resetEpoch)));

  // Overage / rate limited warning
  if (
    info.overageStatus === "active" ||
    info.overallStatus === "rate_limited"
  ) {
    lines.push("");
    lines.push(t.limitReached);
  }

  return lines.join("\n");
}

// ============================================================================
// Admin API Fallback (organization accounts)
// ============================================================================

/**
 * Read Claude admin API key from env var or config file.
 */
function getAdminApiKey(): string | null {
  const envKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (envKey?.trim()) return envKey.trim();

  try {
    if (!fs.existsSync(CLAUDE_ADMIN_CONFIG_PATH)) return null;
    const content = fs.readFileSync(CLAUDE_ADMIN_CONFIG_PATH, "utf-8");
    const config = JSON.parse(content) as ClaudeAdminConfig;
    return config.adminKey?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Query using Admin API (organization accounts only).
 */
async function queryAdminUsage(adminKey: string): Promise<QueryResult> {
  const now = new Date();
  const todayStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}T00:00:00Z`;
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStart = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}T00:00:00Z`;

  const params = new URLSearchParams({
    starting_at: todayStart,
    ending_at: tomorrowStart,
    bucket_width: "1d",
    "group_by[]": "model",
  });

  const response = await fetchWithTimeout(
    `${ANTHROPIC_API_BASE}/v1/organizations/usage_report/messages?${params}`,
    {
      method: "GET",
      headers: {
        "x-api-key": adminKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.claudeApiError(response.status, errorText));
  }

  return {
    success: true,
    output: `${t.account}        Anthropic (${currentLang === "zh" ? "组织" : "Organization"})\n\n${currentLang === "zh" ? "管理员 API 已连接" : "Admin API connected"}`,
  };
}

// ============================================================================
// Export Interface
// ============================================================================

/**
 * Query Claude (Anthropic) usage.
 *
 * Priority:
 * 1. OAuth tokens (from auth.json) — subscription accounts (Pro/Max)
 * 2. Admin API key (from env/config) — organization accounts
 * 3. null if neither is configured
 *
 * @param authData Anthropic OAuth data from auth.json
 */
export async function queryClaudeUsage(
  authData?: AnthropicAuthData,
): Promise<QueryResult | null> {
  // Priority 1: OAuth tokens (subscription accounts)
  if (authData?.type === "oauth" && (authData.access || authData.refresh)) {
    try {
      const accessToken = await getValidAccessToken(authData);
      const rateLimits = await probeRateLimits(accessToken);
      return {
        success: true,
        output: formatOAuthOutput(rateLimits),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Priority 2: Admin API key (organization accounts)
  const adminKey = getAdminApiKey();
  if (adminKey) {
    try {
      return await queryAdminUsage(adminKey);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // No auth configured — silently skip
  return null;
}
