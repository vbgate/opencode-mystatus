/**
 * Google Cloud 额度查询模块
 *
 * [输入]: ~/.config/opencode/antigravity-accounts.json 中的账号信息
 * [输出]: 格式化的额度使用情况（按重置时间自动分组）
 * [定位]: 被 mystatus.ts 调用，处理 Google Cloud 账号
 * [同步]: mystatus.ts, types.ts, utils.ts, i18n.ts
 */

import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import { t, currentLang } from "./i18n";
import {
  type QueryResult,
  type AntigravityAccount,
  type AntigravityAccountsFile,
  HIGH_USAGE_THRESHOLD,
} from "./types";
import { createProgressBar, fetchWithTimeout, safeMax } from "./utils";

// ============================================================================
// 类型定义
// ============================================================================

interface GoogleQuotaResponse {
  models: Record<
    string,
    {
      quotaInfo?: {
        remainingFraction?: number;
        resetTime?: string;
      };
    }
  >;
}

/** 单个模型的额度信息 */
interface ModelQuota {
  displayName: string;
  remainPercent: number;
  resetTimeDisplay: string;
}

/** 账号额度信息 */
interface AccountQuotaInfo {
  email: string;
  models: ModelQuota[];
  maxUsage: number;
}

/** 模型配置 */
interface ModelConfig {
  key: string;
  altKey?: string;
  display: string;
}

// ============================================================================
// 常量
// ============================================================================

const GOOGLE_QUOTA_API_URL =
  "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";
const USER_AGENT = "antigravity/1.11.9 windows/amd64";

// 需要显示的 4 个模型配置
const MODELS_TO_DISPLAY: ModelConfig[] = [
  { key: "gemini-3-pro-high", altKey: "gemini-3-pro-low", display: "G3 Pro" },
  { key: "gemini-3-pro-image", display: "G3 Image" },
  { key: "gemini-3-flash", display: "G3 Flash" },
  {
    key: "claude-opus-4-5-thinking",
    altKey: "claude-opus-4-5",
    display: "Claude",
  },
];

// 获取 Antigravity 账号文件路径
function getAntigravityAccountsPath(): string {
  const home = homedir();
  const configDir =
    process.platform === "win32"
      ? process.env.APPDATA || join(home, "AppData", "Roaming")
      : join(home, ".config");
  return join(configDir, "opencode", "antigravity-accounts.json");
}

const GOOGLE_TOKEN_REFRESH_URL = "https://oauth2.googleapis.com/token";

// OAuth credentials from opencode-antigravity-auth project
// Source: https://github.com/NoeFabris/opencode-antigravity-auth
const GOOGLE_CLIENT_ID =
  "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化重置时间为简短显示（如 "4h 59m"）
 */
function formatResetTimeShort(isoTime: string): string {
  if (!isoTime) return "-";

  try {
    const resetDate = new Date(isoTime);
    const now = new Date();

    const diffMs = resetDate.getTime() - now.getTime();
    if (diffMs <= 0) return currentLang === "zh" ? "已重置" : "reset";

    const diffMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(diffMinutes / 1440);
    const hours = Math.floor((diffMinutes % 1440) / 60);
    const minutes = diffMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  } catch {
    return "-";
  }
}

/**
 * 从 API 响应中提取 4 个模型的额度信息
 */
function extractModelQuotas(data: GoogleQuotaResponse): ModelQuota[] {
  const quotas: ModelQuota[] = [];

  for (const modelConfig of MODELS_TO_DISPLAY) {
    let modelInfo = data.models[modelConfig.key];

    // 如果主 key 没有数据，尝试 altKey
    if (!modelInfo && modelConfig.altKey) {
      modelInfo = data.models[modelConfig.altKey];
    }

    // 只要模型存在就显示（即使没有 quotaInfo 或额度为 0）
    if (modelInfo) {
      const remainingFraction = modelInfo.quotaInfo?.remainingFraction ?? 0;
      quotas.push({
        displayName: modelConfig.display,
        remainPercent: Math.round(remainingFraction * 100),
        resetTimeDisplay: formatResetTimeShort(
          modelInfo.quotaInfo?.resetTime || "",
        ),
      });
    }
  }

  return quotas;
}

/**
 * 刷新 Google access token
 */
async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.googleApiError(response.status, errorText));
  }

  return response.json();
}

// ============================================================================
// API 调用
// ============================================================================

/**
 * 获取 Google Cloud 使用情况
 */
async function fetchGoogleUsage(
  accessToken: string,
  projectId: string,
): Promise<GoogleQuotaResponse> {
  const response = await fetchWithTimeout(GOOGLE_QUOTA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ project: projectId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t.googleApiError(response.status, errorText));
  }

  return response.json() as Promise<GoogleQuotaResponse>;
}

/**
 * 查询单个账号的额度
 */
async function fetchAccountQuota(
  account: AntigravityAccount,
): Promise<{
  success: boolean;
  models?: ModelQuota[];
  maxUsage?: number;
  error?: string;
}> {
  try {
    // 刷新 access token
    const { access_token } = await refreshAccessToken(account.refreshToken);

    // 使用 projectId 或 managedProjectId
    const projectId = account.projectId || account.managedProjectId;
    if (!projectId) {
      return { success: false, error: t.googleNoProjectId };
    }

    // 查询额度
    const data = await fetchGoogleUsage(access_token, projectId);

    // 提取 4 个模型的额度
    const models = extractModelQuotas(data);

    if (models.length === 0) {
      return { success: true, models: undefined, maxUsage: 0 };
    }

    // 计算最大使用率
    const maxUsage = safeMax(models.map((m) => 100 - m.remainPercent));

    return { success: true, models, maxUsage };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// 格式化输出
// ============================================================================

/**
 * 格式化单个账号的额度（4 个模型分别显示）
 */
function formatAccountQuota(quotaInfo: AccountQuotaInfo): string {
  const lines: string[] = [];

  // 标题行
  lines.push(`### ${quotaInfo.email}`);

  if (quotaInfo.models.length === 0) {
    lines.push("");
    lines.push(t.noQuotaData);
    return lines.join("\n");
  }

  lines.push("");

  // 每个模型一行：模型名 | 重置时间 | 百分比
  for (const model of quotaInfo.models) {
    const progressBar = createProgressBar(model.remainPercent, 20);
    lines.push(
      `${model.displayName.padEnd(10)} ${model.resetTimeDisplay.padEnd(10)} ${progressBar} ${model.remainPercent}%`,
    );
  }

  // 警告
  if (quotaInfo.maxUsage >= HIGH_USAGE_THRESHOLD) {
    lines.push("");
    lines.push(t.limitReached);
  }

  return lines.join("\n");
}

// ============================================================================
// 导出接口
// ============================================================================

/**
 * 查询所有 Antigravity 账号的额度
 * @returns 查询结果
 */
export async function queryGoogleUsage(): Promise<QueryResult> {
  try {
    // 读取账号文件
    const content = await readFile(getAntigravityAccountsPath(), "utf-8");
    const file = JSON.parse(content) as AntigravityAccountsFile;

    if (!file.accounts || file.accounts.length === 0) {
      return {
        success: true,
        output: t.noQuotaData,
      };
    }

    // 过滤掉没有邮箱的账号
    const validAccounts = file.accounts.filter((account) => account.email);

    if (validAccounts.length === 0) {
      return {
        success: true,
        output: t.noQuotaData,
      };
    }

    // 并行查询所有账号
    const results = await Promise.all(
      validAccounts.map((account: AntigravityAccount) =>
        fetchAccountQuota(account).then(
          (result) => ({ account, result }) as const,
        ),
      ),
    );

    // 收集输出
    const outputs: string[] = [];

    for (const { account, result } of results) {
      if (!result.success) {
        outputs.push(`${account.email || t.unknown}: ${result.error}`);
      } else if (result.models && result.models.length > 0) {
        const quotaInfo: AccountQuotaInfo = {
          email: account.email || t.unknown,
          models: result.models,
          maxUsage: result.maxUsage || 0,
        };
        outputs.push(formatAccountQuota(quotaInfo));
      }
    }

    // 如果没有符合条件的账号
    if (outputs.length === 0) {
      return {
        success: true,
        output: t.noQuotaData,
      };
    }

    return {
      success: true,
      output: outputs.join("\n\n"),
    };
  } catch (err) {
    // 文件不存在表示用户未配置 Google 账号，静默跳过
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return { success: true, output: "" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
