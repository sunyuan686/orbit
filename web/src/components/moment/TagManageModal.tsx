import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useMomentTags } from "../../hooks/useMomentTags";
import { useToast } from "../../hooks/useToast";
import { EditIcon, TrashIcon, CheckIcon, CloseIcon } from "../OrbitIcons";
import { getApiErrorMessage } from "../../lib/api";

export interface TagManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagCreated?: (tagId: string) => void;
}

export function TagManageModal({
  isOpen,
  onClose,
  onTagCreated,
}: TagManageModalProps) {
  const toast = useToast();
  const {
    tags,
    createTag,
    isCreating,
    updateTag,
    isUpdating,
    deleteTag,
    isDeleting,
  } = useMomentTags();

  // 新建标签表单状态
  const [newName, setNewName] = useState("");

  // 行内编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // 删除确认状态
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error("标签名称不能为空");
      return;
    }
    try {
      await updateTag({
        id,
        data: {
          name: trimmed,
        },
      });
      toast.success("标签已更新");
      setEditingId(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "更新标签失败"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTag(id);
      toast.success("标签已删除");
      setDeletingId(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "删除标签失败"));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("请输入标签名称");
      return;
    }
    try {
      const created = await createTag({
        name: trimmed,
      });
      toast.success("标签创建成功");
      setNewName("");
      onTagCreated?.(created.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "创建标签失败"));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="动态标签管理"
      maxWidth="28rem"
    >
      <div className="flex flex-col gap-4">
        {/* 现存标签列表 */}
        <div className="flex flex-col divide-y divide-[var(--color-border-light)] border border-[var(--color-border-light)] rounded-xl overflow-hidden bg-[var(--color-bg)]">
          {tags.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
              暂无标签，请在下方新增
            </div>
          ) : (
            tags.map((tag) => {
              const isEditing = editingId === tag.id;
              const isConfirmingDelete = deletingId === tag.id;

              if (isEditing) {
                return (
                  <div key={tag.id} className="p-3 flex items-center gap-2 bg-[var(--color-surface)]">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                      placeholder="标签名称"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleSaveEdit(tag.id);
                        } else if (e.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(tag.id)}
                      disabled={isUpdating}
                      className="p-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                      title="保存"
                    >
                      <CheckIcon size="sm" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer shrink-0"
                      title="取消"
                    >
                      <CloseIcon size="sm" />
                    </button>
                  </div>
                );
              }

              if (isConfirmingDelete) {
                return (
                  <div key={tag.id} className="p-3 flex items-center justify-between bg-red-500/5 text-xs">
                    <span className="text-red-600 dark:text-red-400">
                      确认删除「{tag.name}」？历史动态将转为普通展示。
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(tag.id)}
                        disabled={isDeleting}
                        className="px-2 py-0.5 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition-colors cursor-pointer"
                      >
                        确认
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={tag.id}
                  className="px-3 py-2.5 flex items-center justify-between bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)] transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono select-none">
                      #
                    </span>
                    <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                      {tag.name}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                      {tag.count ?? 0} 条动态
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(tag.id, tag.name)}
                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
                      title="编辑标签"
                    >
                      <EditIcon size="sm" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(tag.id)}
                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="删除标签"
                    >
                      <TrashIcon size="sm" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 新增标签区域 */}
        <form onSubmit={handleCreate} className="flex flex-col gap-2 pt-2 border-t border-[var(--color-border-light)]">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">新增标签</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="输入新标签名称，如「旅行」"
              maxLength={30}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] transition-colors"
            />
            <button
              type="submit"
              disabled={isCreating || !newName.trim()}
              className="px-3.5 py-1.5 text-xs rounded-xl bg-[var(--color-primary)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer select-none shrink-0"
            >
              {isCreating ? "添加中…" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
