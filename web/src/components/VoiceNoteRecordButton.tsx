import { useState, useRef, useCallback } from "react";
import { uploadAsset, type UploadAssetResult } from "../lib/api";

export interface VoiceNoteRecordButtonProps {
  entryId?: string;
  onVoiceNoteCreated: (result: UploadAssetResult) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function VoiceNoteRecordButton({
  entryId,
  onVoiceNoteCreated,
  disabled = false,
  compact = false,
  className = "",
}: VoiceNoteRecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopHardware = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      let options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm";
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("无法访问麦克风，请检查浏览器权限。");
      stopHardware();
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;

    setIsRecording(false);
    setIsUploading(true);

    const mimeType = mediaRecorderRef.current.mimeType || "audio/webm";

    const blobPromise = new Promise<Blob>((resolve) => {
      if (!mediaRecorderRef.current) return resolve(new Blob([], { type: mimeType }));
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        resolve(blob);
      };
    });

    mediaRecorderRef.current.stop();
    stopHardware();

    try {
      const audioBlob = await blobPromise;
      if (audioBlob && audioBlob.size > 500) {
        const ext = mimeType.includes("webm") ? ".webm" : ".wav";
        const file = new File([audioBlob], `voice_${Date.now()}${ext}`, { type: mimeType });
        const result = await uploadAsset(file, entryId);
        onVoiceNoteCreated(result);
      }
    } catch (err) {
      console.error("Failed to upload voice note:", err);
      alert("语音录制保存失败，请重试");
    } finally {
      setIsUploading(false);
      setRecordingSeconds(0);
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
        className={`orbit-compose-tool-btn opacity-80 cursor-wait text-amber-600 dark:text-amber-400 shrink-0 ${className}`}
        title="保存录音并转写中…"
        style={{ width: "auto" }}
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
      className={`orbit-compose-tool-btn text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shrink-0 ${className}`}
      title="录音随想附件 (录制语音 + 自动转写)"
      aria-label="录音随想附件"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 10v4" />
        <path d="M6 6v12" />
        <path d="M10 3v18" />
        <path d="M14 7v10" />
        <path d="M18 5v14" />
        <path d="M22 10v4" />
      </svg>
      {!compact && <span className="ml-1">录音附件</span>}
    </button>
  );
}
