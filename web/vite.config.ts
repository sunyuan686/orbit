import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // cloudflared 走 127.0.0.1（IPv4）；默认 localhost 在 macOS 上可能只绑 ::1
    host: "127.0.0.1",
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
