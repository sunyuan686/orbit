import { useState, useRef, useCallback } from "react";
import { uploadAsset, type UploadAssetResult } from "../lib/api";
import { useToast } from "../hooks/useToast";
import {
  checkMicrophoneSupport,
  formatMicrophoneError,
  getSupportedAudioType,
} from "../lib/audioUtils";
import { AudioWaveIcon } from "./OrbitIcons";

export interface VoiceNoteRecordButtonProps {
  entryId?: string;
  onVoiceNoteCreated: (result: UploadAssetResult) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function VoiceNoteRecordButton({
  entryId,
  onVoiceNoteCreated,
  onUploadStateChange,
  disabled = false,
  compact = false,
  className = "",
}: VoiceNoteRecordButtonProps) {
  const toast = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopHardware = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    const check = checkMicrophoneSupport();
    if (!check.supported) {
      toast.error(check.errorMessage || "当前环境不支持录音功能");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const { mimeType } = getSupportedAudioType();
      let options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(200);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      stopHardware();
      const userMessage = formatMicrophoneError(err);
      toast.error(userMessage);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;

    const durationMs = Date.now() - startTimeRef.current;

    // 第一性原理：信息量有效性门槛。录音小于 1.5 秒判定为误触或环境噪声，直接丢弃不产生垃圾资产
    if (durationMs < 1500) {
      mediaRecorderRef.current.stop();
      stopHardware();
      setIsRecording(false);
      setRecordingSeconds(0);
      toast.error("说话时间太短，已取消录音");
      return;
    }

    setIsRecording(false);
    setIsUploading(true);
    onUploadStateChange?.(true);

    const recorderMime = mediaRecorderRef.current.mimeType || "";
    const effectiveMime = recorderMime || getSupportedAudioType().mimeType || "audio/mp4";

    let ext = ".webm";
    if (effectiveMime.includes("mp4")) ext = ".mp4";
    else if (effectiveMime.includes("aac")) ext = ".aac";
    else if (effectiveMime.includes("wav")) ext = ".wav";
    else if (effectiveMime.includes("ogg")) ext = ".ogg";

    const blobPromise = new Promise<Blob>((resolve) => {
      if (!mediaRecorderRef.current) return resolve(new Blob([], { type: effectiveMime }));
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: effectiveMime });
        resolve(blob);
      };
    });

    mediaRecorderRef.current.stop();
    stopHardware();

    try {
      const audioBlob = await blobPromise;
      if (audioBlob && audioBlob.size > 200) {
        const file = new File([audioBlob], `voice_${Date.now()}${ext}`, { type: effectiveMime });
        const result = await uploadAsset(file, entryId, { duration: recordingSeconds });
        onVoiceNoteCreated(result);
      }
    } catch (err) {
      console.error("Failed to upload voice note:", err);
      toast.error("语音录制保存失败，请重试");
    } finally {
      setIsUploading(false);
      setRecordingSeconds(0);
      onUploadStateChange?.(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (isUploading) {
    return (
      <button
        type="button"
        disabled
        className={
          compact
            ? `orbit-ai-action-icon-btn opacity-80 cursor-wait shrink-0 ${className}`
            : `orbit-compose-tool-btn opacity-80 cursor-wait shrink-0 ${className}`
        }
        style={{ width: "auto", color: "var(--color-accent)" }}
        title="保存录音并转写中…"
      >
        <span className="animate-spin inline-block text-xs">⏳</span>
        {!compact && <span className="ml-1 text-xs">保存录音中…</span>}
      </button>
    );
  }

  if (isRecording) {
    return (
      <button
        type="button"
        onClick={() => void stopRecording()}
        className={`orbit-voice-note-recording-pill flex flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25 animate-pulse font-mono text-xs whitespace-nowrap shrink-0 cursor-pointer ${className}`}
        title="点击完成录制并保存音频附件"
        style={{ width: "auto", minWidth: "max-content" }}
      >
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
        <span>{formatSeconds(recordingSeconds)}</span>
        <span className="text-[10px] font-sans opacity-90">(完成)</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void startRecording()}
      disabled={disabled}
      className={
        compact
          ? `orbit-ai-action-icon-btn shrink-0 ${className}`
          : `orbit-compose-tool-btn text-stone-600 dark:text-stone-300 hover:text-[var(--color-accent)] transition-colors shrink-0 ${className}`
      }
      title="录音随想 (录制音频附件)"
      data-tooltip="录音"
      aria-label="录音随想"
    >
      <AudioWaveIcon size="sm" />
      {!compact && <span className="ml-1">录音附件</span>}
    </button>
  );
}
