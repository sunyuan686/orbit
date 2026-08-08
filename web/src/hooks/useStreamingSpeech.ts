import { useState, useRef, useCallback, useEffect } from "react";
import {
  checkMicrophoneSupport,
  formatMicrophoneError,
} from "../lib/audioUtils";

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
  const consecutiveErrorsRef = useRef(0);

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
      consecutiveErrorsRef.current = 0;
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
      console.error("Streaming speech recognition error", event?.error);
      consecutiveErrorsRef.current += 1;

      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        isListeningRef.current = false;
        setIsListening(false);
        onError?.(formatMicrophoneError({ name: "NotAllowedError" }));
      } else if (event?.error !== "no-speech") {
        onError?.(`语音识别错误: ${event?.error || "未知错误"}`);
      }

      if (consecutiveErrorsRef.current >= 3) {
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && consecutiveErrorsRef.current < 3) {
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
    const check = checkMicrophoneSupport();
    if (!check.supported) {
      onError?.(check.errorMessage || "当前环境不支持语音识别");
      return;
    }

    if (!recognitionRef.current) return;
    try {
      consecutiveErrorsRef.current = 0;
      finalTextRef.current = "";
      setFinalText("");
      setInterimText("");
      isListeningRef.current = true;
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error("Start listening error", err);
    }
  }, [onError]);

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
