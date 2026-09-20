import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getSpaceTodayKey } from "@orbit/shared";
import { scratchSound } from "../lib/scratchSound";
import { CloseIcon } from "./OrbitIcons";
import { useLayer } from "../hooks/useLayer";


interface ScratchCardProps {
  onScratchComplete?: () => void;
  children: React.ReactNode;
  seed: number | string;
  isAlreadyRevealed?: boolean;
  coverText?: string;
  /** 换卡等外部动作抽到未揭晓的新卡时，自动展开刮卡层。 */
  autoOpenModal?: boolean;
  onModalClose?: () => void;
}

export function ScratchCard({
  onScratchComplete,
  children,
  seed,
  isAlreadyRevealed = false,
  coverText,
  autoOpenModal = false,
  onModalClose,
}: ScratchCardProps) {
  const { isOpen: isScratchOpen, open: openScratch, close: closeScratch } =
    useLayer("scratch");
  const [isRevealed, setIsRevealed] = useState(isAlreadyRevealed);

  // 同步外部揭晓状态与漫游种子
  useEffect(() => {
    setIsRevealed(isAlreadyRevealed);
  }, [isAlreadyRevealed]);

  // 换卡后自动展开。仅在 seed 变化（抽到新卡）时触发，刷新时代入的 layers 会被启动时剥离，
  // 因此瞬时层不会在刷新后自行弹开。
  useEffect(() => {
    if (autoOpenModal && !isAlreadyRevealed) openScratch();
  }, [seed, autoOpenModal, isAlreadyRevealed, openScratch]);

  const handleOpenModal = () => {
    if (!isRevealed) openScratch();
  };

  const handleCloseModal = () => {
    closeScratch();
    scratchSound.stop();
    onModalClose?.();
  };

  const handleScratchSuccess = () => {
    setIsRevealed(true);
    onScratchComplete?.();
  };

  const todayStr = getSpaceTodayKey().replace(/-/g, " · ");


  return (
    <>
      {/* 首页 Feed 静态卡片：已揭晓展示内容，未揭晓展示精美特种纸票券封皮 */}
      {isRevealed ? (
        <div className="orbit-scratch-container orbit-scratch-revealed-view">
          <div className="orbit-scratch-underneath">{children}</div>
        </div>
      ) : (
        <div
          className="orbit-scratch-feed-cover"
          onClick={handleOpenModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpenModal();
            }
          }}
          aria-label="点击拆开今日时光回忆"
        >
          {/* 边角微型档案标识 */}
          <div className="orbit-scratch-cover-header">
            <span className="orbit-scratch-cover-tag">ORBIT ARCHIVE</span>
            <span className="orbit-scratch-cover-date">{todayStr}</span>
          </div>

          {/* 中心徽标与文案 */}
          <div className="orbit-scratch-cover-center">
            <div className="orbit-scratch-cover-astrolabe">
              <svg viewBox="0 0 100 48" className="orbit-scratch-astrolabe-svg" aria-hidden>
                <ellipse cx="50" cy="24" rx="42" ry="18" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="92" cy="24" r="3.2" fill="currentColor" />
                <circle cx="8" cy="24" r="2.4" fill="currentColor" />
              </svg>
              <span className="orbit-scratch-cover-star" aria-hidden>✦</span>
            </div>
            <h3 className="orbit-scratch-cover-title">{coverText || "拂 开 旧 时 光"}</h3>
            <p className="orbit-scratch-cover-hint">✦ 点 击 拆 开 · 偶 遇 旧 时 光 ✦</p>
          </div>
        </div>
      )}

      {/* 沉浸式刮卡弹窗：刮开后保留在弹窗内展示完整回忆，由用户主动阅读 */}
      {isScratchOpen && (
        <ScratchModal
          onClose={handleCloseModal}
          isRevealed={isRevealed}
          onScratchSuccess={handleScratchSuccess}
          coverText={coverText}
        >
          {children}
        </ScratchModal>
      )}
    </>
  );
}

interface ScratchModalProps {
  onClose: () => void;
  isRevealed: boolean;
  onScratchSuccess: () => void;
  coverText?: string;
  children: React.ReactNode;
}

function ScratchModal({
  onClose,
  isRevealed,
  onScratchSuccess,
  coverText,
  children,
}: ScratchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const probeStartRef = useRef<HTMLSpanElement | null>(null);
  const probeMidRef = useRef<HTMLSpanElement | null>(null);
  const probeEndRef = useRef<HTMLSpanElement | null>(null);
  const probeInkRef = useRef<HTMLSpanElement | null>(null);

  const [isCanvasCleared, setIsCanvasCleared] = useState(isRevealed);
  const [showGuide, setShowGuide] = useState(true);
  const isScratchingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const lastCheckTimeRef = useRef(0);

  useEffect(() => {
    if (isRevealed) {
      setIsCanvasCleared(true);
    }
  }, [isRevealed]);

  // 弹窗打开时锁定背景滚动并监听 ESC
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      scratchSound.stop();
    };
  }, [onClose]);

  // 初始化弹窗 Canvas 涂层
  const initCanvas = useCallback(() => {
    if (isRevealed) return;
    const canvas = canvasRef.current;
    const container = cardContainerRef.current;
    if (!canvas || !container) return;

    const width = Math.round(container.clientWidth) || 360;
    const height = Math.round(container.clientHeight) || 220;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const getResolvedColor = (el: HTMLElement | null, fallback: string): string => {
      if (!el) return fallback;
      const val = window.getComputedStyle(el).backgroundColor;
      return val && val !== "rgba(0, 0, 0, 0)" && val !== "transparent" ? val : fallback;
    };

    const colorStart = getResolvedColor(probeStartRef.current, "rgba(226, 232, 240, 0.96)");
    const colorMid = getResolvedColor(probeMidRef.current, "rgba(203, 213, 225, 0.96)");
    const colorEnd = getResolvedColor(probeEndRef.current, "rgba(148, 163, 184, 0.96)");
    const inkColor = getResolvedColor(probeInkRef.current, "rgba(100, 116, 139, 0.5)");

    // 特种纸渐变涂层
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(0.5, colorMid);
    grad.addColorStop(1, colorEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 票券齿孔内边框（与外框 20px 大圆角保持同心平行）
    const inset = 12;
    const borderW = width - inset * 2;
    const borderH = height - inset * 2;

    ctx.save();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.roundRect(inset, inset, borderW, borderH, 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // 档案标识与时间
    ctx.fillStyle = inkColor;
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("ORBIT ARCHIVE", inset + 10, inset + 10);

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const todayStr = getSpaceTodayKey().replace(/-/g, " · ");

    ctx.fillText(todayStr, inset + borderW - 10, inset + borderH - 10);

    // 双星徽标
    const cx = width / 2;
    const cy = height / 2 - 18;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-18 * Math.PI) / 180);

    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 16, 0, 0, Math.PI * 2);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(42, 0, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = inkColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-42, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = inkColor;
    ctx.font = '14px "Source Serif 4", "Songti SC", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦", cx, cy);

    // 主标题
    const labelText = coverText || "拂 开 旧 时 光";
    ctx.fillStyle = inkColor;
    ctx.font = '500 15px "Source Serif 4", "Songti SC", "Noto Serif SC", STSong, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, cx, cy + 38);

    ctx.restore();
  }, [coverText, isRevealed]);

  useEffect(() => {
    if (!isRevealed) {
      const timer = setTimeout(initCanvas, 30);
      return () => clearTimeout(timer);
    }
  }, [initCanvas, isRevealed]);

  const checkProgress = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isCanvasCleared || isRevealed) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    let transparentCount = 0;

    for (let i = 3; i < pixels.length; i += 16) {
      if (pixels[i] === 0) transparentCount++;
    }

    const totalSamples = pixels.length / 16;
    if (transparentCount / totalSamples > 0.28) {
      setIsCanvasCleared(true);
      onScratchSuccess();
    }
  }, [isCanvasCleared, isRevealed, onScratchSuccess]);

  const scratchStroke = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || isCanvasCleared || isRevealed) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvasRectRef.current ?? canvas.getBoundingClientRect();
      const x1 = fromX - rect.left;
      const y1 = fromY - rect.top;
      const x2 = toX - rect.left;
      const y2 = toY - rect.top;

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 48;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      const dist = Math.hypot(toX - fromX, toY - fromY);
      scratchSound.scratch(dist || 16);

      const now = Date.now();
      if (now - lastCheckTimeRef.current > 240) {
        lastCheckTimeRef.current = now;
        checkProgress();
      }
    },
    [isCanvasCleared, isRevealed, checkProgress]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isCanvasCleared || isRevealed) return;
    if (showGuide) setShowGuide(false);
    canvasRectRef.current = e.currentTarget.getBoundingClientRect();
    isScratchingRef.current = true;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    scratchStroke(e.clientX, e.clientY, e.clientX, e.clientY);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isCanvasCleared || isRevealed || !isScratchingRef.current || !lastPointRef.current) return;
    scratchStroke(lastPointRef.current.x, lastPointRef.current.y, e.clientX, e.clientY);
    lastPointRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    scratchSound.stop();
    if (isScratchingRef.current) {
      checkProgress();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
    isScratchingRef.current = false;
    lastPointRef.current = null;
  };

  return createPortal(
    <div
      className="orbit-scratch-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scratch-modal-title"
    >
      <div className="orbit-scratch-modal-dialog">
        {/* 顶部关闭按钮 */}
        <div className="orbit-scratch-modal-header">
          <button
            type="button"
            className="orbit-scratch-modal-close"
            onClick={onClose}
            aria-label="关闭刮卡"
          >
            <CloseIcon size="sm" />
          </button>
        </div>

        {/* 刮卡卡片本体 */}
        <div ref={cardContainerRef} className="orbit-scratch-modal-card">
          <span ref={probeStartRef} className="orbit-scratch-probe-start" aria-hidden />
          <span ref={probeMidRef} className="orbit-scratch-probe-mid" aria-hidden />
          <span ref={probeEndRef} className="orbit-scratch-probe-end" aria-hidden />
          <span ref={probeInkRef} className="orbit-scratch-probe-ink" aria-hidden />

          <div className="orbit-scratch-underneath">{children}</div>

          {!isRevealed && (
            <canvas
              ref={canvasRef}
              className={`orbit-scratch-modal-canvas${isCanvasCleared ? " is-cleared" : ""}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          )}

          {/* 纯动作引导（避开中心图腾，触碰即隐） */}
          {showGuide && !isCanvasCleared && !isRevealed && (
            <div className="orbit-scratch-motion-cue" aria-hidden>
              <div className="orbit-scratch-motion-track" />
              <div className="orbit-scratch-motion-hand">
                <svg
                  viewBox="0 0 24 24"
                  className="orbit-scratch-motion-svg"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5" />
                  <path d="M11 10.5v-2a1.5 1.5 0 0 1 3 0v3.5" />
                  <path d="M14 11v-1a1.5 1.5 0 0 1 3 0v4.5" />
                  <path d="M17 12.5a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-2a6 6 0 0 1-4.24-1.76l-4.24-4.24a1.5 1.5 0 0 1 2.12-2.12L8 16.5" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
