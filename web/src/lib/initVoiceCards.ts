/**
 * 语音随想卡片（Orbit Voice Card）的播放控制与波形进度联动引擎
 * 基于第一性原理 DOM 事件委托，兼容 TipTap 编辑器、文章详情页与卡片列表
 */

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function setupVoiceCardEvents() {
  if (typeof window === "undefined") return;

  // 避免重复挂载全局点击代理
  if ((window as any).__orbit_voice_events_setup) return;
  (window as any).__orbit_voice_events_setup = true;

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // 1. 点击播放/暂停按钮
    const playBtn = target.closest(".orbit-voice-play-btn") as HTMLButtonElement | null;
    if (playBtn) {
      const card = playBtn.closest(".orbit-voice-card");
      if (!card) return;
      const audio = card.querySelector("audio") as HTMLAudioElement | null;
      if (!audio) return;

      // 如果有其他语音正在播放，先暂停其他语音
      document.querySelectorAll(".orbit-voice-card audio").forEach((el) => {
        const otherAudio = el as HTMLAudioElement;
        if (otherAudio !== audio && !otherAudio.paused) {
          otherAudio.pause();
        }
      });

      if (audio.paused) {
        audio.play().catch((err) => console.error("Audio play failed:", err));
      } else {
        audio.pause();
      }
      return;
    }

    // 2. 点击音波条 Seek 寻找播放进度
    const waveform = target.closest(".orbit-voice-waveform") as HTMLElement | null;
    if (waveform) {
      const card = waveform.closest(".orbit-voice-card");
      if (!card) return;
      const audio = card.querySelector("audio") as HTMLAudioElement | null;
      if (!audio || !audio.duration) return;

      const rect = waveform.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      audio.currentTime = ratio * audio.duration;
      if (audio.paused) {
        audio.play().catch(() => {});
      }
      return;
    }

    // 3. 点击展开/折叠转写文稿按钮
    const transcriptToggleBtn = target.closest(".orbit-voice-transcript-toggle") as HTMLButtonElement | null;
    if (transcriptToggleBtn) {
      const card = transcriptToggleBtn.closest(".orbit-voice-card");
      if (!card) return;
      const transcriptBlock = card.querySelector(".orbit-voice-transcript-block");
      if (transcriptBlock) {
        const isHidden = transcriptBlock.classList.contains("hidden");
        if (isHidden) {
          transcriptBlock.classList.remove("hidden");
          transcriptToggleBtn.classList.add("bg-amber-500/20", "text-amber-600", "dark:text-amber-400");
        } else {
          transcriptBlock.classList.add("hidden");
          transcriptToggleBtn.classList.remove("bg-amber-500/20", "text-amber-600", "dark:text-amber-400");
        }
      }
      return;
    }
  });

  // 音频事件：监听全局 audio 的 timeupdate, play, pause, ended 事件更新 UI 状态
  const updateCardUI = (audio: HTMLAudioElement) => {
    const card = audio.closest(".orbit-voice-card");
    if (!card) return;

    const playIcon = card.querySelector(".orbit-voice-play-icon");
    const pauseIcon = card.querySelector(".orbit-voice-pause-icon");
    const timeEl = card.querySelector(".orbit-voice-time");
    const bars = card.querySelectorAll(".orbit-voice-bar");

    const isPlaying = !audio.paused;
    const current = audio.currentTime || 0;
    const total = audio.duration || 0;

    // 更新播放/暂停图标
    if (playIcon && pauseIcon) {
      if (isPlaying) {
        playIcon.classList.add("hidden");
        pauseIcon.classList.remove("hidden");
      } else {
        playIcon.classList.remove("hidden");
        pauseIcon.classList.add("hidden");
      }
    }

    // 更新时间显示
    if (timeEl) {
      timeEl.textContent = total > 0 ? `${formatTime(current)} / ${formatTime(total)}` : formatTime(current);
    }

    // 更新波形高亮进度
    if (bars.length > 0 && total > 0) {
      const progressRatio = current / total;
      const activeCount = Math.round(progressRatio * bars.length);
      bars.forEach((bar, idx) => {
        if (idx < activeCount) {
          bar.classList.add("bg-amber-500");
          bar.classList.remove("bg-stone-300", "dark:bg-stone-700");
        } else {
          bar.classList.remove("bg-amber-500");
          bar.classList.add("bg-stone-300", "dark:bg-stone-700");
        }
      });
    }
  };

  document.addEventListener(
    "timeupdate",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "AUDIO") {
        updateCardUI(target as HTMLAudioElement);
      }
    },
    true
  );

  document.addEventListener(
    "play",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "AUDIO") {
        updateCardUI(target as HTMLAudioElement);
      }
    },
    true
  );

  document.addEventListener(
    "pause",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "AUDIO") {
        updateCardUI(target as HTMLAudioElement);
      }
    },
    true
  );

  document.addEventListener(
    "ended",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "AUDIO") {
        const audio = target as HTMLAudioElement;
        audio.currentTime = 0;
        updateCardUI(audio);
      }
    },
    true
  );
}

// 首次执行
setupVoiceCardEvents();
