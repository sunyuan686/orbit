---
version: 1.0
name: Orbit
description: A warm, restrained editorial memory platform for two people. 60-30-10 color balance, classic trio typography, and unified design tokens.

colors:
  primary: oklch(0.18 0.01 250)
  bg: oklch(0.985 0.002 250)
  surface: oklch(1 0 0)
  surface-raised: oklch(0.965 0.002 250)
  border: oklch(0.90 0.003 250)
  border-light: oklch(0.935 0.002 250)
  text-primary: oklch(0.18 0.01 250)
  text-secondary: oklch(0.44 0.01 250)
  text-muted: oklch(0.66 0.008 250)
  accent: oklch(0.48 0.095 150)
  accent-hover: oklch(0.40 0.100 150)
  danger: oklch(0.55 0.18 27)

colors-dark:
  primary: oklch(0.95 0.005 250)
  bg: oklch(0.15 0.008 250)
  surface: oklch(0.18 0.01 250)
  surface-raised: oklch(0.22 0.012 250)
  border: oklch(0.28 0.012 250)
  border-light: oklch(0.24 0.01 250)
  text-primary: oklch(0.95 0.005 250)
  text-secondary: oklch(0.72 0.012 250)
  text-muted: oklch(0.55 0.01 250)
  accent: oklch(0.78 0.11 150)
  accent-hover: oklch(0.86 0.10 150)
  danger: oklch(0.65 0.16 27)

typography:
  display:
    fontFamily: '"Source Serif 4", "Songti SC", "Noto Serif SC", STSong, Georgia, serif'
    fontSize: 1.5rem
    lineHeight: 1.32
    letterSpacing: 0.015em
    fontWeight: 500
  title:
    fontFamily: '{typography.display.fontFamily}'
    fontSize: 1.125rem
    lineHeight: 1.45
    letterSpacing: 0.01em
    fontWeight: 500
  subtitle:
    fontFamily: '{typography.display.fontFamily}'
    fontSize: 1rem
    lineHeight: 1.5
    letterSpacing: 0.01em
    fontWeight: 500
  body:
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'
    fontSize: 0.9375rem
    lineHeight: 1.72
    letterSpacing: 0.01em
    fontWeight: 400
  secondary:
    fontFamily: '{typography.body.fontFamily}'
    fontSize: 0.8125rem
    lineHeight: 1.55
    letterSpacing: 0.01em
    fontWeight: 400
  xs:
    fontFamily: '{typography.body.fontFamily}'
    fontSize: 0.75rem
    lineHeight: 1.5
    letterSpacing: 0.01em
    fontWeight: 400
  mono:
    fontFamily: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace'
    fontSize: 0.75rem
    lineHeight: 1.35
    letterSpacing: 0.04em
    fontWeight: 500

spacing:
  xs: 6px
  sm: 10px
  md: 16px
  lg: 24px
  xl: 32px
  section: 48px

rounded:
  sm: 6px
  md: 10px
  lg: 14px
  full: 9999px
---

# Orbit Design System

## 1. 60-30-10 黄金色彩法则
- **60% 画布底色 (Canvas & Negative Space)**：月石清白 (`--bg`) 叠加 5% 纸质微颗粒，纯白卡片容器 (`--surface`)，提供安宁通透的阅读底色。
- **30% 墨水排版骨架 (Ink & Framework)**：标题与正文 (`--text-primary`, `--text-secondary`)、中性 1px 微弱分割线 (`--border`)、单色线性几何图标。
- **10% 焦点与情感高光 (Accent & Spark)**：唯一实心行动按钮 (CTA)、长篇阅读金句引线、状态微圆点，严禁大面积铺陈。

## 2. 经典三元字体架构 (The Classic Trio)
1. **标题 (Serif)**：`Source Serif 4` / `思源宋体 (Noto Serif SC)` —— 出版物文学温度；
2. **正文 (Sans)**：`Inter` / `苹方 (PingFang SC)` / `思源黑体 (Noto Sans SC)` —— 15px 搭配 1.72 黄金行高，长篇夜读舒适清晰；
3. **时间 (Mono)**：`JetBrains Mono` —— 12px 天然物理等宽，营造钟表刻度与时间轨道的秩序美。

## 3. 背景纸质微颗粒感 (Grain Texture)
- 通过轻量级 SVG `feTurbulence` 噪点叠加在 `body::before` 上，默认强度为 5.0%，支持在设置中 0% ~ 15% 自由调节。
