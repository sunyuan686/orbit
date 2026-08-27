import { useCallback, useSyncExternalStore } from "react";

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
  guideModalOpen: boolean;
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
  guideModalOpen: false,
};

const serverState: PwaState = {
  hasPrompt: false,
  isStandalone: false,
  guideModalOpen: false,
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

export function setPwaGuideModalOpen(open: boolean) {
  updateState({ guideModalOpen: open });
}

export function usePwaInstall() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
        updateState({ guideModalOpen: true });
      }
    } else {
      updateState({ guideModalOpen: true });
    }
  }, []);

  const setGuideOpen = useCallback((open: boolean) => {
    updateState({ guideModalOpen: open });
  }, []);

  return {
    isStandalone: store.isStandalone,
    canPrompt: store.hasPrompt,
    guideOpen: store.guideModalOpen,
    isIOS,
    isSafari,
    isInAppBrowser,
    setGuideOpen,
    triggerInstall,
  };
}
