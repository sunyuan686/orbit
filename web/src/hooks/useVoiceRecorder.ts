import { useState, useRef, useCallback, useEffect } from "react";

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  recordingTime: number;
  permissionError: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopStreamTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      stopStreamTracks();
    };
  }, [clearTimer, stopStreamTracks]);

  const startRecording = useCallback(async () => {
    setPermissionError(null);
    setRecordingTime(0);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError("您的浏览器不支持麦克风录音功能");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 选出可用的 mimeType (webkit/chrome 常见为 audio/webm，safari 常见为 audio/mp4 或 audio/aac)
      let options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options = { mimeType: "audio/mp4" };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200); // 200ms slice
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access failed", err);
      stopStreamTracks();
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionError("麦克风权限被拒绝，请在浏览器地址栏旁开启麦克风权限");
      } else {
        setPermissionError("无法获取麦克风音频，请检查设备设置");
      }
    }
  }, [stopStreamTracks]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      clearTimer();
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        stopStreamTracks();
        setIsRecording(false);
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stopStreamTracks();
        setIsRecording(false);
        mediaRecorderRef.current = null;
        resolve(audioBlob);
      };

      mediaRecorder.stop();
    });
  }, [clearTimer, stopStreamTracks]);

  const cancelRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    stopStreamTracks();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingTime(0);
  }, [clearTimer, stopStreamTracks]);

  return {
    isRecording,
    recordingTime,
    permissionError,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
