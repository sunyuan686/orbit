import React, { useRef, useEffect, useState, useCallback } from "react";

interface ScratchCardProps {
  onScratchComplete?: () => void;
  children: React.ReactNode;
  seed: number | string;
  isAlreadyRevealed?: boolean;
  coverText?: string;
}

export function ScratchCard({
  onScratchComplete,
  children,
  seed,
  isAlreadyRevealed = false,
  coverText,
}: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const probeStartRef = useRef<HTMLSpanElement | null>(null);
  const probeMidRef = useRef<HTMLSpanElement | null>(null);
  const probeEndRef = useRef<HTMLSpanElement | null>(null);
  const probeInkRef = useRef<HTMLSpanElement | null>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [isCleared, setIsCleared] = useState(isAlreadyRevealed);

  const initCanvas = useCallback(() => {
    if (isAlreadyRevealed) {
      setIsCleared(true);
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = Math.round(container.clientWidth) || 320;
    const height = Math.round(container.clientHeight) || 180;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // 动态提取当前主题（含亮暗模式与强调色）解析后的真实色值
    const getResolvedColor = (el: HTMLElement | null, fallback: string): string => {
      if (!el) return fallback;
      const val = window.getComputedStyle(el).backgroundColor;
      return val && val !== "rgba(0, 0, 0, 0)" && val !== "transparent" ? val : fallback;
    };

    const colorStart = getResolvedColor(probeStartRef.current, "rgba(226, 232, 240, 0.96)");
    const colorMid = getResolvedColor(probeMidRef.current, "rgba(203, 213, 225, 0.96)");
    const colorEnd = getResolvedColor(probeEndRef.current, "rgba(148, 163, 184, 0.96)");
    const inkColor = getResolvedColor(probeInkRef.current, "rgba(100, 116, 139, 0.5)");

    // 1. 绘制带有当前主题微光的金属特种纸底膜
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(0.5, colorMid);
    grad.addColorStop(1, colorEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. 绘制复古藏书票/特种纸票券内边框 (Archival Ticket Inset Border)
    const inset = 10;
    const borderW = width - inset * 2;
    const borderH = height - inset * 2;

    ctx.save();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); // 细虚线邮票齿孔质感
    ctx.strokeRect(inset, inset, borderW, borderH);
    ctx.setLineDash([]); // 恢复实线

    // 四角 L 型校准标线 (Corner Registration Marks)
    const markLen = 8;
    ctx.beginPath();
    // 左上
    ctx.moveTo(inset, inset + markLen);
    ctx.lineTo(inset, inset);
    ctx.lineTo(inset + markLen, inset);
    // 右上
    ctx.moveTo(inset + borderW - markLen, inset);
    ctx.lineTo(inset + borderW, inset);
    ctx.lineTo(inset + borderW, inset + markLen);
    // 左下
    ctx.moveTo(inset, inset + borderH - markLen);
    ctx.lineTo(inset, inset + borderH);
    ctx.lineTo(inset + markLen, inset + borderH);
    // 右下
    ctx.moveTo(inset + borderW - markLen, inset + borderH);
    ctx.lineTo(inset + borderW, inset + borderH);
    ctx.lineTo(inset + borderW, inset + borderH - markLen);
    ctx.stroke();

    // 3. 边角微型档案标识与时间戳 (JetBrains Mono 秩序感)
    ctx.fillStyle = inkColor;
    ctx.font = '500 9px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("ORBIT ARCHIVE", inset + 8, inset + 8);

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, " · ");
    ctx.fillText(todayStr, inset + borderW - 8, inset + borderH - 8);

    // 4. 中心徽标：双星公转轨道与微星 (Orbit Astrolabe Motif)
    const cx = width / 2;
    const cy = height / 2 - 12;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-18 * Math.PI) / 180);

    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 14, 0, 0, Math.PI * 2);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 双星节点 (Two Orbiting Planets)
    ctx.beginPath();
    ctx.arc(36, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = inkColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-36, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 中心微星 (Center Star)
    ctx.fillStyle = inkColor;
    ctx.font = '12px "Source Serif 4", "Songti SC", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦", cx, cy);

    // 5. 诗意主标题与提示 (Editorial Typography)
    const labelText = coverText || "拂 开 旧 时 光";
    ctx.fillStyle = inkColor;
    ctx.font = '500 13px "Source Serif 4", "Songti SC", "Noto Serif SC", STSong, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, cx, cy + 28);

    ctx.font = '500 9px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText("· 划 开 揭 晓 ·", cx, cy + 44);

    ctx.restore();
  }, [isAlreadyRevealed, coverText]);

  // 监听根节点主题或深浅色切换，实时动态重绘涂层
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (!isAlreadyRevealed && !isCleared) {
        initCanvas();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-accent", "data-theme"],
    });
    return () => observer.disconnect();
  }, [isAlreadyRevealed, isCleared, initCanvas]);

  // 监听移动端屏幕旋转或容器宽度变化，精准更新画布尺寸
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      if (!isAlreadyRevealed && !isCleared) {
        initCanvas();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [isAlreadyRevealed, isCleared, initCanvas]);

  useEffect(() => {
    if (isAlreadyRevealed) {
      setIsCleared(true);
    } else {
      setIsCleared(false);
      initCanvas();
    }
  }, [seed, isAlreadyRevealed, initCanvas]);

  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || isCleared) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = x - rect.left;
    const clientY = y - rect.top;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(clientX, clientY, 22, 0, Math.PI * 2);
    ctx.fill();

    checkProgress();
  };

  const checkProgress = () => {
    const canvas = canvasRef.current;
    if (!canvas || isCleared) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    let transparentCount = 0;

    for (let i = 3; i < pixels.length; i += 16) {
      if (pixels[i] === 0) transparentCount++;
    }

    const totalSamples = pixels.length / 16;
    if (transparentCount / totalSamples > 0.3) {
      setIsCleared(true);
      onScratchComplete?.();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsScratching(true);
    scratch(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isScratching) return;
    scratch(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    setIsScratching(false);
  };

  return (
    <div ref={containerRef} className="orbit-scratch-container">
      <span ref={probeStartRef} className="orbit-scratch-probe-start" aria-hidden />
      <span ref={probeMidRef} className="orbit-scratch-probe-mid" aria-hidden />
      <span ref={probeEndRef} className="orbit-scratch-probe-end" aria-hidden />
      <span ref={probeInkRef} className="orbit-scratch-probe-ink" aria-hidden />
      <div className="orbit-scratch-underneath">{children}</div>
      <canvas
        ref={canvasRef}
        className={`orbit-scratch-canvas${isCleared ? " is-cleared" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
