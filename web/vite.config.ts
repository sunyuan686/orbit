import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/** R2 / 本地媒体：8 位十六进制 hash + 图片扩展名，与 Vite 打包产物区分 */
const USER_MEDIA_ASSET = /^\/assets\/[a-f0-9]{8}\.(?:jpe?g|png|gif|webp)$/i;

export default defineConfig({
  envDir: "../",
  resolve: {
    alias: {
      "@orbit/shared": path.resolve(__dirname, "../src/shared"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "pwa-192.png",
        "pwa-512.png",
        "pwa-maskable-512.png",
      ],
      manifest: {
        id: "/",
        name: "Orbit",
        short_name: "Orbit",
        description: "两个人的时间轨道",
        lang: "zh-CN",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#1c1917",
        background_color: "#fafaf9",
        categories: ["lifestyle", "productivity"],
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, USER_MEDIA_ASSET],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
        // mermaid 仅 AI 聊天渲染图表时用到，653KB 不进预缓存
        globIgnores: ["**/mermaid-*.js"],
        runtimeCaching: [
          {
            urlPattern: USER_MEDIA_ASSET,
            handler: "NetworkOnly",
            options: {
              fetchOptions: {
                credentials: "include",
              },
            },
          },
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    // 监听所有网络接口（0.0.0.0），支持 localhost 与局域网 IP（如 192.168.1.65）访问
    host: "0.0.0.0",
    port: 5173,
    // Cloudflare quick tunnel 的 Host 不是 localhost，需放行
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": "http://localhost:3001",
      "/assets": "http://localhost:3001",
      "/media": "http://localhost:3001",
    },
  },
});
