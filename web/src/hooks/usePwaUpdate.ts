import { useCallback, useEffect, useSyncExternalStore } from "react";

export interface PwaUpdateState {
  /** 是否检测到新 Service Worker 并在 waiting 状态，等待用户确认激活 */
  needRefresh: boolean;
  /** 是否离线可用 */
  offlineReady: boolean;
  /** 是否正在主动检查更新中 */
  checking: boolean;
  /** 是否正在应用更新刷新页面中 */
  refreshing: boolean;
  /** 上次检查更新的时间戳 */
  lastCheckTime: number | null;
  /** 浮动提示横幅是否被用户手动收起 */
  dismissed: boolean;
  /** Service Worker Registration 引用 */
  registration: ServiceWorkerRegistration | null;
}

let isInitialized = false;
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 分钟节流阈值

let state: PwaUpdateState = {
  needRefresh: false,
  offlineReady: false,
  checking: false,
  refreshing: false,
  lastCheckTime: null,
  dismissed: false,
  registration: null,
};

const serverState: PwaUpdateState = {
  needRefresh: false,
  offlineReady: false,
  checking: false,
  refreshing: false,
  lastCheckTime: null,
  dismissed: false,
  registration: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function updateState(partial: Partial<PwaUpdateState>) {
  state = { ...state, ...partial };
  emitChange();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => serverState;

/**
 * 节流的后台更新检查（用于窗口聚焦 / 切回前台）
 */
function checkBackgroundUpdates(registration: ServiceWorkerRegistration) {
  const now = Date.now();
  if (state.lastCheckTime && now - state.lastCheckTime < CHECK_INTERVAL_MS) return;
  updateState({ lastCheckTime: now });
  registration.update().catch((err) => {
    console.warn("[pwa] Failed to check for SW background update", err);
  });
}

/**
 * 初始化全局 Service Worker 监听
 *
 * 基于浏览器原生 Service Worker API，真理源唯一、无中间层黑盒
 */
function initPwaUpdate() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      updateState({ registration, lastCheckTime: Date.now() });

      // 若已有 waiting worker 说明新版本已下载就绪
      if (registration.waiting && navigator.serviceWorker.controller) {
        updateState({ needRefresh: true, dismissed: false });
      }

      // 监听新版本的发现与安装阶段
      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // 已受控页面发现新 SW 安装完成，等待激活
              updateState({ needRefresh: true, dismissed: false });
            } else {
              // 首访受控前 App shell 缓存就绪
              updateState({ offlineReady: true });
              console.info("[pwa] App shell cached for offline use");
            }
          }
        });
      });

      // App 从后台切回前台或聚焦时，节流检查是否有新版本
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          checkBackgroundUpdates(registration);
        }
      });
      window.addEventListener("focus", () => checkBackgroundUpdates(registration));
    })
    .catch((error) => {
      console.error("[pwa] Service worker registration failed", error);
    });
}

/**
 * 主动检查最新代码 / Service Worker 更新
 */
export async function checkForPwaUpdate(): Promise<{ hasUpdate: boolean }> {
  if (typeof window === "undefined") return { hasUpdate: false };

  updateState({ checking: true });

  try {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
      // 开发模式或不支持 SW 环境，模拟 500ms 检查延迟
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateState({ checking: false, lastCheckTime: Date.now() });
      return { hasUpdate: false };
    }

    let reg = state.registration;
    if (!reg) {
      reg = (await navigator.serviceWorker.getRegistration()) ?? null;
      if (reg) updateState({ registration: reg });
    }

    if (!reg) {
      updateState({ checking: false, lastCheckTime: Date.now() });
      return { hasUpdate: false };
    }

    // 主动调用 registration.update() 拉取服务端 sw.js
    await reg.update();
    const now = Date.now();

    // 检查是否有 waiting 中的新 worker
    if (reg.waiting) {
      updateState({ needRefresh: true, dismissed: false, checking: false, lastCheckTime: now });
      return { hasUpdate: true };
    }

    // 如果有正在安装中的 worker，等待其安装就绪
    if (reg.installing) {
      const installing = reg.installing;
      const result = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10000);
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            clearTimeout(timeout);
            resolve(true);
          } else if (installing.state === "redundant") {
            clearTimeout(timeout);
            resolve(false);
          }
        });
      });

      if (result) {
        updateState({ needRefresh: true, dismissed: false, checking: false, lastCheckTime: now });
        return { hasUpdate: true };
      }
    }

    // 如果本次检查未发现新版本，但之前已经置位 needRefresh，保留状态
    updateState({ checking: false, lastCheckTime: now });
    return { hasUpdate: state.needRefresh };
  } catch (err) {
    console.warn("[pwa] Active update check failed", err);
    updateState({ checking: false, lastCheckTime: Date.now() });
    return { hasUpdate: state.needRefresh };
  }
}

/**
 * 激活已就绪的新版本并立即刷新页面
 *
 * 第一性原理设计：
 * 1. 仅在用户明确点击更新的当前标签页执行重载，不干扰其他标签页未保存草稿；
 * 2. 向 waiting worker 发送 SKIP_WAITING 消息；
 * 3. 监听当前标签页单次 controllerchange 事件：新 SW 激活接管后立即 window.location.reload()；
 * 4. 设置 1000ms 定时器兜底：若 controllerchange 未能按预期触发或无 waiting worker，超时直接重载。
 */
export async function applyPwaUpdate(): Promise<void> {
  if (typeof window === "undefined" || state.refreshing) return;
  updateState({ refreshing: true });

  let hasReloaded = false;
  const doReload = () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  };

  // 1 秒强制超时保底，防止由于任何事件异常导致用户卡在界面无反应
  const fallbackTimer = setTimeout(doReload, 1000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(fallbackTimer);
        doReload();
      },
      { once: true }
    );
  }

  let reg = state.registration;
  if (!reg && "serviceWorker" in navigator) {
    try {
      reg = (await navigator.serviceWorker.getRegistration()) ?? null;
      if (reg) updateState({ registration: reg });
    } catch {
      // ignore
    }
  }

  if (reg?.waiting) {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
  } else {
    // 若当前已无 waiting worker（可能已激活接管或异常状态），直接刷新
    clearTimeout(fallbackTimer);
    doReload();
  }
}

/**
 * 强制清除本地缓存并重新拉取最新代码
 *
 * 适用于：
 * 1. PWA Standalone 模式下代码有更新但未能自动刷新；
 * 2. CacheStorage 存在陈旧资源或异常时的逃生舱。
 */
export async function forceClearCacheAndReload(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    // 1. 清除所有 CacheStorage 缓存
    if ("caches" in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }

    // 2. 注销所有已注册的 Service Worker
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch (err) {
    console.warn("[pwa] Failed to clear caches before reload", err);
  }

  // 3. 携带时间戳参数强制重新加载，确保穿透浏览器缓存
  const url = new URL(window.location.href);
  url.searchParams.set("_pwa_refresh", Date.now().toString());
  window.location.replace(url.toString());
}

/**
 * 设置更新浮动横幅的展开/收起状态
 */
export function setPwaUpdateDismissed(dismissed: boolean) {
  updateState({ dismissed });
}

export function usePwaUpdate() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    initPwaUpdate();
  }, []);

  const checkForUpdate = useCallback(() => {
    return checkForPwaUpdate();
  }, []);

  const applyUpdate = useCallback(() => {
    return applyPwaUpdate();
  }, []);

  const forceRefresh = useCallback(() => {
    return forceClearCacheAndReload();
  }, []);

  const setDismissed = useCallback((dismissed: boolean) => {
    setPwaUpdateDismissed(dismissed);
  }, []);

  return {
    needRefresh: store.needRefresh,
    offlineReady: store.offlineReady,
    checking: store.checking,
    refreshing: store.refreshing,
    lastCheckTime: store.lastCheckTime,
    dismissed: store.dismissed,
    checkForUpdate,
    applyUpdate,
    forceRefresh,
    setDismissed,
  };
}
