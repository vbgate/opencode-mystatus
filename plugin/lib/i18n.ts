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

export type Language = "zh" | "en";

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
    if (intlLocale.startsWith("zh")) return "zh";
  } catch {
    // Intl API 不可用，继续尝试环境变量
  }

  // 2. 回退到环境变量
  const lang =
    process.env.LANG || process.env.LC_ALL || process.env.LANGUAGE || "";
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
      '   {"token": "github_pat_xxx...", "username": "你的用户名", "tier": "pro"}\n' +
      "有效 tier 值: free, pro, pro+, business, enterprise (需与你的订阅计划匹配)\n\n" +
      "其他方法:\n" +
      "• 在 VS Code 中点击状态栏的 Copilot 图标查看配额\n" +
      "• 访问 https://github.com/settings/billing 查看使用情况",
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
      '   {"token": "github_pat_xxx...", "username": "YourUsername", "tier": "pro"}\n' +
      "Valid tier values: free, pro, pro+, business, enterprise (must match your subscription plan)\n\n" +
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
