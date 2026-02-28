/**
 * 国际化模块
 *
 * [输入]: 系统语言环境
 * [输出]: 翻译函数和当前语言
 * [定位]: 被所有平台模块共享使用
 * [同步]: openai.ts, zhipu.ts, mystatus.ts, utils.ts
 */

// ============================================================================
// 类型定义
// ============================================================================

export type Language = "zh" | "zh-tw" | "en";

// ============================================================================
// 语言检测
// ============================================================================

/**
 * 检测用户系统语言
 * 优先使用 Intl API，回退到环境变量，默认英文
 */
function detectLanguage(): Language {
  // 1. 优先使用 Intl API（更可靠）
  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale.startsWith("zh-TW") || intlLocale.startsWith("zh-Hant")) return "zh-tw";
    if (intlLocale.startsWith("zh")) return "zh";
  } catch {
    // Intl API 不可用，继续尝试环境变量
  }

  // 2. 回退到环境变量
  const lang =
    process.env.LANG || process.env.LC_ALL || process.env.LANGUAGE || "";
  if (lang.startsWith("zh_TW") || lang.startsWith("zh_HK")) return "zh-tw";
  if (lang.startsWith("zh")) return "zh";

  // 3. 默认英文
  return "en";
}

// ============================================================================
// 翻译定义
// ============================================================================

const translations = {
  zh: {
    // 时间单位
    days: (n: number) => `${n}天`,
    hours: (n: number) => `${n}小时`,
    minutes: (n: number) => `${n}分钟`,

    // 限额相关
    hourLimit: (h: number) => `${h}小时限额`,
    dayLimit: (d: number) => `${d}天限额`,
    remaining: (p: number) => `剩余 ${p}%`,
    resetIn: (t: string) => `重置: ${t}后`,
    limitReached: "⚠️ 已达到限额上限!",

    // 通用
    account: "Account:",
    unknown: "未知",
    used: "已用",

    // 错误信息
    authError: (path: string, err: string) =>
      `❌ 无法读取认证文件: ${path}\n错误: ${err}`,
    apiError: (status: number, text: string) =>
      `OpenAI API 请求失败 (${status}): ${text}`,
    timeoutError: (seconds: number) => `请求超时 (${seconds}秒)`,
    tokenExpired:
      "⚠️ OAuth 授权已过期，请在 OpenCode 中使用一次 OpenAI 模型以刷新授权。",
    noAccounts:
      "未找到任何已配置的账号。\n\n支持的账号类型:\n- OpenAI (Plus/Team/Pro 订阅用户)\n- 智谱 AI (Coding Plan)\n- Z.ai (Coding Plan)\n- Google Cloud (Antigravity)",
    queryFailed: "❌ 查询失败的账号:\n",

    // 平台标题
    openaiTitle: "## OpenAI 账号额度",
    zhipuTitle: "## 智谱 AI 账号额度",
    zaiTitle: "## Z.ai 账号额度",

    // 智谱 AI 相关
    zhipuApiError: (status: number, text: string) =>
      `智谱 API 请求失败 (${status}): ${text}`,
    zaiApiError: (status: number, text: string) =>
      `Z.ai API 请求失败 (${status}): ${text}`,
    zhipuTokensLimit: "5 小时 Token 限额",
    zhipuMcpLimit: "MCP 月度配额",
    zhipuAccountName: "Coding Plan",
    zaiAccountName: "Z.ai",
    noQuotaData: "暂无配额数据",

    // Google 相关
    googleTitle: "## Google Cloud 账号额度",
    googleApiError: (status: number, text: string) =>
      `Google API 请求失败 (${status}): ${text}`,
    googleNoProjectId: "⚠️ 缺少 project_id，无法查询额度。",

    // GitHub Copilot 相关
    copilotTitle: "## GitHub Copilot 账号额度",
    copilotApiError: (status: number, text: string) =>
      `GitHub Copilot API 请求失败 (${status}): ${text}`,
    premiumRequests: "Premium",
    chatQuota: "Chat",
    completionsQuota: "Completions",
    overage: "超额使用",
    overageRequests: "次请求",
    quotaResets: "配额重置",
    resetsSoon: "即将重置",
    modelBreakdown: "模型使用明细:",
    billingPeriod: "计费周期",
    copilotQuotaUnavailable:
      "⚠️ GitHub Copilot 配额查询暂时不可用。\n" +
      "OpenCode 的新 OAuth 集成不支持访问配额 API。",
    copilotQuotaWorkaround:
      "解决方案:\n" +
      "1. 创建一个 fine-grained PAT (访问 https://github.com/settings/tokens?type=beta)\n" +
      "2. 在 'Account permissions' 中将 'Plan' 设为 'Read-only'\n" +
      "3. 创建配置文件 ~/.config/opencode/copilot-quota-token.json:\n" +
      '   {"token": "github_pat_xxx...", "username": "你的用户名"}\n\n' +
      "其他方法:\n" +
      "• 在 VS Code 中点击状态栏的 Copilot 图标查看配额\n" +
      "• 访问 https://github.com/settings/billing 查看使用情况",
  },
  "zh-tw": {
    // 時間單位
    days: (n: number) => `${n}天`,
    hours: (n: number) => `${n}小時`,
    minutes: (n: number) => `${n}分鐘`,

    // 限額相關
    hourLimit: (h: number) => `${h}小時限額`,
    dayLimit: (d: number) => `${d}天限額`,
    remaining: (p: number) => `剩餘 ${p}%`,
    resetIn: (t: string) => `重置: ${t}後`,
    limitReached: "⚠️ 已達到限額上限!",

    // 通用
    account: "Account:",
    unknown: "未知",
    used: "已用",

    // 錯誤訊息
    authError: (path: string, err: string) =>
      `❌ 無法讀取認證檔案: ${path}\n錯誤: ${err}`,
    apiError: (status: number, text: string) =>
      `OpenAI API 請求失敗 (${status}): ${text}`,
    timeoutError: (seconds: number) => `請求逾時 (${seconds}秒)`,
    tokenExpired:
      "⚠️ OAuth 授權已過期，請在 OpenCode 中使用一次 OpenAI 模型以重新整理授權。",
    noAccounts:
      "未找到任何已設定的帳號。\n\n支援的帳號類型:\n- OpenAI (Plus/Team/Pro 訂閱用戶)\n- 智譜 AI (Coding Plan)\n- Z.ai (Coding Plan)\n- Google Cloud (Antigravity)",
    queryFailed: "❌ 查詢失敗的帳號:\n",

    // 平台標題
    openaiTitle: "## OpenAI 帳號額度",
    zhipuTitle: "## 智譜 AI 帳號額度",
    zaiTitle: "## Z.ai 帳號額度",

    // 智譜 AI 相關
    zhipuApiError: (status: number, text: string) =>
      `智譜 API 請求失敗 (${status}): ${text}`,
    zaiApiError: (status: number, text: string) =>
      `Z.ai API 請求失敗 (${status}): ${text}`,
    zhipuTokensLimit: "5 小時 Token 限額",
    zhipuMcpLimit: "MCP 月度配額",
    zhipuAccountName: "Coding Plan",
    zaiAccountName: "Z.ai",
    noQuotaData: "暫無配額資料",

    // Google 相關
    googleTitle: "## Google Cloud 帳號額度",
    googleApiError: (status: number, text: string) =>
      `Google API 請求失敗 (${status}): ${text}`,
    googleNoProjectId: "⚠️ 缺少 project_id，無法查詢額度。",

    // GitHub Copilot 相關
    copilotTitle: "## GitHub Copilot 帳號額度",
    copilotApiError: (status: number, text: string) =>
      `GitHub Copilot API 請求失敗 (${status}): ${text}`,
    premiumRequests: "Premium",
    chatQuota: "Chat",
    completionsQuota: "Completions",
    overage: "超額使用",
    overageRequests: "次請求",
    quotaResets: "配額重置",
    resetsSoon: "即將重置",
    modelBreakdown: "模型使用明細:",
    billingPeriod: "計費週期",
    copilotQuotaUnavailable:
      "⚠️ GitHub Copilot 配額查詢暫時不可用。\n" +
      "OpenCode 的新 OAuth 整合不支援存取配額 API。",
    copilotQuotaWorkaround:
      "解決方案:\n" +
      "1. 建立一個 fine-grained PAT (前往 https://github.com/settings/tokens?type=beta)\n" +
      "2. 在 'Account permissions' 中將 'Plan' 設為 'Read-only'\n" +
      "3. 建立設定檔 ~/.config/opencode/copilot-quota-token.json:\n" +
      '   {"token": "github_pat_xxx...", "username": "你的使用者名稱"}\n\n' +
      "其他方法:\n" +
      "• 在 VS Code 中點擊狀態列的 Copilot 圖示查看配額\n" +
      "• 前往 https://github.com/settings/billing 查看使用情況",
  },
  en: {
    // 时间单位
    days: (n: number) => `${n}d`,
    hours: (n: number) => `${n}h`,
    minutes: (n: number) => `${n}m`,

    // 限额相关
    hourLimit: (h: number) => `${h}-hour limit`,
    dayLimit: (d: number) => `${d}-day limit`,
    remaining: (p: number) => `${p}% remaining`,
    resetIn: (t: string) => `Resets in: ${t}`,
    limitReached: "⚠️ Rate limit reached!",

    // 通用
    account: "Account:",
    unknown: "unknown",
    used: "Used",

    // 错误信息
    authError: (path: string, err: string) =>
      `❌ Failed to read auth file: ${path}\nError: ${err}`,
    apiError: (status: number, text: string) =>
      `OpenAI API request failed (${status}): ${text}`,
    timeoutError: (seconds: number) => `Request timeout (${seconds}s)`,
    tokenExpired:
      "⚠️ OAuth token expired. Please use an OpenAI model in OpenCode to refresh authorization.",
    noAccounts:
      "No configured accounts found.\n\nSupported account types:\n- OpenAI (Plus/Team/Pro subscribers)\n- Zhipu AI (Coding Plan)\n- Z.ai (Coding Plan)\n- Google Cloud (Antigravity)",
    queryFailed: "❌ Failed to query accounts:\n",

    // 平台标题
    openaiTitle: "## OpenAI Account Quota",
    zhipuTitle: "## Zhipu AI Account Quota",
    zaiTitle: "## Z.ai Account Quota",

    // 智谱 AI 相关
    zhipuApiError: (status: number, text: string) =>
      `Zhipu API request failed (${status}): ${text}`,
    zaiApiError: (status: number, text: string) =>
      `Z.ai API request failed (${status}): ${text}`,
    zhipuTokensLimit: "5-hour token limit",
    zhipuMcpLimit: "MCP monthly quota",
    zhipuAccountName: "Coding Plan",
    zaiAccountName: "Z.ai",
    noQuotaData: "No quota data available",

    // Google 相关
    googleTitle: "## Google Cloud Account Quota",
    googleApiError: (status: number, text: string) =>
      `Google API request failed (${status}): ${text}`,
    googleNoProjectId: "⚠️ Missing project_id, cannot query quota.",

    // GitHub Copilot 相关
    copilotTitle: "## GitHub Copilot Account Quota",
    copilotApiError: (status: number, text: string) =>
      `GitHub Copilot API request failed (${status}): ${text}`,
    premiumRequests: "Premium",
    chatQuota: "Chat",
    completionsQuota: "Completions",
    overage: "Overage",
    overageRequests: "requests",
    quotaResets: "Quota resets",
    resetsSoon: "Resets soon",
    modelBreakdown: "Model breakdown:",
    billingPeriod: "Period",
    copilotQuotaUnavailable:
      "⚠️ GitHub Copilot quota query unavailable.\n" +
      "OpenCode's new OAuth integration doesn't support quota API access.",
    copilotQuotaWorkaround:
      "Solution:\n" +
      "1. Create a fine-grained PAT (visit https://github.com/settings/tokens?type=beta)\n" +
      "2. Under 'Account permissions', set 'Plan' to 'Read-only'\n" +
      "3. Create config file ~/.config/opencode/copilot-quota-token.json:\n" +
      '   {"token": "github_pat_xxx...", "username": "YourUsername"}\n\n' +
      "Alternatives:\n" +
      "• Click the Copilot icon in VS Code status bar to view quota\n" +
      "• Visit https://github.com/settings/billing for usage info",
  },
} as const;

// ============================================================================
// 导出
// ============================================================================

/** 当前语言（模块加载时检测一次） */
export const currentLang = detectLanguage();

/** 翻译函数 */
export const t = translations[currentLang];
