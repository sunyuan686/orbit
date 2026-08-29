import { registerSW } from "virtual:pwa-register";

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let registrationRef: ServiceWorkerRegistration | undefined;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 分钟节流阈值

function checkForUpdates() {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL_MS) {
    return;
  }
  lastCheckTime = now;
  if (registrationRef) {
    registrationRef.update().catch((err) => {
      console.warn("[pwa] Failed to check for SW update", err);
    });
  }
}

export function registerPwaServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swScriptUrl, registration) {
      registrationRef = registration;
      lastCheckTime = Date.now();

      // App 从后台切回前台或聚焦时，节流检查是否有新版本
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          checkForUpdates();
        }
      });
      window.addEventListener("focus", checkForUpdates);
    },
    onOfflineReady() {
      console.info("[pwa] App shell cached for offline use");
    },
    onNeedRefresh() {
      console.info("[pwa] New version available, updating SW");
      void updateSW?.(true);
    },
    onRegisterError(error) {
      console.error("[pwa] Service worker registration failed", error);
    },
  });
}
