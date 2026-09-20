import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAlbums, createAlbum, type AlbumSummary } from "../lib/api";
import { GalleryImage } from "../components/GalleryImage";
import { Button, Container } from "../components/ui";
import { Modal } from "../components/ui/Modal";
import { AlbumIcon, PlusIcon } from "../components/OrbitIcons";
import { useToast } from "../hooks/useToast";
import { useLayer } from "../hooks/useLayer";
import { setPageTitle } from "../lib/pageTitle";

export function AlbumsPage() {
  const {
    isOpen: createModalOpen,
    open: openCreateModal,
    close: closeCreateModal,
  } = useLayer("album-create");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setPageTitle("相册");
  }, []);

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["albums"],
    queryFn: fetchAlbums,
  });

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      await createAlbum({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
      });
      toast.success("相册创建成功");
      setNewTitle("");
      setNewDesc("");
      closeCreateModal();
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
    } catch {
      toast.error("创建相册失败，请重试");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Container size="standard">
      {/* 顶部标题、统计与新建操作 */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-[var(--color-border-light)]">
        <div className="flex items-baseline gap-2">
          <h1 className="font-heading font-medium text-xl md:text-2xl text-[var(--color-text-primary)]">
            相册
          </h1>
          {!isLoading && (
            <span className="text-xs text-[var(--color-text-muted)] font-mono">
              {albums.length} 本
            </span>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<PlusIcon size="sm" />}
          onClick={openCreateModal}
        >
          新建
        </Button>
      </div>

      {/* 相册网格 */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="flex flex-col rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] overflow-hidden animate-pulse"
            >
              <div className="aspect-square bg-[var(--color-surface-raised)]" />
              <div className="p-2.5 sm:p-3 space-y-1.5">
                <div className="h-4 bg-[var(--color-surface-raised)] rounded w-3/4" />
                <div className="h-3 bg-[var(--color-surface-raised)] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : albums.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-light)] p-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface-raised)] flex items-center justify-center text-[var(--color-text-muted)]">
            <AlbumIcon size="md" />
          </div>
          <h3 className="font-heading font-medium text-base text-[var(--color-text-primary)] mb-4">
            还没有相册
          </h3>
          <Button
            variant="primary"
            size="sm"
            shape="pill"
            icon={<PlusIcon size="sm" />}
            onClick={openCreateModal}
          >
            新建相册
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {albums.map((item: AlbumSummary) => (
            <Link
              key={item.id}
              to={`/albums/${item.id}`}
              className="group flex flex-col rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] overflow-hidden shadow-2xs hover:shadow-xs hover:border-[var(--color-border)] transition-[border-color,box-shadow] duration-150 cursor-pointer"
            >
              {/* 封面画幅：经典 1:1 正方形相册 */}
              <div className="relative w-full aspect-square bg-[var(--color-surface-raised)] overflow-hidden">
                {item.coverUrl ? (
                  <GalleryImage
                    src={item.coverUrl}
                    className="w-full h-full object-cover"
                    imgClassName="w-full h-full object-cover orbit-card-cover-zoom"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-surface-raised)]">
                    <AlbumIcon size="md" className="opacity-40 mb-1" />
                    <span className="text-xs font-sans">暂无照片</span>
                  </div>
                )}
              </div>

              {/* 信息区：纯净相册名 + 照片张数 */}
              <div className="p-2.5 sm:p-3 flex flex-col justify-center">
                <h3 className="font-heading font-medium text-sm sm:text-base text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors truncate">
                  {item.title}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
                  {item.photoCount} 张
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 新建相册弹窗 */}
      <Modal
        isOpen={createModalOpen}
        onClose={closeCreateModal}
        title="新建相册"
      >
        <form onSubmit={handleCreateAlbum} className="flex flex-col gap-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              相册名称 <span className="text-[var(--color-accent)]">*</span>
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例如：吃过的蛋糕、云南之旅、家里的小猫"
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              描述（选填）
            </label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="记录这本相册的故事..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border)] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-light)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeCreateModal}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={creating || !newTitle.trim()}
            >
              {creating ? "创建中…" : "创建"}
            </Button>
          </div>
        </form>
      </Modal>
    </Container>
  );
}
