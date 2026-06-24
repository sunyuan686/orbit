---
version: alpha
name: Orbit
description: A restrained, romantic content platform for two people. Warm stone surfaces, serif headings, and reading-first typography—adapted from Notion's editorial warmth and Geist's token discipline, tuned for long-form diary and letter writing rather than SaaS dashboards.

colors:
  bg: oklch(0.99 0.002 80)
  surface: oklch(1 0 0)
  surface-raised: oklch(0.975 0.004 80)
  border: oklch(0.88 0.005 80)
  border-light: oklch(0.93 0.003 80)
  text-primary: oklch(0.18 0.01 80)
  text-secondary: oklch(0.52 0.015 80)
  text-muted: oklch(0.68 0.01 80)
  accent: oklch(0.32 0.02 80)
  danger: oklch(0.55 0.18 27)
  overlay: oklch(0 0 0 / 0.35)
  sidebar-bg: oklch(0.97 0.003 80)
  sidebar-border: oklch(0.9 0.005 80)
  sidebar-nav-hover: oklch(0.95 0.004 80)
  sidebar-nav-active: oklch(0.93 0.007 80)
  highlight-comment: oklch(0.9 0.08 92 / 0.58)
  highlight-comment-border: oklch(0.72 0.11 85 / 0.8)
  highlight-search: oklch(0.92 0.14 90 / 0.55)
  highlight-search-text: oklch(0.35 0.09 70)
  on-primary: oklch(0.99 0.002 80)
  focus-ring: oklch(0.45 0.12 250)

colors-dark:
  bg: oklch(0.2 0.01 60)
  surface: oklch(0.23 0.012 60)
  surface-raised: oklch(0.27 0.014 60)
  border: oklch(0.36 0.015 60)
  border-light: oklch(0.3 0.012 60)
  text-primary: oklch(0.93 0.006 80)
  text-secondary: oklch(0.68 0.014 80)
  text-muted: oklch(0.52 0.012 80)
  accent: oklch(0.82 0.012 80)
  danger: oklch(0.65 0.16 27)
  overlay: oklch(0 0 0 / 0.5)
  sidebar-bg: oklch(0.18 0.01 60)
  sidebar-border: oklch(0.3 0.015 60)
  sidebar-nav-hover: oklch(0.24 0.014 60)
  sidebar-nav-active: oklch(0.28 0.018 60)
  highlight-comment: oklch(0.48 0.08 82 / 0.5)
  highlight-comment-border: oklch(0.76 0.08 85 / 0.7)
  highlight-search: oklch(0.45 0.1 85 / 0.5)
  highlight-search-text: oklch(0.92 0.08 90)
  on-primary: oklch(0.2 0.01 60)
  focus-ring: oklch(0.72 0.1 250)

typography:
  display:
    fontFamily: '"New York Small", "New York", "Iowan Old Style", Charter, "Bitstream Charter", "Source Serif 4", Georgia, "Songti SC", STSong, SimSun, ui-serif, serif'
    fontSize: 2rem
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: -0.02em
  title:
    fontFamily: '{typography.display.fontFamily}'
    fontSize: 1.5rem
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: -0.01em
  subtitle:
    fontFamily: '{typography.display.fontFamily}'
    fontSize: 1.2rem
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.75
  secondary:
    fontFamily: '{typography.body.fontFamily}'
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '{typography.body.fontFamily}'
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
  xs:
    fontFamily: '{typography.body.fontFamily}'
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Courier New", monospace'
    fontSize: 0.875em
    fontWeight: 400
    lineHeight: 1.6

rounded:
  sm: 6px
  md: 8px
  lg: 10px
  xl: 12px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 40px
  section: 56px

components:
  button-primary:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: "0 14px"
  button-danger:
    backgroundColor: transparent
    textColor: "{colors.danger}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 40px
  entry-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  entry-card-hover:
    backgroundColor: "{colors.surface-raised}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.secondary}"
    rounded: "{rounded.md}"
    height: 44px
    padding: "0 12px"
  textarea:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.secondary}"
    rounded: "{rounded.md}"
    padding: "11px 13px"
  toast:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.secondary}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
---

# Orbit

## Overview

Orbit is an open-source platform for two people to keep a shared record of their relationship—diary, timeline, messages, letters, and memos. The visual language should feel **restrained, romantic, and premium**: quiet enough for daily writing without pressure, polished enough to read for a long time.

**Design references** (from [getdesign.md](https://getdesign.md/)):

| Reference | What we borrow | What we reject |
|-----------|----------------|----------------|
| [Notion](https://getdesign.md/notion/design-md) | Warm stone neutrals, hairline borders, soft card surfaces, generous body line-height, metadata in muted captions | Marketing hero bands, purple pill CTAs, pastel feature-card rainbow, dense SaaS chrome |
| [Vercel Geist](https://vercel.com/design.md) | Semantic tokens, 4px spacing scale, flat elevation, motion discipline, focus rings, Do's and Don'ts | Cold gray palette, Geist Sans everywhere, dashboard density, Title Case English copy rules |
| Jant (internal ancestor) | CSS-variable tokens in `web/src/index.css`, TipTap prose parity between edit and read | Full visual clone; Orbit adds serif headings and couple-centric tone |

**Product principles**

- **Content first**: typography and whitespace carry hierarchy; decoration is rare.
- **Writing without pressure**: no celebratory animation, no aggressive CTAs, no notification-red urgency unless something failed.
- **Mobile-first**: thumb reach, 44px touch targets, sticky editor toolbar on small screens.
- **AI-friendly**: agents read this file before changing UI; runtime tokens live in `web/src/index.css` and must stay in sync.

**Tech constraints**

- React + Vite + Tailwind CSS v4
- Theme via `.dark` class on `<html>` (light / dark / system)
- Use CSS variables (`var(--color-*)`, `var(--type-*)`) or `.orbit-*` classes—never hardcode `oklch()` or hex in components

## Colors

Orbit uses a **warm stone palette** inspired by Notion's `surface` / `hairline` / `charcoal` hierarchy, but without brand purple or pastel marketing cards. Color signals **reading hierarchy** and **state**, not decoration.

**Light theme**

- **Background (`bg`)**: page canvas; slightly warmer than pure white.
- **Surface (`surface`, `surface-raised`)**: cards, header, inputs. Raised variant for hover and nested blocks.
- **Borders (`border`, `border-light`)**: hairline separation—Notion-style `hairline` at low contrast.
- **Text (`text-primary` → `text-muted`)**: three-step gray for title, supporting copy, and metadata.
- **Accent (`accent`)**: hover on primary button only—not a saturated brand stripe.
- **Danger (`danger`)**: delete actions and errors only.
- **Highlights**: amber comment anchors and warm search marks—distinct from links.

**Dark theme**

- Warm gray bases (`oklch` hue ~60), never `#000` pure black.
- Same token names; values swap under `.dark`.

**Semantic rules**

- One solid high-contrast action per view (primary button).
- WCAG AA: body text contrast ≥ 4.5:1.
- Never signal state with color alone—pair with icon or label text.

## Typography

**Two families, two roles** (Notion uses one sans; Orbit adds editorial serif for headings):

| Role | Family | Usage |
|------|--------|-------|
| Heading | New York / Songti / Georgia stack | Page titles, article headings, sidebar "Orbit" wordmark |
| Body | System UI + CJK sans | Navigation, buttons, prose, comments, forms |
| Mono | System monospace | Inline code, pre blocks |

**Scale**

- `display` (2rem): rare hero moments
- `title` (1.5rem): page headings, sidebar title
- `subtitle` (1.2rem): article h2 level
- `body` (1rem, line-height 1.75): editor and reading—**match TipTap and read view**
- `secondary` (0.875rem): nav, buttons, comments
- `xs` (0.75rem): dates, meta; use `font-variant-numeric: tabular-nums`

**Rules**

- Max **two font weights** per view (400 + 500 or 600).
- Headings use weight 400—romantic/editorial, not bold SaaS.
- Links in prose: inherit color, underline with `border` token; no blue default links.

## Layout

**Spacing scale** (4px base, Geist-compatible):

`4 · 8 · 12 · 16 · 24 · 32 · 40 · 56px`

**Rhythm**

- 8px inside a control group
- 16px between related blocks
- 32–40px between major sections

**Content widths**

| Token | Width | Use |
|-------|-------|-----|
| `--layout-content` | 680px | Lists, read column |
| `--layout-editor` | 720px | Edit forms |
| `--layout-article` | 900px | Read view with TOC gutter |

Center with `margin: 0 auto`. Side padding: `16px` mobile, `32px` desktop (`md+`).

**Shell**

- Collapsible sidebar: 60–280px desktop; drawer + overlay on mobile.
- Main scroll: content area only; sidebar and header fixed height.

**Touch**

- Minimum interactive target: **44×44px** (iOS HIG).
- List rows: full-row click target, not text-only.

**Breakpoints**

- `md` (768px): sidebar static, search visible in header
- `sm` (640px): some header metadata appears

## Elevation & Depth

Hierarchy comes from **tonal surfaces and hairline borders**, not shadows (Notion cards + Geist flatness).

| Level | Treatment |
|-------|-----------|
| Page | `bg` |
| Card / panel | `surface` + `border-light` 1px |
| Hover card | `surface-raised`, border `border` |
| Header / sidebar | `surface` or `sidebar-bg` + bottom/right border |
| Floating (toast, selection menu) | `surface` + light shadow `0 8px 24px oklch(0 0 0 / 0.12)` |
| Modal overlay | `overlay` scrim |

Avoid heavy drop shadows on static content.

## Shapes

| Token | Radius | Use |
|-------|--------|-----|
| `sm` (6px) | buttons, nav items, toolbar controls |
| `md` (8px) | cards, images, inputs, comment boxes |
| `lg` (10px) | toasts |
| `full` | avatars, toast icons |

One radius family per view—do not mix 4px and 16px corners on the same screen.

## Components

Runtime classes live in `web/src/index.css`. Use these names in React.

### Buttons (`.orbit-btn`)

| Variant | Class | When |
|---------|-------|------|
| Secondary | `.orbit-btn` | Default actions |
| Primary | `.orbit-btn.orbit-btn-primary` | Single main action per view ("新建", "保存") |
| Danger | `.orbit-btn.orbit-btn-danger` | Destructive text actions ("删除") |

States: hover lifts background one step; disabled at 45% opacity; `:focus-visible` shows focus ring.

### Entry list (`.orbit-entry-card`)

Notion `card-base` pattern: white/stone surface, hairline border, 8px radius. Title + date + optional metadata row (`.orbit-article-meta`).

### Prose (`.orbit-prose` / `.ProseMirror`)

Edit and read modes **must share** the same heading sizes, blockquote, code, and image rules. Images: `max-width: 100%`, `border-radius: 8px`.

### Comments (`.orbit-comment-*`)

- Bottom thread: divider-top section below article
- Inline anchor: amber `highlight-comment` background—warm, not system yellow
- Quote block: left border + `surface-raised` fill

### Forms

- Inputs and textareas: `surface` fill, `border-light`, 8px radius, 44px min height for single-line
- Placeholder: `text-muted`, italic in editor empty state

### Toast (`.orbit-toast`)

Short confirmation; success/error vary border color only. No "成功" wording—see Voice below.

### Layout utilities

| Class | Purpose |
|-------|---------|
| `.orbit-content` | 680px centered column |
| `.orbit-editor-layout` | 720px centered column |
| `.orbit-article-layout` | 900px centered with TOC |
| `.orbit-muted` | secondary copy styling |
| `.orbit-danger-text` | error inline text |
| `.orbit-text-link` | underlined text link |
| `.orbit-auth-*` | login / register page |
| `.orbit-toc-*` | article table of contents |

## Voice & Content

Copy is part of the design. Orbit speaks **warm, direct Chinese**—not marketing, not enterprise SaaS.

- **Buttons**: verb + noun —「写第一篇日记」「发送回信」「保存修改」
- **Empty states**: gentle + next step —「还没有留言。写一句想对 TA 说的话吧」
- **Loading**: present continuous + ellipsis —「加载中…」「保存中…」
- **Toast**: state fact, no 「成功」—「日记已保存」「图片已上传」
- **Errors**: what happened + what to do —「保存失败。请检查网络后重试」
- **Metadata**: small, muted, tabular numbers for dates
- Avoid: 「温馨提示」, exclamation spam, emoji in body copy (nav emoji are OK)

## Do's and Don'ts

**Do**

- Read this file before adding or changing UI
- Use design tokens and `.orbit-*` classes
- Keep read and edit typography identical
- Show `:focus-visible` ring on all interactive elements
- Honor `prefers-reduced-motion`
- Prefer 0–150ms transitions; 220ms max for toasts and overlays

**Don't**

- Hardcode colors or font sizes in `style={{ }}` (layout positioning is OK)
- Use pure black `#000` backgrounds in dark mode
- Add gradients, neon accents, or dashboard-style dense tables
- Use more than one primary button per screen
- Use color alone for errors or success
- Mix sharp and heavily rounded corners in one view
- Copy Notion's purple CTAs or pastel marketing cards—they clash with Orbit's restraint

---

**Sync**: YAML tokens above are normative. Implementation: `web/src/index.css`. Validate structure with `npx @google/design.md lint` when the CLI is available.
