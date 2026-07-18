import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { setPageTitle } from "../lib/pageTitle";
import { useConfirm } from "../lib/useConfirm";
import { useToast } from "../lib/useToast";
import { CloseIcon } from "../components/OrbitIcons";

const PAGE_SIZE = 48;

const FILTER_OPTIONS: { value: GalleryFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "linked", label: "已关联" },
  { value: "orphan", label: "未关联" },
];

export function GalleryPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPageTitle("相册");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActiveItem(null);

    void fetchGallery({ filter, limit: PAGE_SIZE, offset: 0 })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "相册加载失败"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, toast]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const data = await fetchGallery({
        filter,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((current) => [...current, ...data.items]);
      setTotal(data.total);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "相册加载失败"));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [filter, items.length, toast]);

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

    setDeleting(true);
    try {
      await deleteGalleryImage(activeItem.storageKey);
      setItems((current) => current.filter((item) => item.storageKey !== activeItem.storageKey));
      setTotal((count) => Math.max(0, count - 1));
      setActiveItem(null);
      toast.success("图片已删除");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "删除失败"));
    } finally {
      setDeleting(false);
    }
  };

  const hasMore = items.length < total;

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
              <img src={item.url} alt="" loading="lazy" decoding="async" />
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
            onClick={() => void loadMore()}
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

            <img src={activeItem.url} alt="" className="orbit-gallery-lightbox-image" />

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
                  className="orbit-btn-danger orbit-btn-sm mt-4"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? "删除中…" : "删除图片"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
