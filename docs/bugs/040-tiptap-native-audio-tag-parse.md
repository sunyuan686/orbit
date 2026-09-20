# Tiptap 富文本解析遗漏原生 audio 标签导致音频隐形

> 创建：2026-09-10 · 
> 状态：已解决

## 现象

动态卡片打上了「语音」徽章（后端根据 `body LIKE '%<audio%'` 判定为有音频），但进入动态详情页后完全看不到音频播放器控件，视觉上呈现为纯文本动态，出现“有标无物”的幽灵状态。

## 期望行为

富文本编辑器在消费正文 HTML 时，应遵循数据保真原则，不仅能识别专属卡片 `div[data-orbit-audio]`，也能识别原生 `<audio>` 标签并将其正确还原为波形音频卡片，杜绝数据在解析端静默丢失。

## 根因与修复

- **根本原因**：
  1. `web/src/extensions/OrbitAudio.ts` 的 `parseHTML` 仅配置了 `div[data-orbit-audio]`，未配置原生 `audio` 标签的解析规则。Tiptap 在加载包含 `<audio controls src="...">` 的内容时，因标签未在扩展中注册而将其从 DOM 树中剔除。
  2. `web/src/components/VoiceNoteRecordButton.tsx` 缺乏录音物理时长门槛，误触点击（<1.5秒环境杂音）即触发后台上传，且在异步上传与转写未就绪期间界面无反馈，导致用户无感知随表单提交误录音频。
- **修复方案**：
  1. 在 `OrbitAudio.ts` 中补充 `audio` 标签解析器（通过 `el.closest("div[data-orbit-audio]")` 排除已在卡片内的嵌套节点），并将提取到的 `src` 映射到音频节点。
  2. 在 `VoiceNoteRecordButton.tsx` 中增加最低录制有效时长门槛（< 1.5 秒直接就地抛弃，不发起网络请求），并提供 `onUploadStateChange` 状态回调，与发动态表单的禁用态协同，彻底杜绝未就绪时静默提交。
  3. 清洗历史误录脏数据（`ent_bflpbngm4c`），恢复为纯净正文，消除虚假语音徽章。

## 回归验证

- [x] 富文本编辑器能正确解析孤立的 `<audio src="..."></audio>`
- [x] 原有 `div[data-orbit-audio]` 卡片解析不受影响，不会重复创建节点
- [x] 录音误触短录音（<1.5秒）就地释放并提示，不再产生垃圾请求
- [x] 录音上传转写期间表单提交按钮正确保持 disabled 锁定
- [x] 历史动态已清理，`hasAudio` 恢复为 0，语音徽章消除
- [x] 前端测试与构建零错误通过 (`tsc -b && vite build` 零错误，41项单测全过)
