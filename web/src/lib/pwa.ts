import { registerSW } from "virtual:pwa-register";

let updateSW: (() => Promise<void>) | undefined;

export function registerPwaServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      console.info("[pwa] App shell cached for offline use");
    },
    onNeedRefresh() {
      console.info("[pwa] New version available");
      void updateSW?.();
    },
    onRegisterError(error) {
      console.error("[pwa] Service worker registration failed", error);
    },
  });
}
