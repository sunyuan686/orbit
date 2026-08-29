import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

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
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "apple-touch-icon-dark.png",
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
      injectManifest: {
        // mermaid 仅 AI 聊天渲染图表时用到，653KB 不进预缓存
        globIgnores: ["**/mermaid-*.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
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
      "/ai-attachments": "http://localhost:3001",
      "/media": "http://localhost:3001",
    },
  },
});
