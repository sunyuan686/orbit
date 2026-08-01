import { useEffect, useMemo, useRef, useState } from "react";
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
import { CloseIcon } from "../components/OrbitIcons";
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

  useEffect(() => {
    setPageTitle("相册");
  }, []);

  useEffect(() => {
    setActiveItem(null);
  }, [filter]);

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
          onClick={() => setActiveItem(null)}
        >
          <div className="orbit-gallery-lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="orbit-gallery-lightbox-close orbit-icon-btn inline-flex"
              aria-label="关闭预览"
              onClick={() => setActiveItem(null)}
            >
              <CloseIcon size="md" />
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
