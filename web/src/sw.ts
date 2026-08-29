// @ts-nocheck
/**
 * Orbit Service Worker（injectManifest 模式）
 * vite-plugin-pwa 在构建时将 self.__WB_MANIFEST 替换为 precache 清单
 */
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkOnly, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// 新 SW 安装后立即激活并接管当前页面
self.skipWaiting();
clientsClaim();

// 监听客户端的 SKIP_WAITING 显式更新消息
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// App Shell 预缓存（构建时由 vite-plugin-pwa 注入清单）
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── 用户媒体资产正则（与 vite.config.ts 同步）─────────────────────────────────
const USER_MEDIA_ASSET = /\/assets\/[a-f0-9]{8}\.(?:jpe?g|png|gif|webp)$/i;

// SPA 导航回退（API 与媒体资产不走 index.html）
registerRoute(
  new NavigationRoute(new NetworkOnly(), {
    denylist: [/^\/api\//, USER_MEDIA_ASSET],
  })
);

// API NetworkOnly
registerRoute(/^\/api\//, new NetworkOnly());

// 用户媒体 NetworkOnly（需携带 cookie 鉴权）
registerRoute(
  USER_MEDIA_ASSET,
  new NetworkOnly({ fetchOptions: { credentials: "include" } })
);

// Google Fonts CSS（CacheFirst，1 年）
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-stylesheets",
    plugins: [
      new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Google Fonts 字体文件（CacheFirst，1 年，允许 opaque response）
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// ─── Web Push ──────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  // 服务端发送空 push 作为信号，SW 拉取最新通知展示
  const showNotification = fetch("/api/notifications?limit=1", {
    credentials: "include",
  })
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then((items: Array<{ title: string; body: string; link: string }>) => {
      const item = items[0];
      if (!item) return;
      return self.registration.showNotification(item.title, {
        body: item.body,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        data: { link: item.link },
        tag: "orbit-notification",
        renotify: true,
      });
    })
    .catch(() =>
      self.registration.showNotification("Orbit", {
        body: "你有新消息",
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        tag: "orbit-notification",
      })
    );

  event.waitUntil(showNotification);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data as { link?: string } | undefined)?.link ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 若 App 已打开，聚焦并导航
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus().then(() =>
              (client as WindowClient).navigate(link)
            );
          }
        }
        return self.clients.openWindow(link);
      })
  );
});
