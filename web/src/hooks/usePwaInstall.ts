import { useCallback, useSyncExternalStore } from "react";
import { useLayer } from "./useLayer";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaState {
  hasPrompt: boolean;
  isStandalone: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone) ||
    document.referrer.includes("android-app://")
  );
}

let state: PwaState = {
  hasPrompt: false,
  isStandalone: isRunningStandalone(),
};

const serverState: PwaState = {
  hasPrompt: false,
  isStandalone: false,
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function updateState(partial: Partial<PwaState>) {
  state = { ...state, ...partial };
  emitChange();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    updateState({ hasPrompt: true });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateState({ hasPrompt: false, isStandalone: true });
  });

  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", (e) => {
    updateState({ isStandalone: e.matches });
  });
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => serverState;

export function usePwaInstall() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // 安装指引是一个可被返回手势关闭的浮层，因此它的开关必须是一条历史条目，
  // 而不是这个 store 里的第二个布尔量。useLayer 由 location 派生，多处调用共享同一真相。
  const {
    isOpen: guideOpen,
    open: openGuide,
    close: closeGuide,
  } = useLayer("pwa-guide");

  // 环境特征检测（会话生命周期内恒定）
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS =
    typeof window !== "undefined" &&
    (/iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const isSafari =
    typeof window !== "undefined" &&
    /Safari/i.test(ua) &&
    !/Chrome|CriOS|FxiOS|EdgiOS|MicroMessenger/i.test(ua);
  const isInAppBrowser = /MicroMessenger|Feishu|Lark|Weibo|QQ\//i.test(ua);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          deferredPrompt = null;
          updateState({ hasPrompt: false });
        }
      } catch (err) {
        console.warn("[pwa] Prompt invocation failed, showing guide", err);
        openGuide();
      }
    } else {
      openGuide();
    }
  }, [openGuide]);

  return {
    isStandalone: store.isStandalone,
    canPrompt: store.hasPrompt,
    guideOpen,
    openGuide,
    closeGuide,
    isIOS,
    isSafari,
    isInAppBrowser,
    triggerInstall,
  };
}
