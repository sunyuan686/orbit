import { useState, useRef, useCallback, useEffect } from "react";
import {
  checkMicrophoneSupport,
  formatMicrophoneError,
  getSupportedAudioType,
} from "../lib/audioUtils";

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
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
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

    const check = checkMicrophoneSupport();
    if (!check.supported) {
      setPermissionError(check.errorMessage || "当前环境不支持麦克风录音");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const { mimeType } = getSupportedAudioType();
      let options: MediaRecorderOptions = {};
      if (mimeType) {
        options = { mimeType };
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
      const userMsg = formatMicrophoneError(err);
      setPermissionError(userMsg);
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
        const mimeType = mediaRecorder.mimeType || getSupportedAudioType().mimeType || "audio/mp4";
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
