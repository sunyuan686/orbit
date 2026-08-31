/**
 * 真实刮刮乐金属特种纸涂层物理摩擦音效合成器 (Web Audio API)
 *
 * 通过白噪声 + 带通滤波 (Bandpass Filter) 实时物理建模
 * 随手指划动速度动态调制音量、频率与细微触觉反馈
 */

class ScratchSoundSynthesizer {
  private ctx: AudioContext | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHapticTime = 0;

  private init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();

      // 创建 2 秒的高品质白噪循环 Buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuffer;
      this.noiseSource.loop = true;

      // 带通滤波器：模拟金属涂层与特种纸脱落的 1800Hz - 3200Hz 细密颗粒感
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = "bandpass";
      this.filterNode.frequency.value = 2200;
      this.filterNode.Q.value = 1.5;

      // 增益控制（音量包络）
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0;

      // 节点连接：Noise -> Bandpass Filter -> Gain -> Destination
      this.noiseSource.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.noiseSource.start(0);
    } catch {
      // ignore
    }
  }

  /**
   * 触发刮擦摩擦音效
   * @param distance 单次移动像素距离（0 ~ 50）
   */
  public scratch(distance = 10) {
    try {
      this.init();
      if (!this.ctx || !this.gainNode || !this.filterNode) return;

      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;
      if (this.stopTimer) {
        clearTimeout(this.stopTimer);
        this.stopTimer = null;
      }

      // 速度归一化 (0.2 ~ 1.2)
      const normalizedSpeed = Math.min(Math.max(distance / 20, 0.2), 1.2);

      // 动态滤波中心频率：速度快时更清脆（2200Hz ~ 3200Hz），慢时更沉稳（1800Hz）
      const targetFreq = 1800 + normalizedSpeed * 1200;
      this.filterNode.frequency.cancelScheduledValues(now);
      this.filterNode.frequency.setValueAtTime(targetFreq, now);

      // 动态音量（克制温和，峰值不超过 0.09）
      const targetGain = Math.min(0.03 + normalizedSpeed * 0.05, 0.09);
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.015);

      // 60ms 内若无后续刮动，平滑淡出静音
      this.stopTimer = setTimeout(() => {
        this.stop();
      }, 60);

      // 触觉反馈（在支持的移动设备上每 80ms 触发一次极轻微的微震颤）
      const currentTime = Date.now();
      if (currentTime - this.lastHapticTime > 80 && typeof navigator !== "undefined" && navigator.vibrate) {
        this.lastHapticTime = currentTime;
        try {
          navigator.vibrate(6);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * 平滑淡出静音
   */
  public stop() {
    if (!this.ctx || !this.gainNode) return;
    try {
      const now = this.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + 0.04);
    } catch {
      // ignore
    }
  }

  /**
   * 释放音频资源
   */
  public destroy() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {
        // ignore error on stop/disconnect
      }
      this.noiseSource = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // ignore error on close
      }
      this.ctx = null;
    }
  }
}

export const scratchSound = new ScratchSoundSynthesizer();
