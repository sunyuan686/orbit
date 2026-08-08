/**
 * 语音与音频录制全平台/PWA 兼容工具集
 */

export interface AudioFormatInfo {
  mimeType: string;
  extension: string;
}

/**
 * 获取当前浏览器及 PWA 环境下最匹配且被原生理支持的 MediaRecorder 录音格式
 */
export function getSupportedAudioType(): AudioFormatInfo {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "", extension: ".wav" };
  }

  const candidates: AudioFormatInfo[] = [
    { mimeType: "audio/webm;codecs=opus", extension: ".webm" },
    { mimeType: "audio/webm", extension: ".webm" },
    { mimeType: "audio/mp4", extension: ".mp4" },
    { mimeType: "audio/aac", extension: ".aac" },
    { mimeType: "audio/ogg;codecs=opus", extension: ".ogg" },
    { mimeType: "audio/wav", extension: ".wav" },
  ];

  for (const item of candidates) {
    if (MediaRecorder.isTypeSupported(item.mimeType)) {
      return item;
    }
  }

  // iOS Safari / PWA 兜底 fallback
  return { mimeType: "", extension: ".mp4" };
}

/**
 * 检查当前环境是否满足麦克风录音的前置安全要求（如 Secure Context）
 */
export function checkMicrophoneSupport(): { supported: boolean; errorMessage?: string } {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { supported: false, errorMessage: "非浏览器环境" };
  }

  // 1. 检查是否在 Secure Context (HTTPS 或 localhost)
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]";

  if (!window.isSecureContext && !isLocalhost) {
    return {
      supported: false,
      errorMessage:
        "语音与录音功能要求在安全环境 (HTTPS 或 localhost) 下使用。如果使用局域网 IP / HTTP 访问，浏览器会禁用麦克风 API，请改用 HTTPS 访问。",
    };
  }

  // 2. 检查 navigator.mediaDevices 与 getUserMedia 是否支持
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      supported: false,
      errorMessage: "当前浏览器或 PWA 环境不支持麦克风录音 API (navigator.mediaDevices.getUserMedia)",
    };
  }

  return { supported: true };
}

/**
 * 解析 getUserMedia 抛出的异常，返回用户友好的详细错误提示
 */
export function formatMicrophoneError(err: any): string {
  if (!err) return "获取麦克风失败，请检查浏览器权限";

  const errName = err.name || "";
  const errMsg = err.message || "";

  if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
    return "麦克风权限已被拒绝。若在 iOS/PWA 主屏幕应用中使用，请前往 iOS【设置】->【隐私与安全性】->【麦克风】允许 Orbit 访问麦克风；若在浏览器中请在地址栏设置中开启。";
  }

  if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
    return "未检测到可用的麦克风设备，请检查音频设备。";
  }

  if (errName === "NotReadableError" || errName === "TrackStartError") {
    return "麦克风正被其他应用占用，请关闭其他正在使用麦克风的软件后重试。";
  }

  if (errName === "SecurityError") {
    return "语音功能受浏览器安全策略限制，请确保运行在 HTTPS 环境下。";
  }

  return errMsg || "无法访问麦克风，请检查浏览器与设备权限。";
}
