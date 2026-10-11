import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAlbum,
  updateAlbum,
  deleteAlbum,
  uploadAsset,
  addAlbumAssets,
  removeAlbumAsset,
  type AlbumPhotoItem,
} from "../lib/api";
import { GalleryImage } from "../components/GalleryImage";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { Button, Container } from "../components/ui";
import { Modal } from "../components/ui/Modal";
import {
  ArrowLeftIcon,
  TrashIcon,
  EditIcon,
  AlbumIcon,
} from "../components/OrbitIcons";
import { useToast } from "../hooks/useToast";
import { useLayer } from "../hooks/useLayer";
import { setPageTitle } from "../lib/pageTitle";

export function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    isOpen: editModalOpen,
    open: openEditModal,
    close: closeEditModal,
  } = useLayer("album-edit");
  const {
    isOpen: deleteModalOpen,
    open: openDeleteModal,
    close: closeDeleteModal,
  } = useLayer("album-delete");
  const {
    isOpen: photoOpen,
    open: openPhoto,
    close: closePhoto,
  } = useLayer("album-photo");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 「看第几张」是载荷，不参与开关判定；开关由 photoOpen（location 派生）承担
  const [previewIndex, setPreviewIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: album, isLoading } = useQuery({
    queryKey: ["album", id],
    queryFn: () => fetchAlbum(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (album?.title) {
      setPageTitle(album.title);
    }
  }, [album?.title]);

  const handleOpenEditModal = () => {
    if (album) {
      setEditTitle(album.title);
      setEditDesc(album.description || "");
    }
    openEditModal();
  };

  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !id) return;

    setUploading(true);
    try {
      const uploadedIds: string[] = [];
      for (const file of files) {
        const res = await uploadAsset(file);
        if (res.id) uploadedIds.push(res.id);
        else if (res.filename) uploadedIds.push(res.filename);
      }

      if (id !== "all" && uploadedIds.length > 0) {
        await addAlbumAssets(id, uploadedIds);
      }
      toast.success(`成功添加 ${files.length} 张照片`);
      void queryClient.invalidateQueries({ queryKey: ["album", id] });
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
    } catch {
      toast.error("照片上传或添加失败，请重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSetCover = async (storageKey: string) => {
    if (!id) return;
    try {
      await updateAlbum(id, { coverStorageKey: storageKey });
      toast.success("已更新为相册封面");
      void queryClient.invalidateQueries({ queryKey: ["album", id] });
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
    } catch {
      toast.error("设置封面失败");
    }
  };

  const handleRemovePhoto = async (photo: AlbumPhotoItem) => {
    if (!id) return;
    try {
      await removeAlbumAsset(id, photo.assetId);
      toast.success("已从相册移除");
      void queryClient.invalidateQueries({ queryKey: ["album", id] });
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
    } catch {
      toast.error("移除失败");
    }
  };

  const handleUpdateAlbumInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editTitle.trim()) return;

    setSaving(true);
    try {
      await updateAlbum(id, {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
      });
      toast.success("相册信息已保存");
      closeEditModal();
      void queryClient.invalidateQueries({ queryKey: ["album", id] });
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAlbum = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await deleteAlbum(id);
      toast.success("相册已删除");
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
      // 层内跳页面：用 replace 把带层的相册条目换成列表页，返回时不会回到已删除的相册。
      navigate("/albums", { replace: true });
    } catch {
      toast.error("删除失败");
      closeDeleteModal();
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Container size="standard">
        {/* 顶部操作导航栏骨架 */}
        <div className="flex items-center justify-between mb-4 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-raised)]" />
          <div className="w-20 h-8 rounded-lg bg-[var(--color-surface-raised)]" />
        </div>

        {/* 相册头图与介绍骨架 */}
        <div className="mb-5 sm:mb-6 pb-3 sm:pb-4 border-b border-transparent sm:border-[var(--color-border-light)] animate-pulse space-y-2">
          <div className="h-7 w-44 bg-[var(--color-surface-raised)] rounded-lg" />
          <div className="h-3.5 w-24 bg-[var(--color-surface-raised)] rounded" />
        </div>

        {/* 照片画廊网格骨架（与真实网格完全同构） */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="aspect-square rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] animate-pulse"
            />
          ))}
        </div>
      </Container>
    );
  }

  if (!album) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">相册不存在或已被删除</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/albums")}
          className="mt-4"
        >
          返回相册
        </Button>
      </div>
    );
  }

  return (
    <Container size="standard">
      {/* 顶部纯净操作导航栏 */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          // 与系统返回手势同源（回到来处）。若用 navigate("/albums") 会再压一条条目，
          // 返回手势便会退回到刚离开的相册详情，形成"幽灵条目"。
          onClick={() => navigate(-1)}
          aria-label="返回"
          className="p-1.5 -ml-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
        >
          <ArrowLeftIcon size="md" />
        </button>

        <div className="flex items-center gap-2">
          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleUploadPhotos}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "上传中…" : "添加照片"}
          </Button>

          {!album.isDefault && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<EditIcon size="sm" />}
                onClick={handleOpenEditModal}
                aria-label="编辑信息"
              />

              <Button
                variant="danger"
                size="sm"
                icon={<TrashIcon size="sm" />}
                onClick={openDeleteModal}
                aria-label="删除相册"
              />
            </>
          )}
        </div>
      </div>

      {/* 相册头图与介绍（移动端无硬横线，由自然留白构建层级；桌面端保持优雅书卷线） */}
      <div className="mb-5 sm:mb-6 pb-3 sm:pb-4 border-b border-transparent sm:border-[var(--color-border-light)]">
        <div className="flex items-center gap-2">
          <h1 className="font-heading font-medium text-2xl text-[var(--color-text-primary)]">
            {album.title}
          </h1>
        </div>
        {!album.isDefault && album.description && (
          <p className="text-sm text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
            {album.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[var(--color-text-muted)]">
          <span>{album.photoCount} 张照片</span>
          {!album.isDefault && (
            <>
              <span>·</span>
              <span>由 {album.authorName || album.author} 创建</span>
            </>
          )}
        </div>
      </div>

      {/* 照片画廊网格 */}
      {album.photos.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-light)] p-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface-raised)] flex items-center justify-center text-[var(--color-text-muted)]">
            <AlbumIcon size="md" />
          </div>
          <h3 className="font-heading font-medium text-base text-[var(--color-text-primary)] mb-4">
            {album.isDefault ? "还没有任何照片" : "相册还是空的"}
          </h3>
          <Button
            variant="primary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "上传中…" : "添加照片"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {album.photos.map((photo: AlbumPhotoItem, index: number) => {
            const isCover = album.coverStorageKey === photo.storageKey;
            return (
              <div
                key={photo.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-[var(--color-surface-raised)] border border-[var(--color-border-light)] shadow-2xs hover:shadow-md transition-[box-shadow] duration-150"
              >
                <div
                  className="w-full h-full cursor-pointer"
                  onClick={() => {
                    setPreviewIndex(index);
                    openPhoto();
                  }}
                >
                  <GalleryImage
                    src={photo.thumbUrl || photo.url}
                    blurhash={photo.blurhash}
                    width={photo.width}
                    height={photo.height}
                    className="w-full h-full object-cover"
                    imgClassName="w-full h-full object-cover orbit-card-cover-zoom"
                  />
                </div>

                {/* 封面角标 */}
                {isCover && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white text-[10px] font-medium leading-none shadow-xs">
                    封面
                  </div>
                )}

                {/* 悬浮操作胶囊（自建相册才显示操作） */}
                {!album.isDefault && (
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                    {!isCover && (
                      <button
                        type="button"
                        onClick={() => handleSetCover(photo.storageKey)}
                        className="text-[10px] px-2 py-1 rounded bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs font-sans transition-colors cursor-pointer"
                      >
                        设封面
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo)}
                      title="从相册移除"
                      className="p-1 rounded bg-black/40 hover:bg-red-600/80 text-white backdrop-blur-xs transition-colors ml-auto cursor-pointer"
                    >
                      <TrashIcon size="sm" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 照片全屏高内聚手势灯箱（返回手势与关闭按钮同源） */}
      {photoOpen && (
        <PhotoLightbox
          photos={album.photos}
          initialIndex={previewIndex}
          onClose={closePhoto}
          onIndexChange={setPreviewIndex}
        />
      )}

      {/* 编辑相册信息弹窗 */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title="编辑相册信息"
      >
        <form onSubmit={handleUpdateAlbumInfo} className="flex flex-col gap-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              相册标题
            </label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              相册描述
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border)] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-light)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeEditModal}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving || !editTitle.trim()}
            >
              {saving ? "保存中…" : "保存修改"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="删除相册"
      >
        <div className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          确定要删除相册《{album.title}》吗？删除后照片仍会保留在媒体库中，但相册分组将被移除。
        </div>
        <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-[var(--color-border-light)]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={closeDeleteModal}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleDeleteAlbum}
            disabled={saving}
            className="bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 text-white"
          >
            {saving ? "删除中…" : "确认删除"}
          </Button>
        </div>
      </Modal>
    </Container>
  );
}
