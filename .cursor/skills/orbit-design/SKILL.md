---
name: orbit-design
description: Enforces Orbit visual design per root DESIGN.md and web/src/index.css tokens. Use when adding or changing UI, CSS, components, layout, typography, colors, buttons, forms, editor chrome, or when the user mentions design.md, design tokens, orbit-design, or visual consistency.
disable-model-invocation: true
---

# Orbit Design Compliance

## Before You Touch UI

1. Read [DESIGN.md](../../DESIGN.md) — Overview + Do's and Don'ts (skip re-reading full YAML if tokens unchanged).
2. Implementation lives in `web/src/index.css` — CSS variables + `.orbit-*` classes.

## Hard Rules

| Do | Don't |
|----|-------|
| `var(--color-*)`, `var(--type-*)`, `.orbit-*` classes | Hardcode `oklch()`, `#hex`, `fontSize` in `style={{}}` |
| One `.orbit-btn-primary` per view | Multiple primary buttons or purple/gradient marketing UI |
| `.orbit-prose` parity for edit + read | Different typography in editor vs article view |
| `:focus-visible` on interactives | Remove outlines without tokenized ring |
| Warm stone palette, serif headings | Pure `#000` dark bg, SaaS dashboard density |

**Allowed inline `style`**: dynamic layout only — e.g. sidebar `width`, TOC `paddingLeft`, floating menu `top`/`left`.

## Class Picklist

| Need | Class |
|------|-------|
| List page column | `.orbit-content` |
| Edit page column | `.orbit-editor-layout` |
| Read + rails | `.orbit-article-layout`, `.orbit-read-column`, `.orbit-toc-rail`, `.orbit-marginalia-rail` |
| Muted copy / loading | `.orbit-muted` |
| Error text | `.orbit-danger-text` |
| Text link | `.orbit-text-link` |
| Primary / danger button | `.orbit-btn-primary`, `.orbit-btn-danger` |
| List card | `.orbit-entry-card` |
| Form input | `.orbit-input`, `.orbit-title-input`, `.orbit-input-date` |
| Search UI | `.orbit-badge`, `.orbit-search-meta` |
| Shell / layout | `.orbit-shell`, `.orbit-header-bar`, `.orbit-icon-btn` |
| Auth | `.orbit-auth-page`, `.orbit-auth-panel`, `.orbit-auth-tab` |
| TOC | `.orbit-toc-rail`, `.orbit-toc-link`, `.orbit-toc-fab`, `.orbit-toc-drawer` |
| Marginalia | `.orbit-marginalia-gutter`, `.orbit-marginalia-marker`, `.orbit-marginalia-rail`, `.orbit-marginalia-fab` |
| Icons | `OrbitIcons.tsx`, `.orbit-icon-btn`, `.orbit-nav-icon` — see DESIGN.md Icons |
| Comments (bottom) | `.orbit-comments`, `.orbit-comment-*` |
| TipTap | `.orbit-editor-chrome`, `.orbit-toolbar`, `.orbit-toolbar-btn` |

Full list: `index.css` or DESIGN.md Components section.

## New Token Workflow

1. Add to `DESIGN.md` YAML front matter.
2. Mirror as `--*` variable in `:root` / `.dark` in `index.css`.
3. Expose via `.orbit-*` if reused in 2+ places.

## Copy (Chinese)

- Buttons: verb + noun —「保存修改」「写第一篇」
- Toast: fact, no「成功」—「日记已保存」
- Loading: 「保存中…」
- Empty: gentle + next action

## PR Checklist

```
- [ ] Read DESIGN.md constraints
- [ ] No hardcoded colors/fonts in components
- [ ] Tokens synced if YAML changed
- [ ] npm run web:build passes
```

## References

- Spec: [DESIGN.md](../../DESIGN.md)
- Layout: [docs/MARGINALIA-LAYOUT.md](../../docs/MARGINALIA-LAYOUT.md)
- Index: [docs/DESIGN.md](../../docs/DESIGN.md)
- Aesthetic refs: [Notion](https://getdesign.md/notion/design-md), [Geist](https://vercel.com/design.md) (structure only)
