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
      <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
        <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: "var(--color-border-light)" }}>
          {typeLabel}
        </span>
        {result.author && <span>{result.author}</span>}
        {result.entryDate != null && (
          <time dateTime={String(result.entryDate)}>{formatDate(result.entryDate)}</time>
        )}
      </div>

      {result.title ? (
        <h3 className="font-semibold text-lg mb-1" style={{ fontFamily: "var(--font-heading)" }}>
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
          <Link to={href} className="text-sm hover:underline" style={{ color: "var(--color-text-muted)" }}>
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

  useEffect(() => {
    setPageTitle(query ? `搜索：${query}` : "搜索");
  }, [query]);

  useEffect(() => {
    setInput(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    fetchSearch(query)
      .then((data) => setResults(data.results))
      .catch((err) => {
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "搜索失败，请稍后重试"));
        }
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [query, toast]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) setParams({ q: trimmed });
    else setParams({});
  };

  return (
    <div className="max-w-2xl mx-auto" data-page="search">
      <h1 className="text-2xl font-semibold mb-6" style={{ fontFamily: "var(--font-heading)" }}>
        搜索
      </h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md border text-sm"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-primary)",
            }}
            placeholder="搜索日记、留言、信件、备忘录…"
            autoFocus={!query}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-md text-sm cursor-pointer"
            style={{
              background: "var(--color-text-primary)",
              color: "var(--color-bg)",
            }}
          >
            搜索
          </button>
        </div>
      </form>

      {query && (
        <div>
          {loading ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              搜索中…
            </p>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
                {results.length === 0
                  ? "没有找到相关内容，试试其他关键词。"
                  : `找到 ${results.length} 条结果`}
              </p>

              {results.length > 0 && (
                <div className="flex flex-col divide-y" style={{ borderColor: "var(--color-border-light)" }}>
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
