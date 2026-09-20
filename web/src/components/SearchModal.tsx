import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  TYPE_LABEL,
  fetchSearch,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  type SearchResult,
} from "../lib/api";
import { useToast } from "../hooks/useToast";
import { SearchIcon, CloseIcon } from "./OrbitIcons";

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

function resultHref(result: SearchResult): string {
  return `/${result.type}/${result.id}`;
}

export function SearchModal({
  isOpen,
  onClose,
  initialQuery = "",
}: SearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    let cancelled = false;

    const timer = setTimeout(() => {
      fetchSearch(trimmed)
        .then((data) => {
          if (!cancelled) {
            setResults(data.results);
            setSelectedIndex(0);
          }
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
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, toast]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      // 从呈现层进入页面：用 replace 把层条目直接替换为页面条目，层随之消失。
      // 若改为"先关闭再跳转"，会连发两次导航（回退 + 压栈），且返回时会重新浮出已关闭的层。
      navigate(resultHref(result), { replace: true });
    },
    [navigate]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, results.length]);

  if (!isOpen) return null;

  return (
    <div
      className="orbit-search-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="orbit-search-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        onKeyDown={handleKeyDown}
      >
        <div className="orbit-search-modal-header">
          <div className="orbit-search-modal-input-wrap">
            <SearchIcon size="sm" className="orbit-search-modal-icon" />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索日记、留言、信件、备忘录…"
              className="orbit-search-modal-input"
              aria-label="搜索内容"
            />
            {query ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="orbit-search-modal-clear"
                aria-label="清空输入"
                title="清空"
              >
                <CloseIcon size="sm" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="orbit-search-modal-cancel sm:hidden"
            aria-label="取消搜索"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onClose}
            className="orbit-search-modal-esc hidden sm:inline-flex"
            aria-label="关闭搜索"
            title="关闭 (ESC)"
          >
            ESC
          </button>
        </div>

        <div className="orbit-search-modal-body" ref={listRef}>
          {loading ? (
            <div className="orbit-search-modal-state">
              <span className="orbit-search-spinner" aria-hidden="true" />
              <span>搜索中…</span>
            </div>
          ) : query.trim() ? (
            results.length === 0 ? (
              <div className="orbit-search-modal-state">
                <span>未找到与 “{query.trim()}” 相关的记忆</span>
              </div>
            ) : (
              <div className="orbit-search-modal-list">
                {results.map((result, idx) => {
                  const typeLabel = TYPE_LABEL[result.type] ?? result.type;
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={`${result.type}-${result.id}`}
                      className={`orbit-search-modal-item${isSelected ? " orbit-search-modal-item--active" : ""}`}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      role="button"
                      tabIndex={-1}
                    >
                      <div className="orbit-search-modal-item-meta">
                        <span className="orbit-badge">{typeLabel}</span>
                        {result.author && <span>{result.author}</span>}
                        {result.entryDate != null && (
                          <time dateTime={String(result.entryDate)}>
                            {formatDate(result.entryDate)}
                          </time>
                        )}
                      </div>

                      {result.title ? (
                        <h4 className="orbit-search-modal-item-title">
                          {result.title}
                        </h4>
                      ) : null}

                      {result.snippet ? (
                        <p
                          className={`text-sm leading-relaxed ${result.title ? "search-snippet" : "search-snippet-primary"}`}
                          dangerouslySetInnerHTML={{ __html: result.snippet }}
                        />
                      ) : (
                        !result.title && (
                          <span className="orbit-muted text-xs">查看内容</span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="orbit-search-modal-hint">
              <span>输入关键词检索日记、信件、留言、备忘录等记忆</span>
            </div>
          )}
        </div>

        <div className="orbit-search-modal-footer hidden sm:flex">
          <div className="orbit-search-modal-shortcuts">
            <span className="orbit-search-key">↑↓</span>
            <span>选择</span>
            <span className="orbit-search-key">↵</span>
            <span>打开</span>
            <span className="orbit-search-key">ESC</span>
            <span>关闭</span>
          </div>
          {results.length > 0 && !loading && (
            <span className="orbit-search-count">找到 {results.length} 条结果</span>
          )}
        </div>
      </div>
    </div>
  );
}
