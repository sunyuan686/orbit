import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  deleteGalleryImage,
  fetchGallery,
  formatDate,
  gallerySourceHref,
  gallerySourceLabel,
  getApiErrorMessage,
  shouldToastApiError,
  type GalleryFilter,
  type GalleryItem,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { setPageTitle } from "../lib/pageTitle";
import { useConfirm } from "../lib/useConfirm";
import { useToast } from "../lib/useToast";
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from "../components/OrbitIcons";
import { GalleryImage } from "../components/GalleryImage";

const PAGE_SIZE = 48;

const FILTER_OPTIONS: { value: GalleryFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "linked", label: "已关联" },
  { value: "orphan", label: "未关联" },
];

export function GalleryPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const toastedError = useRef<unknown>(null);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [touchOffset, setTouchOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 1500);
  }, []);

  useEffect(() => {
    setPageTitle("相册");
  }, []);

  useEffect(() => {
    setActiveItem(null);
  }, [filter]);

  useEffect(() => {
    if (activeItem) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    }
  }, [activeItem, resetControlsTimer]);

  const galleryQuery = useInfiniteQuery({
    queryKey: queryKeys.gallery(filter, { pageSize: PAGE_SIZE }),
    queryFn: ({ pageParam }) =>
      fetchGallery({ filter, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    refetchOnWindowFocus: false,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((n, page) => n + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  useEffect(() => {
    if (!galleryQuery.error || toastedError.current === galleryQuery.error) return;
    toastedError.current = galleryQuery.error;
    if (shouldToastApiError(galleryQuery.error)) {
      toast.error(getApiErrorMessage(galleryQuery.error, "相册加载失败"));
    }
  }, [galleryQuery.error, toast]);

  const items = useMemo(
    () => galleryQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [galleryQuery.data]
  );
  const total = galleryQuery.data?.pages[0]?.total ?? 0;
  const loading = galleryQuery.isPending;
  const loadingMore = galleryQuery.isFetchingNextPage;
  const hasMore = galleryQuery.hasNextPage;

  const currentIndex = useMemo(() => {
    if (!activeItem) return -1;
    return items.findIndex((item) => item.storageKey === activeItem.storageKey);
  }, [activeItem, items]);

  const hasPrev = currentIndex > 0;
  const hasNext =
    currentIndex >= 0 && (currentIndex < items.length - 1 || hasMore);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setActiveItem(items[currentIndex - 1]);
      resetControlsTimer();
    }
  }, [currentIndex, items, resetControlsTimer]);

  const handleNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < items.length - 1) {
      setActiveItem(items[currentIndex + 1]);
      resetControlsTimer();
      if (
        currentIndex >= items.length - 3 &&
        hasMore &&
        !loadingMore
      ) {
        void galleryQuery.fetchNextPage();
      }
    }
  }, [currentIndex, items, hasMore, loadingMore, galleryQuery, resetControlsTimer]);

  // Preload adjacent images
  useEffect(() => {
    if (currentIndex < 0) return;
    const prevItem = items[currentIndex - 1];
    const nextItem = items[currentIndex + 1];
    if (prevItem?.url) {
      const img = new Image();
      img.src = prevItem.url;
    }
    if (nextItem?.url) {
      const img = new Image();
      img.src = nextItem.url;
    }
  }, [currentIndex, items]);

  // Keyboard navigation
  useEffect(() => {
    if (!activeItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      resetControlsTimer();
      if (e.key === "Escape") {
        setActiveItem(null);
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeItem, handlePrev, handleNext, resetControlsTimer]);

  // Touch handlers for swipe & pull-to-dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    resetControlsTimer();
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    setTouchOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const { x: deltaX, y: deltaY, time } = {
      x: touchOffset.x,
      y: touchOffset.y,
      time: touchStartRef.current.time,
    };
    const duration = Date.now() - time;
    touchStartRef.current = null;
    setIsSwiping(false);
    setTouchOffset({ x: 0, y: 0 });

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Pull down to dismiss
    if (deltaY > 90 && absY > absX * 1.2) {
      setActiveItem(null);
      return;
    }

    // Horizontal swipe
    if (absX > 45 || (absX > 20 && duration < 250)) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (storageKey: string) => deleteGalleryImage(storageKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gallery"] });
      setActiveItem(null);
      toast.success("图片已删除");
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "删除失败"));
    },
  });

  const handleFilterChange = (next: GalleryFilter) => {
    if (next === filter) return;
    setFilter(next);
  };

  const handleDelete = async () => {
    if (!activeItem || activeItem.linked) return;
    const confirmed = await confirm({
      message: "确定删除这张图片？此操作不可恢复。",
      confirmLabel: "删除",
      danger: true,
    });
    if (!confirmed) return;
    deleteMutation.mutate(activeItem.storageKey);
  };

  const controlsClass = showControls
    ? "orbit-gallery-lightbox-controls"
    : "orbit-gallery-lightbox-controls orbit-gallery-lightbox-controls--hidden";

  return (
    <div className="orbit-gallery-page max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <header className="mb-6">
        <h1 className="orbit-page-title">相册</h1>
        <p className="orbit-text-secondary mt-1 text-sm">
          {loading ? "加载中…" : `共 ${total} 张`}
        </p>
      </header>

      <div className="orbit-gallery-filters" role="tablist" aria-label="相册筛选">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            className={
              filter === option.value
                ? "orbit-gallery-filter orbit-gallery-filter--active"
                : "orbit-gallery-filter"
            }
            onClick={() => handleFilterChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <p className="orbit-text-secondary mt-8 text-sm">加载中…</p>
      ) : items.length === 0 ? (
        <p className="orbit-text-secondary mt-8 text-sm">暂无图片</p>
      ) : (
        <div className="orbit-gallery-grid mt-5">
          {items.map((item) => (
            <button
              key={item.storageKey}
              type="button"
              className="orbit-gallery-thumb"
              onClick={() => setActiveItem(item)}
              aria-label={`查看图片 ${item.storageKey}`}
            >
              <GalleryImage
                src={item.url}
                blurhash={item.blurhash}
                width={item.width}
                height={item.height}
                variant="thumb"
              />
              {!item.linked && <span className="orbit-gallery-thumb-badge">未关联</span>}
            </button>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className="orbit-btn-ghost"
            disabled={loadingMore}
            onClick={() => void galleryQuery.fetchNextPage()}
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        </div>
      )}

      {activeItem && (
        <div
          className="orbit-gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          style={{
            backgroundColor:
              touchOffset.y > 0
                ? `rgba(0, 0, 0, ${Math.max(0.2, 0.85 - touchOffset.y / 400)})`
                : undefined,
          }}
          onMouseMove={resetControlsTimer}
          onClick={() => setActiveItem(null)}
        >
          {currentIndex >= 0 && (
            <div className={`orbit-gallery-lightbox-counter ${controlsClass}`} onClick={(e) => e.stopPropagation()}>
              {currentIndex + 1} / {total || items.length}
            </div>
          )}

          {hasPrev && (
            <button
              type="button"
              className={`orbit-gallery-lightbox-nav orbit-gallery-lightbox-nav--prev orbit-icon-btn ${controlsClass}`}
              aria-label="上一张图片"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
            >
              <ChevronLeftIcon size="md" />
            </button>
          )}

          {hasNext && (
            <button
              type="button"
              className={`orbit-gallery-lightbox-nav orbit-gallery-lightbox-nav--next orbit-icon-btn ${controlsClass}`}
              aria-label="下一张图片"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
            >
              <ChevronRightIcon size="md" />
            </button>
          )}

          <div
            className="orbit-gallery-lightbox-panel"
            style={{
              transform:
                touchOffset.x !== 0 || touchOffset.y !== 0
                  ? `translate3d(${touchOffset.x}px, ${touchOffset.y > 0 ? touchOffset.y : 0}px, 0) scale(${
                      touchOffset.y > 0 ? Math.max(0.75, 1 - touchOffset.y / 500) : 1
                    })`
                  : undefined,
              transition: isSwiping ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => {
              e.stopPropagation();
              if (!showControls) {
                resetControlsTimer();
              } else {
                setShowControls(false);
              }
            }}
          >
            <button
              type="button"
              className={`orbit-gallery-lightbox-close orbit-icon-btn inline-flex ${controlsClass}`}
              aria-label="关闭预览"
              onClick={(e) => {
                e.stopPropagation();
                setActiveItem(null);
              }}
            >
              <CloseIcon size="sm" />
            </button>

            <GalleryImage
              src={activeItem.url}
              blurhash={activeItem.blurhash}
              width={activeItem.width}
              height={activeItem.height}
              variant="lightbox"
            />

            <div className="orbit-gallery-lightbox-meta">
              <p className="text-sm orbit-text-secondary">
                {formatDate(activeItem.sortAt)}
                {!activeItem.linked && " · 未关联"}
              </p>

              {activeItem.sources.length > 0 ? (
                <ul className="orbit-gallery-source-list">
                  {activeItem.sources.map((source) => (
                    <li key={`${source.type}:${source.id}`}>
                      <Link to={gallerySourceHref(source)} className="orbit-gallery-source-link">
                        {gallerySourceLabel(source)}
                        {source.deleted && (
                          <span className="orbit-gallery-source-deleted">已删除</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm orbit-text-secondary">没有关联的内容</p>
              )}

              {!activeItem.linked && (
                <button
                  type="button"
                  className="orbit-btn orbit-btn-danger mt-3"
                  disabled={deleteMutation.isPending}
                  onClick={() => void handleDelete()}
                >
                  {deleteMutation.isPending ? "删除中…" : "删除图片"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
