/**
 * @file web-search-provider.ts
 * @description 联网搜索 Provider（支持 Tavily 与 Brave Search 双通道及自动降级）
 */

import { createLogger } from "../../lib/logger.js";

const log = createLogger("web-search-provider");

const MAX_SNIPPET_CHARS = 1_500;

function truncate(value: string, max = MAX_SNIPPET_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…（已截断）`;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchExecutionOptions {
  query: string;
  provider?: "auto" | "tavily" | "brave";
  tavilyKey?: string;
  braveKey?: string;
}

export interface WebSearchExecutionResult {
  query: string;
  provider: string;
  results: SearchResultItem[];
}

export async function executeTavilySearch(
  query: string,
  apiKey: string
): Promise<SearchResultItem[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Tavily API 响应异常 (${res.status}): ${truncate(errorText, 200)}`
    );
  }

  const data = (await res.json()) as {
    results?: Array<{ title: string; url: string; content: string }>;
  };

  return (data.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: truncate(item.content || ""),
    source: "tavily",
  }));
}

export async function executeBraveSearch(
  query: string,
  apiKey: string
): Promise<SearchResultItem[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "5");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Brave Search API 响应异常 (${res.status}): ${truncate(errorText, 200)}`
    );
  }

  const data = (await res.json()) as {
    web?: {
      results?: Array<{ title: string; url: string; description?: string }>;
    };
  };

  return (data.web?.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: truncate(item.description || ""),
    source: "brave",
  }));
}

/**
 * 统一执行 Web 搜索，支持 auto 自动选择与主备互备容灾
 */
export async function executeWebSearch(
  options: WebSearchExecutionOptions
): Promise<WebSearchExecutionResult | { error: string }> {
  const { query, provider = "auto", tavilyKey, braveKey } = options;

  if (!tavilyKey && !braveKey) {
    log.warn("web_search: no API key configured", {
      hasTavily: !!tavilyKey,
      hasBrave: !!braveKey,
    });
    return {
      error:
        "尚未配置 Web 搜索 API Key。请在环境变量或系统设置中配置 TAVILY_API_KEY 或 BRAVE_SEARCH_API_KEY。",
    };
  }

  let targetProvider = provider;
  if (targetProvider === "auto") {
    targetProvider = tavilyKey ? "tavily" : "brave";
  }

  log.info("web_search: calling", { query, targetProvider });

  try {
    if (targetProvider === "tavily" && tavilyKey) {
      const results = await executeTavilySearch(query, tavilyKey);
      log.info("web_search: tavily success", { count: results.length });
      return { query, provider: "tavily", results };
    }
    if (targetProvider === "brave" && braveKey) {
      const results = await executeBraveSearch(query, braveKey);
      log.info("web_search: brave success", { count: results.length });
      return { query, provider: "brave", results };
    }
    if (tavilyKey) {
      const results = await executeTavilySearch(query, tavilyKey);
      log.info("web_search: tavily fallback success", { count: results.length });
      return { query, provider: "tavily", results };
    }
    if (braveKey) {
      const results = await executeBraveSearch(query, braveKey);
      log.info("web_search: brave fallback success", { count: results.length });
      return { query, provider: "brave", results };
    }
    return { error: "所选搜索引擎 API Key 未配置" };
  } catch (err: any) {
    log.error("web_search: primary failed", err, { targetProvider, query });
    if (targetProvider === "tavily" && braveKey) {
      try {
        const results = await executeBraveSearch(query, braveKey);
        log.info("web_search: brave fallback success", { count: results.length });
        return { query, provider: "brave (fallback)", results };
      } catch (fallbackErr: any) {
        log.error("web_search: both providers failed", fallbackErr, { query });
        return {
          error: `Tavily 搜索失败: ${err.message}; 自动降级 Brave 也失败: ${fallbackErr.message}`,
        };
      }
    }
    return { error: `Web 搜索失败: ${err.message}` };
  }
}
