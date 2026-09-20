# 内容类型收敛与移动架构重构施工计划

> 创建：2026-09-05 · 
> 状态：进行中

## 目标

按照第一性原理与零补丁工程治理规范，完成 Orbit 信息架构（收敛为四大支柱：动态、相册、信箱、我们）、端到端去面包屑化、移动端原生底栏、零门槛即时输入抽屉以及数据模型的标准迁移。

## 步骤

### Stage 1: 数据层与 Schema 收敛（Drizzle Migration）
1. 修改 `src/db/schema.ts`，收敛条目类型为 `moment` 与 `letter`，增加 `is_milestone` 与 `moment_tag`；新增 `album` 与 `album_asset` 表；扩展 `space.rules_content` 与 `user.preferences_profile`；
2. 编写标准 Drizzle Migration SQL（`0023_content_types_refactor.sql`），无损迁移 330 条存量数据；
3. 更新后端 API 与共享层，废除旧 entry 类型判断与胶水逻辑。

### Stage 2: 外壳解耦架构与基础原子组件
1. 编写通用轻量原子组件：`TabBar.tsx`、`FilterPill.tsx`、`BottomSheet.tsx`、`AlbumCard.tsx`；
2. 物理拆分外壳：创建 `DesktopShell.tsx`（纯桌面）与 `MobileShell.tsx`（纯移动底栏），由 `ResponsiveLayout.tsx` 统一分发；
3. 全面移除详情页与编辑页的“面包屑”文字路径，顶栏极简化。

### Stage 3: 四大核心业务页面重塑
1. **✨ 动态 (`MomentList`)**：首卡嵌入相伴天数与刮刮乐，顶部提供全部/足迹/感谢筛选胶囊，贯穿式时间轴切片；
2. **📷 主题相册 (`AlbumsPage` / `AlbumDetail`)**：主题画册封面网格、新建画册、画册照片管理；
3. **💌 信箱 (`LetterList`)**：保持拟物信封火漆印与回信树，移除面包屑；
4. **👤 我们 (`UsPage`)**：星图天幕 + 双人名片 + 恋爱公约 + TA的喜好资料卡 + 系统设置与登出。

### Stage 4: 零门槛即时输入体验 (Zero-Friction Compose)
1. 移动端底栏中心 `[ ➕ ]` 呼出半屏输入抽屉 (BottomSheet)；
2. 100% 复用已有录音引擎（`VoiceInputButton`）与传图组件（`MediaAttachmentsBar`）；
3. 支持一键点亮 `[📌 足迹]` 与 `[💖 感谢]`，打字即发无跳转。

### Stage 5: 回归验证与收尾
1. TypeScript 类型检查与 Vite 生产构建验证；
2. 存量数据无损完整性校验；
3. Web 桌面端与 PWA 移动端全真交互验证。

## 完成标准（可验证）
- [ ] `npm run typecheck` 零错误通过
- [ ] `npm run build` 前后端全量构建通过
- [ ] 移动端底栏 5 项顺畅切换，无汉堡抽屉，无任何面包屑文字
- [ ] 移动端 `[ ➕ ]` 顺畅拉起输入抽屉，语音转写、传图、发布即时插入流
- [ ] 动态流顶部胶囊可一键切片足迹时间轴与感谢卡片
- [ ] 相册支持《吃过的蛋糕》、《美食打卡》等主题分类
- [ ] 我们页面完整承接星图、恋爱公约、喜好卡、系统设置与退出登录
- [ ] 生产环境存量 330 条数据 100% 正常显示归位
