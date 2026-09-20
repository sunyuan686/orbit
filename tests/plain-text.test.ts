import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toPlainText } from "../src/lib/plain-text.js";

describe("Plain Text Extraction (第一性原理纯文本提取回归测试)", () => {
  it("extracts plain text from standard HTML and markdown without mutation", () => {
    const input = "<h1>标题</h1><p>这是一段<strong>加粗</strong>文字与普通段落。</p>";
    assert.equal(toPlainText(input), "标题 这是一段加粗文字与普通段落。");
  });

  it("cleans audio player widget completely and preserves only spoken transcript", () => {
    const htmlWithAudio = `<p>你洗漱了吗</p><div data-orbit-audio="true" data-src="/assets/2e556fee.webm" data-transcript="你写作业了吗？你写作业了没？你。写啦？好。" class="orbit-prose-audio-block orbit-voice-card"><div class="orbit-voice-card-main"><button type="button" class="orbit-voice-play-btn" title="播放/暂停"><svg class="w-3.5 h-3.5 fill-current ml-0.5 orbit-voice-play-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg><svg class="w-3.5 h-3.5 fill-current hidden orbit-voice-pause-icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg></button><div class="orbit-voice-waveform"><span class="orbit-voice-bar" style="height:35%"></span><span class="orbit-voice-bar" style="height:50%"></span><span class="orbit-voice-bar" style="height:80%"></span><span class="orbit-voice-bar" style="height:60%"></span></div><span class="orbit-voice-time">0:00</span><button type="button" class="orbit-voice-transcript-toggle" title="展开/折叠转写文稿"><span class="select-none">💬</span><span>文稿</span></button></div><div class="orbit-voice-transcript-block hidden"><p class="orbit-voice-transcript m-0 font-sans">你写作业了吗？你写作业了没？你。写啦？好。</p></div><audio src="/assets/2e556fee.webm" controls class="orbit-prose-audio hidden"></audio></div>`;

    const extracted = toPlainText(htmlWithAudio);

    // 1. 绝不泄漏播放器内部 UI 字符
    assert.equal(extracted.includes("0:00"), false, "播放器时长 0:00 不得泄漏至正文");
    assert.equal(extracted.includes("文稿"), false, "播放器按钮文字 文稿 不得泄漏至正文");
    assert.equal(extracted.includes("🎙️"), false, "不得人工注入 🎙️ 伪标记");
    assert.equal(extracted.includes("[语音]"), false, "不得人工注入 [语音] 伪标记");

    // 2. 人类自然语言文稿完整且仅出现一次
    assert.equal(
      extracted,
      "你洗漱了吗 你写作业了吗？你写作业了没？你。写啦？好。"
    );
  });

  it("handles audio card with transcript only in inner paragraph", () => {
    const html = `<div class="orbit-prose-audio-block"><div class="orbit-voice-row"><span>0:00</span><button>文稿</button></div><div class="orbit-voice-transcript-block"><p class="orbit-voice-transcript">今天晚上吃饺子</p></div></div>`;
    const extracted = toPlainText(html);
    assert.equal(extracted, "今天晚上吃饺子");
  });

  it("handles audio card with empty transcript cleanly", () => {
    const html = `<p>前文</p><div data-orbit-audio="true" data-transcript="" class="orbit-prose-audio-block"><div class="orbit-voice-row"><span>0:00</span></div></div><p>后文</p>`;
    const extracted = toPlainText(html);
    assert.equal(extracted, "前文 后文");
  });
});
