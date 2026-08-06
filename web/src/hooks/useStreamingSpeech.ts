import { useState, useRef, useCallback, useEffect } from "react";

export interface UseStreamingSpeechOptions {
  lang?: string;
  onTranscriptChange?: (finalText: string, interimText: string) => void;
  onError?: (error: string) => void;
}

export interface UseStreamingSpeechReturn {
  isListening: boolean;
  isSupported: boolean;
  finalText: string;
  interimText: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
}

export function useStreamingSpeech(
  options: UseStreamingSpeechOptions = {}
): UseStreamingSpeechReturn {
  const { lang = "zh-CN", onTranscriptChange, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const finalTextRef = useRef("");

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let currentFinal = "";
      let currentInterim = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || "";

        if (result.isFinal) {
          currentFinal += transcript;
        } else {
          currentInterim += transcript;
        }
      }

      if (currentFinal) {
        finalTextRef.current += currentFinal;
        setFinalText(finalTextRef.current);
      }

      setInterimText(currentInterim);
      onTranscriptChange?.(finalTextRef.current, currentInterim);
    };

    recognition.onerror = (event: any) => {
      console.error("Streaming speech recognition error", event.error);
      if (event.error === "not-allowed") {
        onError?.("麦克风权限被拒绝，请在浏览器地址栏旁允许使用麦克风");
      } else if (event.error !== "no-speech") {
        onError?.(`语音识别错误: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // 如果还在录音状态中（防止自动断开），自动尝试续连
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          isListeningRef.current = false;
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [lang, onTranscriptChange, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      finalTextRef.current = "";
      setFinalText("");
      setInterimText("");
      isListeningRef.current = true;
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error("Start listening error", err);
    }
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    finalTextRef.current = "";
    setFinalText("");
    setInterimText("");
  }, []);

  return {
    isListening,
    isSupported,
    finalText,
    interimText,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}
