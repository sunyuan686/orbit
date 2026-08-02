import { useState } from "react";

export interface MediaAttachmentItem {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface MediaAttachmentsBarProps {
  attachments: MediaAttachmentItem[];
  onRemove: (id: string) => void;
  onUpdateAlt: (id: string, alt: string) => void;
}

export function MediaAttachmentsBar({
  attachments,
  onRemove,
  onUpdateAlt,
}: MediaAttachmentsBarProps) {
  const [editingAltId, setEditingAltId] = useState<string | null>(null);
  const [tempAlt, setTempAlt] = useState("");

  if (attachments.length === 0) return null;

  const handleOpenAlt = (item: MediaAttachmentItem) => {
    setEditingAltId(item.id);
    setTempAlt(item.alt || "");
  };

  const handleSaveAlt = (id: string) => {
    onUpdateAlt(id, tempAlt.trim());
    setEditingAltId(null);
  };

  return (
    <div className="orbit-compose-attachments-bar">
      <div className="orbit-compose-attachments-grid">
        {attachments.map((item) => (
          <div key={item.id} className="orbit-compose-attachment-card">
            <img src={item.url} alt={item.alt || "Attachment preview"} className="orbit-compose-attachment-img" />
            <button
              type="button"
              className="orbit-compose-attachment-remove"
              onClick={() => onRemove(item.id)}
              aria-label="删除图片"
              title="删除图片"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              className={`orbit-compose-attachment-alt-btn ${item.alt ? "has-alt" : ""}`}
              onClick={() => handleOpenAlt(item)}
            >
              {item.alt ? "ALT ✓" : "+ ALT"}
            </button>

            {editingAltId === item.id && (
              <div className="orbit-compose-alt-popover">
                <div className="orbit-compose-alt-header">
                  <span>添加替代文本 (ALT)</span>
                  <button type="button" onClick={() => setEditingAltId(null)} className="orbit-compose-alt-close">
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  value={tempAlt}
                  onChange={(e) => setTempAlt(e.target.value)}
                  className="orbit-compose-alt-input"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveAlt(item.id);
                    if (e.key === "Escape") setEditingAltId(null);
                  }}
                />
                <div className="orbit-compose-alt-actions">
                  <button type="button" onClick={() => handleSaveAlt(item.id)} className="orbit-btn orbit-btn-primary orbit-btn-sm">
                    完成
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
