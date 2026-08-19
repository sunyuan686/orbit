import { useState } from "react";
import "../lib/initVoiceCards";
import { resolveMediaType } from "../lib/content";

export interface MediaAttachmentItem {
  id: string;
  url: string;
  mimeType?: string;
  alt?: string;
  width?: number;
  height?: number;
  duration?: number;
  transcript?: string;
}

interface MediaAttachmentsBarProps {
  attachments: MediaAttachmentItem[];
  onRemove: (id: string) => void;
  onUpdateAlt: (id: string, alt: string) => void;
  onUpdateTranscript?: (id: string, transcript: string) => void;
}

const WAVEFORM_HEIGHTS = [35, 50, 80, 60, 40, 90, 100, 75, 50, 65, 85, 45, 95, 70, 80, 55, 35, 90, 60, 45, 75, 85, 50, 35];

export function MediaAttachmentsBar({
  attachments,
  onRemove,
  onUpdateAlt,
  onUpdateTranscript,
}: MediaAttachmentsBarProps) {
  const [editingAltId, setEditingAltId] = useState<string | null>(null);
  const [tempAlt, setTempAlt] = useState("");

  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
  const [tempTranscript, setTempTranscript] = useState("");

  if (attachments.length === 0) return null;

  const audioItems = attachments.filter((item) => resolveMediaType(item) === "audio");
  const mediaItems = attachments.filter((item) => resolveMediaType(item) !== "audio");

  const handleOpenAlt = (item: MediaAttachmentItem) => {
    setEditingAltId(item.id);
    setTempAlt(item.alt || "");
  };

  const handleSaveAlt = (id: string) => {
    onUpdateAlt(id, tempAlt.trim());
    setEditingAltId(null);
  };

  const handleOpenTranscript = (item: MediaAttachmentItem) => {
    setEditingTranscriptId(item.id);
    setTempTranscript(item.transcript || "");
  };

  const handleSaveTranscript = (id: string) => {
    onUpdateTranscript?.(id, tempTranscript.trim());
    setEditingTranscriptId(null);
  };

  return (
    <div className="orbit-compose-attachments-bar flex flex-col gap-3 my-2">
      {/* 1. 语音附件预览列表 (渲染全效音波播放器，可在发帖前即时预览、试听与校对文稿) */}
      {audioItems.length > 0 && (
        <div className="orbit-compose-audio-attachments flex flex-col gap-2">
          {audioItems.map((item) => {
            const isEditingThis = editingTranscriptId === item.id;

            return (
              <div
                key={item.id}
                className="orbit-prose-audio-block orbit-voice-card relative group select-none"
              >
                <div className="orbit-voice-card-main">
                  <button
                    type="button"
                    className="orbit-voice-play-btn"
                    title="播放/暂停预听"
                  >
                    <svg className="w-3.5 h-3.5 fill-current ml-0.5 orbit-voice-play-icon" viewBox="0 0 24 24">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <svg className="w-3.5 h-3.5 fill-current hidden orbit-voice-pause-icon" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  </button>

                  <div className="orbit-voice-waveform">
                    {WAVEFORM_HEIGHTS.map((h, idx) => (
                      <span
                        key={idx}
                        className="orbit-voice-bar"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>

                  <span className="orbit-voice-time">
                    0:00
                  </span>

                  {item.transcript ? (
                    <button
                      type="button"
                      className="orbit-voice-transcript-toggle"
                      title="展开/折叠转写文稿"
                    >
                      <span className="select-none">💬</span>
                      <span>文稿</span>
                    </button>
                  ) : (
                    onUpdateTranscript && (
                      <button
                        type="button"
                        onClick={() => handleOpenTranscript(item)}
                        className="orbit-voice-transcript-toggle"
                        title="添加文字稿"
                      >
                        <span className="select-none">＋</span>
                        <span>文稿</span>
                      </button>
                    )
                  )}

                  {/* 删除语音按钮 */}
                  <button
                    type="button"
                    className="w-6 h-6 rounded-full bg-stone-200/80 dark:bg-stone-800/80 text-stone-500 hover:text-red-500 flex items-center justify-center transition-colors shrink-0 cursor-pointer ml-0.5"
                    onClick={() => onRemove(item.id)}
                    title="删除此语音附件"
                    aria-label="删除此语音附件"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* 编辑态与展示态文稿区域 */}
                {isEditingThis ? (
                  <div className="orbit-voice-transcript-block flex flex-col gap-2">
                    <textarea
                      value={tempTranscript}
                      onChange={(e) => setTempTranscript(e.target.value)}
                      placeholder="输入或修改语音转写文稿…"
                      rows={3}
                      autoFocus
                      className="orbit-voice-textarea"
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          handleSaveTranscript(item.id);
                        } else if (e.key === "Escape") {
                          setEditingTranscriptId(null);
                        }
                      }}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingTranscriptId(null)}
                        className="px-2 py-1 text-xs rounded text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveTranscript(item.id)}
                        className="orbit-voice-transcript-edit-btn"
                      >
                        完成
                      </button>
                    </div>
                  </div>
                ) : (
                  item.transcript && (
                    <div className="orbit-voice-transcript-block hidden">
                      <div className="flex items-start justify-between gap-2">
                        <p className="orbit-voice-transcript flex-1 min-w-0 m-0 font-sans whitespace-pre-wrap break-words">
                          {item.transcript}
                        </p>
                        {onUpdateTranscript && (
                          <button
                            type="button"
                            onClick={() => handleOpenTranscript(item)}
                            className="orbit-voice-transcript-edit-btn"
                            title="修改文字稿"
                          >
                            编辑
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}

                <audio src={item.url} controls className="orbit-prose-audio hidden" />
              </div>
            );
          })}
        </div>
      )}

      {/* 2. 图片与视频缩略卡片网格 */}
      {mediaItems.length > 0 && (
        <div className="orbit-compose-attachments-grid">
          {mediaItems.map((item) => {
            const isVideo = resolveMediaType(item) === "video";
            return (
              <div key={item.id} className="orbit-compose-attachment-card">
                {isVideo ? (
                  <div className="w-full h-full relative overflow-hidden rounded-lg bg-stone-900 flex items-center justify-center">
                    <video
                      src={item.url}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-white/90">
                      <span className="text-base drop-shadow-sm">🎬</span>
                      {item.duration ? (
                        <span className="text-[9px] font-mono mt-0.5 bg-black/60 px-1 py-0.2 rounded">
                          {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}
                        </span>
                      ) : (
                        <span className="text-[9px] mt-0.5 bg-black/60 px-1 py-0.2 rounded opacity-90">视频</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <img src={item.url} alt={item.alt || "Attachment preview"} className="orbit-compose-attachment-img" />
                )}
              <button
                type="button"
                className="orbit-compose-attachment-remove"
                onClick={() => onRemove(item.id)}
                aria-label="删除媒体"
                title="删除媒体"
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
            );
          })}
        </div>
      )}
    </div>
  );
}
