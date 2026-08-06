import { useCallback } from "react";
import { useRealtimeVoiceStream } from "../hooks/useRealtimeVoiceStream";
import { useAppSettings } from "../lib/appSettingsContext";

export interface VoiceInputButtonProps {
  /** 实时打字回调：收到最新的全量识别文本时传给编辑器覆盖写入 */
  onTextUpdate: (text: string) => void;
  /** 开启语音回调 */
  onStreamStart?: () => void;
  /** 关闭语音回调 */
  onStreamEnd?: () => void;
  className?: string;
  title?: string;
  compact?: boolean;
}

export function VoiceInputButton({
  onTextUpdate,
  onStreamStart,
  onStreamEnd,
  className = "",
  title = "语音打字 (点击说话)",
  compact = false,
}: VoiceInputButtonProps) {
  const { settings } = useAppSettings();
  const currentMode = settings?.voiceTranscribeMode ?? "smooth";

  const handleTextUpdate = useCallback(
    (text: string) => {
      if (text) {
        onTextUpdate(text);
      }
    },
    [onTextUpdate]
  );

  const { isStreaming, volumeBars, startStreaming, stopStreaming } =
    useRealtimeVoiceStream({
      mode: currentMode,
      onTextUpdate: handleTextUpdate,
      onError: (err) => console.error("Realtime voice stream notice", err),
    });

  const handleClick = async () => {
    if (isStreaming) {
      stopStreaming();
      onStreamEnd?.();
    } else {
      onStreamStart?.();
      await startStreaming();
    }
  };

  // Compact 极简图标模式（用于编辑框底部工具栏）—— 第一性原理：零杂音单功能按钮
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        className={`orbit-compose-tool-btn transition-all duration-200 hover:text-white shrink-0 relative ${
          isStreaming ? "text-red-400 font-bold" : ""
        } ${className}`}
        title={isStreaming ? "点击完成语音打字" : title}
        aria-label={title}
      >
        {isStreaming ? (
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>
    );
  }

  // 非 Compact 胶囊按钮（用于 ComposeModal 发帖浮层）
  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={`orbit-voice-pill ${
        isStreaming ? "orbit-voice-pill--recording" : ""
      } ${className}`}
      title={isStreaming ? "点击完成语音打字" : title}
      aria-label={title}
    >
      {isStreaming ? (
        <span className="flex flex-row items-center gap-2 whitespace-nowrap shrink-0">
          <span className="orbit-voice-dot shrink-0" />
          <div className="orbit-equalizer shrink-0">
            {volumeBars.map((val, idx) => (
              <span
                key={idx}
                className="orbit-equalizer-bar"
                style={{
                  transform: `scaleY(${val})`,
                  transition: "transform 80ms ease-out",
                }}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-red-200 whitespace-nowrap">
            说话中 (点击完成)
          </span>
        </span>
      ) : (
        <span className="flex flex-row items-center gap-1.5 whitespace-nowrap shrink-0">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          <span className="text-xs font-medium whitespace-nowrap">语音打字</span>
        </span>
      )}
    </button>
  );
}
