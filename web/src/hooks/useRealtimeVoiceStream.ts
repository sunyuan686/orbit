import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceTranscribeMode = "smooth" | "raw" | "bullets" | "formal";

export interface UseRealtimeVoiceStreamOptions {
  /** 语音转写模式: smooth (智能润色), raw (保持原文), bullets (要点列表), formal (正式书面) */
  mode?: VoiceTranscribeMode;
  /** 收到转写/润色文字更新 */
  onTextUpdate?: (text: string) => void;
  onError?: (error: string) => void;
}

export interface UseRealtimeVoiceStreamReturn {
  isStreaming: boolean;
  isProcessing: boolean;
  volumeBars: number[];
  startStreaming: () => Promise<void>;
  stopStreaming: (overrideMode?: VoiceTranscribeMode) => Promise<void>;
}

export function useRealtimeVoiceStream(
  options: UseRealtimeVoiceStreamOptions = {}
): UseRealtimeVoiceStreamReturn {
  const { mode = "smooth", onTextUpdate, onError } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volumeBars, setVolumeBars] = useState<number[]>([0.3, 0.5, 0.8, 0.4, 0.6]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isStreamingRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // 本地 0 延迟 SpeechRecognition 有限状态机引擎与历史文本持久化 Ref
  const recognitionRef = useRef<any>(null);
  const accumulatedHistoryRef = useRef<string>("");

  // 彻底停止麦克风音轨与硬件，释放浏览器地址栏图标
  const closeMicrophoneHardware = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
  }, []);

  const startAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!isStreamingRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const norm = Math.min(Math.max(avg / 128, 0.25), 1.4);

        const bars = [
          Math.min(Math.max(norm * 0.7, 0.2), 1.2),
          Math.min(Math.max(norm * 1.1, 0.35), 1.4),
          Math.min(Math.max(norm * 1.3, 0.4), 1.5),
          Math.min(Math.max(norm * 0.9, 0.3), 1.3),
          Math.min(Math.max(norm * 1.0, 0.25), 1.25),
        ];

        setVolumeBars(bars);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (e) {
      console.warn("Audio analyser failed", e);
    }
  }, []);

  // 第一性原理：状态机维持无限长语音连续实时吐字
  const createAndStartSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition || !isStreamingRef.current) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "zh-CN";

      let sessionFinalText = "";
      let sessionInterimText = "";

      recognition.onresult = (event: any) => {
        if (!isStreamingRef.current) return;

        let finalAccumulated = "";
        let interimAccumulated = "";

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res && res[0]) {
            if (res.isFinal) {
              finalAccumulated += res[0].transcript;
            } else {
              interimAccumulated += res[0].transcript;
            }
          }
        }

        sessionFinalText = finalAccumulated;
        sessionInterimText = interimAccumulated;

        const combined = (
          accumulatedHistoryRef.current +
          " " +
          sessionFinalText +
          " " +
          sessionInterimText
        )
          .replace(/\s+/g, " ")
          .trim();

        if (combined) {
          onTextUpdate?.(combined);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn("Local SpeechRecognition notice", err?.error);
      };

      recognition.onend = () => {
        if (isStreamingRef.current) {
          if (sessionFinalText.trim()) {
            accumulatedHistoryRef.current = (
              accumulatedHistoryRef.current +
              " " +
              sessionFinalText
            )
              .replace(/\s+/g, " ")
              .trim();
          }
          recognitionRef.current = null;
          setTimeout(() => {
            if (isStreamingRef.current) {
              createAndStartSpeechRecognition();
            }
          }, 50);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("SpeechRecognition create failed", err);
    }
  }, [onTextUpdate]);

  const startStreaming = useCallback(async () => {
    audioChunksRef.current = [];
    accumulatedHistoryRef.current = "";
    isStreamingRef.current = true;
    setIsStreaming(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 1. 启动 Web Audio API 动态分贝波形
      startAudioAnalyser(stream);

      // 2. 启动 0 延迟有限状态机 Web Speech 引擎
      createAndStartSpeechRecognition();

      // 3. 启动高清录音，用于结束时发送给 DashScope + DeepSeek 进行精修
      let options: MediaRecorderOptions = { audioBitsPerSecond: 24000 };
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm";
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);
    } catch (err: any) {
      console.error("Microphone access error", err);
      onError?.(err.message || "获取麦克风失败，请检查浏览器权限");
      setIsStreaming(false);
      isStreamingRef.current = false;
      closeMicrophoneHardware();
    }
  }, [closeMicrophoneHardware, createAndStartSpeechRecognition, onError, startAudioAnalyser]);

  const stopStreaming = useCallback(
    async (overrideMode?: VoiceTranscribeMode) => {
      isStreamingRef.current = false;
      setIsStreaming(false);

      const targetMode = overrideMode || mode;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        setIsProcessing(true);
        const mimeType = mediaRecorderRef.current.mimeType || "audio/webm";

        const blobPromise = new Promise<Blob>((resolve) => {
          if (!mediaRecorderRef.current) return resolve(new Blob([], { type: mimeType }));
          mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: mimeType });
            resolve(blob);
          };
        });

        mediaRecorderRef.current.stop();
        // 彻底释放麦克风硬件资源，让浏览器麦克风图标熄灭
        closeMicrophoneHardware();

        const audioBlob = await blobPromise;
        if (audioBlob && audioBlob.size > 1000) {
          try {
            const formData = new FormData();
            formData.append("file", audioBlob, "voice.webm");
            formData.append("mode", targetMode);

            const response = await fetch("/api/ai/voice-transcribe", {
              method: "POST",
              body: formData,
            });

            if (response.ok) {
              const reader = response.body?.getReader();
              const decoder = new TextDecoder();
              let accumulated = "";

              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  if (chunk) {
                    accumulated += chunk;
                    onTextUpdate?.(accumulated);
                  }
                }
              } else {
                const data = await response.json();
                const text = data.refinedText || data.rawText || data.text || "";
                if (text) onTextUpdate?.(text);
              }
            }
          } catch (err) {
            console.error("Backend transcribe failed", err);
            onError?.("语音转写失败，请重试");
          } finally {
            setIsProcessing(false);
          }
        } else {
          setIsProcessing(false);
        }
      } else {
        closeMicrophoneHardware();
      }

      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
    },
    [closeMicrophoneHardware, mode, onError, onTextUpdate]
  );

  useEffect(() => {
    return () => {
      closeMicrophoneHardware();
    };
  }, [closeMicrophoneHardware]);

  return {
    isStreaming,
    isProcessing,
    volumeBars,
    startStreaming,
    stopStreaming,
  };
}
