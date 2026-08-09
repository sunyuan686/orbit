import React, { useRef, useEffect, useState, useCallback } from "react";

interface ScratchCardProps {
  onScratchComplete?: () => void;
  children: React.ReactNode;
  seed: number;
}

export function ScratchCard({ onScratchComplete, children, seed }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [isCleared, setIsCleared] = useState(false);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width || 320;
    const height = rect.height || 180;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // 绘制温柔香槟银金属刮刮彩膜
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#e2e8f0");
    grad.addColorStop(0.5, "#cbd5e1");
    grad.addColorStop(1, "#94a3b8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 涂层上的柔光提示文字
    ctx.fillStyle = "#475569";
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✨ 涂层刮刮乐 · 划开揭晓记忆 ✨", width / 2, height / 2);
  }, []);

  useEffect(() => {
    setIsCleared(false);
    initCanvas();
  }, [seed, initCanvas]);

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
