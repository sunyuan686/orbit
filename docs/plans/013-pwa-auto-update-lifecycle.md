# 013 - PWA 自动更新生命周期标准实现

**状态**：已完成 (Completed)  
**目标**：遵循 W3C 与 Workbox 官方最佳实践，补齐 `injectManifest` 模式下遗漏的 `self.skipWaiting()` 与 `clientsClaim()`，解决代码更新后 PWA 读取旧缓存问题。

---

## 背景与问题
1. `vite.config.ts` 声明了 `registerType: "autoUpdate"`，但使用了 `injectManifest` 自定义 `sw.ts`。
2. `web/src/sw.ts` 缺少 `self.skipWaiting()` 和 `clientsClaim()`，新版本下载后一直处于 `waiting` 状态，旧 SW 持续拦截缓存。
3. `pwa.ts` 缺少后台唤醒时的 `registration.update()` 自检。

---

## 改造范围
1. **`web/src/sw.ts`**：
   - 引入 `workbox-core` 的 `clientsClaim`；
   - 声明 `self.skipWaiting()` 与 `clientsClaim()`；
   - 监听标准 `message` 消息事件响应 `SKIP_WAITING`。
2. **`web/src/lib/pwa.ts`**：
   - 在 `onRegisteredSW` 中保存 `registration` 引用；
   - 监听 `visibilitychange`（切回前台）与 `focus` 事件，按 15 分钟节流阈值调用 `registration.update()` 执行更新自检。

---

## 验证结果
- `npm run build` 0 错误构建成功。
- 打包生成的 `dist/sw.js` 包含完整的生命周期接管逻辑。
