import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  beijingDateParts,
  fetchEntries,
  fetchSpaceStatus,
  getSpaceYear,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  type EntryListPage,
  type EntrySummary,
} from "../lib/api";
import {
  buildLetterTree,
  entryDisplayLabel,
  type LetterThread,
} from "../lib/letterThread";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../hooks/useToast";
import { useInfiniteScroll, useIsMobileView } from "../hooks";
import {
  Container,
  FilterChipDropdown,
  InfiniteScrollSentinel,
  PullToRefresh,
} from "../components/ui";
import { GalleryImage } from "../components/GalleryImage";
import { LetterIcon, SortIcon } from "../components/OrbitIcons";
import { LetterComposeCard } from "../components/letter/LetterComposeCard";

/** letter 仍全量拉取以拼线程树；其余类型分页 */
const PAGE_SIZE = 30;



function CoverImg({
  entry,
  className,
  imgClassName,
}: {
  entry: EntrySummary;
  className?: string;
  imgClassName?: string;
}) {
  if (!entry.coverUrl) return null;
  return (
    <GalleryImage
      src={entry.coverUrl}
      blurhash={entry.coverBlurhash}
      width={entry.coverWidth}
      height={entry.coverHeight}
      className={className}
      imgClassName={imgClassName}
    />
  );
}

function EntryRow({ entry, type }: { entry: EntrySummary; type: string }) {
  const showAuthor = Boolean(entry.author);
  const displayText = entryDisplayLabel(entry);

  return (
    <Link to={`/${type}/${entry.id}`} className="orbit-entry-card">
      <span className="orbit-entry-card-main">
        {displayText && (
          <span className="orbit-entry-title orbit-entry-title-truncate">
            {displayText}
          </span>
        )}
        {showAuthor && entry.author && (
          <span className="orbit-entry-author">{entry.author}</span>
        )}
      </span>
      {entry.entryDate != null && (
        <span className="orbit-entry-date shrink-0">
          {formatDate(entry.entryDate)}
        </span>
      )}
    </Link>
  );
}


function LetterEnvelope({ entry }: { entry: EntrySummary }) {
  const customTitle = entry.title?.trim() || null;
  const snippet = entry.snippet?.trim() || "";

  return (
    <Link to={`/letter/${entry.id}`} className="orbit-env">
      <div className="orbit-env-head">
        <div className="orbit-env-badge">
          <LetterIcon size="sm" className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
          {entry.author && (
            <span className="orbit-env-author">{entry.author}</span>
          )}
        </div>
        {entry.entryDate != null && (
          <span className="orbit-entry-date shrink-0">
            {formatDate(entry.entryDate)}
          </span>
        )}
      </div>

      <div className="orbit-env-main">
        {customTitle ? (
          <>
            <h3 className="orbit-env-title">{customTitle}</h3>
            {snippet && <p className="orbit-env-body orbit-env-body--has-title">{snippet}</p>}
          </>
        ) : (
          <p className="orbit-env-body">{snippet || "（查看信件内容）"}</p>
        )}
      </div>

      {entry.coverUrl && (
        <div className="orbit-env-cover">
          <CoverImg entry={entry} />
        </div>
      )}

      {entry.author && <span className="orbit-env-sign">— {entry.author}</span>}
    </Link>
  );
}

function LetterThreadItem({
  thread,
}: {
  thread: LetterThread;
}) {
  const { root, replies } = thread;
  const hasReplies = replies.length > 0;

  return (
    <article
      className={`orbit-letter-thread${hasReplies ? " orbit-letter-thread--has-replies" : ""}`}
    >
      <div className="orbit-letter-stack">
        {/* 选项 2：底层自然微错位信纸（有回信时真实呈现厚度） */}
        {hasReplies && (
          <>
            {replies.length >= 2 && (
              <div
                className="orbit-letter-deck-layer orbit-letter-deck-layer--deep"
                aria-hidden="true"
              />
            )}
            <div
              className="orbit-letter-deck-layer orbit-letter-deck-layer--mid"
              aria-hidden="true"
            />
          </>
        )}

        {/* 主信卡片 */}
        <LetterEnvelope entry={root} />
      </div>
    </article>
  );
}

function TypedEntryList({
  type,
  entries,
}: {
  type: string;
  entries: EntrySummary[];
}) {
  return (
    <ul className="orbit-list-plain orbit-entry-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <EntryRow entry={entry} type={type} />
        </li>
      ))}
    </ul>
  );
}

export function ArticleList({ typeOverride }: { typeOverride?: string } = {}) {
  const { type: paramType } = useParams<{ type: string }>();
  const type = typeOverride ?? paramType;
  const toast = useToast();
  const toastedError = useRef<unknown>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.spaceStatus,
    queryFn: fetchSpaceStatus,
    staleTime: 5 * 60_000,
  });

  const [year, setYear] = useState<number | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const isLetter = type === "letter";

  const paginated = Boolean(type) && !isLetter;
  const letterParams = useMemo(
    () => ({
      roots: false,
      order,
    }),
    [order]
  );
  const pageParams = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      year: year ?? undefined,
      author: author ?? undefined,
      order,
    }),
    [year, author, order]
  );

  const letterQuery = useQuery({
    queryKey: queryKeys.entries("letter", letterParams),
    queryFn: () => fetchEntries("letter", letterParams),
    enabled: isLetter,
  });

  const pagedQuery = useInfiniteQuery({
    queryKey: queryKeys.entries(type || "moment", pageParams),
    queryFn: ({ pageParam }): Promise<EntryListPage> =>
      fetchEntries(type!, {
        limit: PAGE_SIZE,
        offset: pageParam,
        year: year ?? undefined,
        author: author ?? undefined,
        order,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((n, page) => n + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: paginated && Boolean(type),
  });

  const error = isLetter ? letterQuery.error : pagedQuery.error;
  useEffect(() => {
    if (!error || toastedError.current === error) return;
    toastedError.current = error;
    if (shouldToastApiError(error)) {
      toast.error(getApiErrorMessage(error, "加载失败，请稍后重试"));
    }
  }, [error, toast]);

  const allLetterEntries: EntrySummary[] = useMemo(() => {
    if (!isLetter) return [];
    const data = letterQuery.data;
    return Array.isArray(data) ? data : [];
  }, [isLetter, letterQuery.data]);

  const entries: EntrySummary[] = useMemo(() => {
    if (isLetter) {
      return allLetterEntries.filter((e) => {
        if (year != null) {
          if (!e.entryDate) return false;
          if (beijingDateParts(e.entryDate).y !== year) return false;
        }
        if (author != null && e.author !== author) {
          return false;
        }
        return true;
      });
    }
    return pagedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [isLetter, allLetterEntries, year, author, pagedQuery.data]);

  const currentYear = getSpaceYear();
  const earliestYear = useMemo(() => {
    if (isLetter) {
      if (!allLetterEntries.length) return currentYear;
      let minYear = currentYear;
      for (const e of allLetterEntries) {
        if (e.entryDate) {
          const yr = beijingDateParts(e.entryDate).y;
          if (yr < minYear) minYear = yr;
        }
      }
      return minYear;
    }
    return pagedQuery.data?.pages[0]?.earliestYear ?? currentYear;
  }, [isLetter, allLetterEntries, pagedQuery.data?.pages, currentYear]);

  const startYear = Math.min(earliestYear, currentYear);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y >= startYear; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear, startYear]);

  const yearOptions = useMemo(
    () => years.map((y) => ({ value: y, label: `${y}年` })),
    [years]
  );

  const authorOptions = useMemo(() => {
    const set = new Set<string>();
    if (statusQuery.data?.authors) {
      for (const a of statusQuery.data.authors) {
        if (a.name) set.add(a.name);
      }
    }
    const source = isLetter ? allLetterEntries : entries;
    for (const e of source) {
      if (e.author) set.add(e.author);
    }
    return Array.from(set).map((a) => ({ value: a, label: a }));
  }, [statusQuery.data, isLetter, allLetterEntries, entries]);

  const loading = isLetter ? letterQuery.isPending : pagedQuery.isPending;
  const loadingMore = pagedQuery.isFetchingNextPage;
  const letterTree = useMemo(
    () => (isLetter ? buildLetterTree(entries, order) : []),
    [isLetter, entries, order]
  );
  const hasMore = paginated && pagedQuery.hasNextPage;
  const hasActiveFilter = year != null || author != null;
  const isMobileView = useIsMobileView();
  const showLetterComposeCard = isLetter && !hasActiveFilter && order === "desc";

  const { leftLetterTree, rightLetterTree } = useMemo(() => {
    if (!isLetter || isMobileView) return { leftLetterTree: [], rightLetterTree: [] };
    const left: LetterThread[] = [];
    const right: LetterThread[] = [];

    letterTree.forEach((thread, index) => {
      // 若首位展示新建信笺卡（showLetterComposeCard），新建卡占左列第1格，
      // 首封信件 (index 0) 排入右列第1格，实现自然交替：左(新建)->右(0)->左(1)->右(2)...
      const goesToLeft = showLetterComposeCard ? index % 2 === 1 : index % 2 === 0;
      if (goesToLeft) {
        left.push(thread);
      } else {
        right.push(thread);
      }
    });

    return { leftLetterTree: left, rightLetterTree: right };
  }, [isLetter, isMobileView, letterTree, showLetterComposeCard]);



  const handleRefresh = async () => {
    if (isLetter) {
      const [res, statusRes] = await Promise.all([letterQuery.refetch(), statusQuery.refetch()]);
      if (res?.isError) throw res.error;
      if (statusRes?.isError) throw statusRes.error;
    } else {
      const [res, statusRes] = await Promise.all([pagedQuery.refetch(), statusQuery.refetch()]);
      if (res?.isError) throw res.error;
      if (statusRes?.isError) throw statusRes.error;
    }
  };

  const { sentinelRef, retry } = useInfiniteScroll({
    hasNextPage: Boolean(hasMore),
    isFetchingNextPage: loadingMore,
    fetchNextPage: () => pagedQuery.fetchNextPage(),
    isError: Boolean(pagedQuery.error),
    enabled: paginated && !loading,
  });

  return (
    <Container size="standard" className={isLetter ? "orbit-content--desk" : undefined}>
      <PullToRefresh
        tabKey={isLetter ? "letter" : undefined}
        onRefresh={handleRefresh}
      >
      <div className="orbit-content-toolbar">
        <div className="orbit-content-toolbar-group">
          <FilterChipDropdown
            label="时间"
            value={year}
            options={yearOptions}
            onChange={setYear}
            allLabel="全部"
          />
          <FilterChipDropdown
            label="作者"
            value={author}
            options={authorOptions}
            onChange={setAuthor}
            allLabel="全部"
          />
        </div>

        <div className="orbit-content-toolbar-group">
          <button
            type="button"
            className={`orbit-filter-action-btn orbit-filter-icon-btn${order === "asc" ? " is-active" : ""}`}
            onClick={() => setOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            title={
              order === "desc"
                ? "当前为最新优先，点击切换为最早优先"
                : "当前为最早优先，点击切换为最新优先"
            }
            aria-label={order === "desc" ? "排序：最新优先" : "排序：最早优先"}
          >
            <SortIcon order={order} className="w-3.5 h-3.5" />
          </button>
          {!isLetter && (
            <Link
              to={`/${type}/new`}
              className="orbit-btn orbit-btn-sm orbit-btn-primary"
              title="新建"
            >
              <span className="sm:hidden">＋</span>
              <span className="hidden sm:inline">＋ 新建</span>
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <p className="orbit-muted">加载中…</p>
      ) : entries.length === 0 ? (
        <div className="orbit-muted">
          {hasActiveFilter ? (
            <div className="py-8 text-center space-y-2">
              <p>所选条件下暂无内容。</p>
              <button
                type="button"
                className="orbit-text-link cursor-pointer text-sm"
                onClick={() => {
                  setYear(null);
                  setAuthor(null);
                }}
              >
                清除筛选条件
              </button>
            </div>
          ) : (
            <>
              <p>{isLetter ? "信箱还空着。" : "还没有内容。"}</p>
              <p>
                <Link to={`/${type}/new`} className="orbit-text-link">
                  {isLetter ? "写下第一封信" : "写下第一篇"}
                </Link>
                {isLetter ? "，寄给最想念的人。" : "，记录这一刻。"}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {isLetter ? (
            isMobileView ? (
              <div className="orbit-desk orbit-desk--single">
                {showLetterComposeCard && (
                  <div className="orbit-desk-item">
                    <LetterComposeCard />
                  </div>
                )}
                {letterTree.map((thread) => (
                  <div key={thread.root.id} className="orbit-desk-item">
                    <LetterThreadItem thread={thread} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="orbit-desk orbit-desk--split">
                <div className="orbit-desk-col">
                  {showLetterComposeCard && (
                    <div className="orbit-desk-item">
                      <LetterComposeCard />
                    </div>
                  )}
                  {leftLetterTree.map((thread) => (
                    <div key={thread.root.id} className="orbit-desk-item">
                      <LetterThreadItem thread={thread} />
                    </div>
                  ))}
                </div>
                <div className="orbit-desk-col">
                  {rightLetterTree.map((thread) => (
                    <div key={thread.root.id} className="orbit-desk-item">
                      <LetterThreadItem thread={thread} />
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <TypedEntryList type={type || "moment"} entries={entries} />
          )}

          {!loading && (
            <InfiniteScrollSentinel
              sentinelRef={paginated ? sentinelRef : undefined}
              hasNextPage={Boolean(hasMore)}
              isFetchingNextPage={loadingMore}
              isError={Boolean(error)}
              onRetry={isLetter ? () => letterQuery.refetch() : retry}
              itemCount={entries.length}
              className="mt-6"
            />
          )}
        </>
      )}
      </PullToRefresh>
    </Container>
  );
}
