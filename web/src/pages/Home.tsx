import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchEntries,
  fetchSpaceStatus,
  getApiErrorMessage,
  getSpaceYear,
  shouldToastApiError,
  type EntrySummary,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../hooks/useToast";
import { MomentCard } from "../components/MomentCard";
import { MomentComposeCard } from "../components/moment/MomentComposeCard";
import { QuickComposeSheet } from "../components/layout/QuickComposeSheet";
import {
  Container,
  FilterChipDropdown,
  InfiniteScrollSentinel,
  Stack,
} from "../components/ui";
import { useInfiniteScroll } from "../hooks";
import { useLayer } from "../hooks/useLayer";
import { useMomentTags } from "../hooks/useMomentTags";
import { TagManageModal } from "../components/moment/TagManageModal";
import { GridViewIcon, ListViewIcon, SortIcon } from "../components/OrbitIcons";

export function HomePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const toastedError = useRef<unknown>(null);
  const { tags } = useMomentTags();

  const {
    isOpen: composeOpen,
    open: openCompose,
    close: closeCompose,
    // 与外壳底栏的同名组件是两个独立挂载点（本处 showLetterOption=false），
    // 必须用不同的层 key：同一 key 被两处渲染会让两个抽屉同时打开。
  } = useLayer("compose-card");
  const [year, setYear] = useState<number | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const {
    isOpen: tagManageOpen,
    open: openTagManage,
    close: closeTagManage,
  } = useLayer("tags-home");

  const [viewMode, setViewMode] = useState<"card" | "list">(() => {
    const saved = localStorage.getItem("orbit_view_mode_moment");
    if (saved === "card" || saved === "list") return saved;
    return "card";
  });

  const handleViewModeChange = (mode: "card" | "list") => {
    setViewMode(mode);
    localStorage.setItem("orbit_view_mode_moment", mode);
  };

  useEffect(() => {
    setPageTitle("动态");
  }, []);

  const statusQuery = useQuery({
    queryKey: queryKeys.spaceStatus,
    queryFn: fetchSpaceStatus,
    staleTime: 5 * 60_000,
  });

  const pageSize = 15;
  const pagedMomentsQuery = useInfiniteQuery({
    queryKey: queryKeys.entries("moment", {
      tag: tag ?? undefined,
      year: year ?? undefined,
      author: author ?? undefined,
      order,
    }),
    queryFn: ({ pageParam = 0 }) =>
      fetchEntries("moment", {
        limit: pageSize,
        offset: pageParam,
        tag: tag ?? undefined,
        year: year ?? undefined,
        author: author ?? undefined,
        order,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const {
    data: pagedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingMoments,
    error: momentsError,
  } = pagedMomentsQuery;

  const { sentinelRef, retry } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isError: Boolean(momentsError),
  });

  useEffect(() => {
    if (!momentsError || toastedError.current === momentsError) return;
    toastedError.current = momentsError;
    if (shouldToastApiError(momentsError)) {
      toast.error(getApiErrorMessage(momentsError, "数据加载失败"));
    }
  }, [momentsError, toast]);

  const moments = useMemo(() => {
    return pagedData?.pages.flatMap((page) => page.items) ?? [];
  }, [pagedData]);

  const currentYear = getSpaceYear();
  const earliestYear = pagedData?.pages[0]?.earliestYear ?? currentYear;
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
    for (const e of moments) {
      if (e.author) set.add(e.author);
    }
    return Array.from(set).map((a) => ({ value: a, label: a }));
  }, [statusQuery.data, moments]);

  const tagOptions = useMemo(() => {
    return tags.map((t) => ({ value: t.id, label: t.name }));
  }, [tags]);

  const hasActiveFilter = year != null || author != null || tag != null;
  const showComposeCard = !hasActiveFilter && order === "desc";

  const { leftColMoments, rightColMoments } = useMemo(() => {
    const left: EntrySummary[] = [];
    const right: EntrySummary[] = [];

    moments.forEach((item, index) => {
      // 若首位展示速记卡（showComposeCard），速记卡占左列第1格，
      // 首条动态 (index 0) 排入右列第1格，实现自然交替：左(速记)->右(0)->左(1)->右(2)...
      const goesToLeft = showComposeCard ? index % 2 === 1 : index % 2 === 0;
      if (goesToLeft) {
        left.push(item);
      } else {
        right.push(item);
      }
    });

    return { leftColMoments: left, rightColMoments: right };
  }, [moments, showComposeCard]);

  return (
    <Container size="narrow" className="orbit-home" data-page="home">
      <Stack gap="md">
        <section className="orbit-home-section" aria-label="动态流筛选与内容">
          {/* 综合过滤工具栏 */}
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
              <FilterChipDropdown
                label="标签"
                value={tag}
                options={tagOptions}
                onChange={setTag}
                allLabel="全部"
                footerAction={{
                  label: "管理标签...",
                  onClick: openTagManage,
                }}
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
              <button
                type="button"
                className={`orbit-filter-action-btn orbit-filter-icon-btn${viewMode === "card" ? " is-active" : ""}`}
                onClick={() =>
                  handleViewModeChange(viewMode === "card" ? "list" : "card")
                }
                title={
                  viewMode === "card"
                    ? "当前为双列卡片视图，点击切换为列表视图"
                    : "当前为单列列表视图，点击切换为双列卡片视图"
                }
                aria-label={
                  viewMode === "card"
                    ? "当前为双列卡片视图，点击切换为列表视图"
                    : "当前为单列列表视图，点击切换为双列卡片视图"
                }
              >
                {viewMode === "card" ? (
                  <GridViewIcon className="w-3.5 h-3.5" />
                ) : (
                  <ListViewIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* 动态内容：单列列表 / 双列小红书卡片 / 时间线 */}
          {loadingMoments ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
              加载动态中…
            </div>
          ) : moments.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]">
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                {hasActiveFilter
                  ? "所选筛选条件下暂无动态。"
                  : "还没有动态，记录今天的美好吧。"}
              </p>
              {hasActiveFilter ? (
                <button
                  type="button"
                  className="orbit-text-link cursor-pointer text-sm"
                  onClick={() => {
                    setYear(null);
                    setAuthor(null);
                    setTag(null);
                  }}
                >
                  清除筛选条件
                </button>
              ) : (
                <Link
                  to="/moment/new"
                  className="orbit-btn orbit-btn-sm orbit-btn-primary"
                >
                  记录第一条动态
                </Link>
              )}
            </div>
          ) : (
            <>
              {viewMode === "list" ? (
                <div className="flex flex-col gap-3 sm:gap-3.5">
                  {showComposeCard && (
                    <MomentComposeCard
                      layout="list"
                      onClick={openCompose}
                    />
                  )}
                  {moments.map((item) => (
                    <MomentCard key={item.id} entry={item} layout="list" />
                  ))}
                </div>
              ) : tag === "milestone" ? (
                <div className="orbit-tl-wrap">
                  {moments.map((item) => (
                    <MomentCard key={item.id} entry={item} layout="timeline" />
                  ))}
                </div>
              ) : (
                <div className="flex gap-2.5 sm:gap-3.5 items-start">
                  <div className="flex-1 min-w-0 flex flex-col gap-2.5 sm:gap-3.5">
                    {showComposeCard && (
                      <MomentComposeCard
                        layout="feed"
                        onClick={openCompose}
                      />
                    )}
                    {leftColMoments.map((item) => (
                      <MomentCard key={item.id} entry={item} layout="feed" />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2.5 sm:gap-3.5">
                    {rightColMoments.map((item) => (
                      <MomentCard key={item.id} entry={item} layout="feed" />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 无限滚动哨兵与状态反馈 */}
          <InfiniteScrollSentinel
            sentinelRef={sentinelRef}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isError={Boolean(momentsError)}
            onRetry={retry}
            itemCount={moments.length}
            className="mt-6"
          />
        </section>
      </Stack>

      <TagManageModal
        isOpen={tagManageOpen}
        onClose={closeTagManage}
      />
      <QuickComposeSheet
        isOpen={composeOpen}
        onClose={closeCompose}
        showLetterOption={false}
        onPosted={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.entries("moment") });
          pagedMomentsQuery.refetch();
          // 停留在首页：原地关层即可，不需要额外导航。
          closeCompose();
        }}
      />
    </Container>
  );
}

