import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  TYPE_LABEL,
  fetchSearch,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  type SearchResult,
} from "../lib/api";
import { useToast } from "../lib/useToast";
import { setPageTitle } from "../lib/pageTitle";

function resultHref(result: SearchResult): string {
  if (result.type === "memo") return `/memo/${result.id}`;
  return `/${result.type}/${result.id}`;
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const typeLabel = TYPE_LABEL[result.type] ?? result.type;
  const href = resultHref(result);

  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="orbit-search-meta flex items-center gap-2 mb-1">
        <span className="orbit-badge">{typeLabel}</span>
        {result.author && <span>{result.author}</span>}
        {result.entryDate != null && (
          <time dateTime={String(result.entryDate)}>{formatDate(result.entryDate)}</time>
        )}
      </div>

      {result.title ? (
        <h3 className="orbit-heading font-semibold text-lg mb-1">
          <Link to={href} className="hover:underline">
            {result.title}
          </Link>
        </h3>
      ) : null}

      {result.snippet ? (
        <Link to={href} className="block hover:opacity-85">
          <p
            className={`text-sm leading-relaxed ${result.title ? "search-snippet" : "search-snippet-primary"}`}
            dangerouslySetInnerHTML={{ __html: result.snippet }}
          />
        </Link>
      ) : (
        !result.title && (
          <Link to={href} className="orbit-muted text-sm hover:underline">
            查看内容
          </Link>
        )
      )}
    </article>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [input, setInput] = useState(query);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [prevQuery, setPrevQuery] = useState(query);

  if (query !== prevQuery) {
    setPrevQuery(query);
    setInput(query);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    setPageTitle(query ? `搜索：${query}` : "搜索");
  }, [query]);

  useEffect(() => {
    if (!query.trim()) return;

    let cancelled = false;
    fetchSearch(query)
      .then((data) => {
        if (!cancelled) setResults(data.results);
      })
      .catch((err) => {
        if (!cancelled) {
          if (shouldToastApiError(err)) {
            toast.error(getApiErrorMessage(err, "搜索失败，请稍后重试"));
          }
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, toast]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) setParams({ q: trimmed });
    else setParams({});
  };

  return (
    <div className="orbit-content" data-page="search">
      <h1 className="orbit-page-title mb-6">搜索</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="orbit-input flex-1"
            placeholder="搜索日记、留言、信件、备忘录…"
            autoFocus={!query}
          />
          <button type="submit" className="orbit-btn orbit-btn-primary shrink-0">
            搜索
          </button>
        </div>
      </form>

      {query && (
        <div>
          {loading ? (
            <p className="orbit-muted text-sm">搜索中…</p>
          ) : (
            <>
              <p className="orbit-muted text-sm mb-4">
                {results.length === 0
                  ? "没有找到相关内容，试试其他关键词。"
                  : `找到 ${results.length} 条结果`}
              </p>

              {results.length > 0 && (
                <div className="flex flex-col divide-y orbit-divide-border">
                  {results.map((result) => (
                    <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
