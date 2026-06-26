import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { TOC_RAIL_STORAGE_KEY, useRailExpanded } from "../lib/railPreferences";
import { TocIcon, CloseIcon } from "./OrbitIcons";

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

/** 从 HTML 或 Markdown 文本中提取标题 */
export function extractToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  let idx = 0;

  if (content.trimStart().startsWith("<")) {
    const matches = content.matchAll(/<h([1-4])[^>]*>(.*?)<\/h\1>/gi);
    for (const m of matches) {
      const level = parseInt(m[1]);
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      if (text) items.push({ level, text, id: `toc-${idx++}` });
    }
    return items;
  }

  for (const line of content.split("\n")) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      items.push({ level, text, id: `toc-${idx++}` });
    }
  }
  return items;
}

function countPrevSame(items: TocItem[], index: number): number {
  let count = 0;
  for (let i = 0; i < index; i++) {
    if (items[i].level === items[index].level && items[i].text === items[index].text) {
      count++;
    }
  }
  return count;
}

function useScrollHighlight(items: TocItem[]) {
  const [activeId, setActiveId] = useState("");

  const handleClick = useCallback(
    (item: TocItem, index: number, onAfter?: () => void) => {
      const editor = document.querySelector(".ProseMirror") ?? document.querySelector(".milkdown-wrapper .milkdown .editor");
      if (!editor) return;

      const headings = editor.querySelectorAll("h1, h2, h3, h4");
      let matchCount = 0;
      for (const h of headings) {
        const hLevel = parseInt(h.tagName[1]);
        const hText = (h.textContent || "").trim();
        if (hLevel === item.level && hText === item.text) {
          if (matchCount === countPrevSame(items, index)) {
            h.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveId(item.id);
            onAfter?.();
            return;
          }
          matchCount++;
        }
      }
      if (headings[index]) {
        headings[index].scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveId(item.id);
        onAfter?.();
      }
    },
    [items]
  );

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main || items.length === 0) return;

    const onScroll = () => {
      const editor = document.querySelector(".ProseMirror") ?? document.querySelector(".milkdown-wrapper .milkdown .editor");
      if (!editor) return;
      const headings = editor.querySelectorAll("h1, h2, h3, h4");
      let current = "";
      for (let i = 0; i < headings.length && i < items.length; i++) {
        const rect = headings[i].getBoundingClientRect();
        if (rect.top <= 120) {
          current = items[i]?.id || "";
        }
      }
      if (current) setActiveId(current);
    };

    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [items]);

  return { activeId, handleClick };
}

function dashWidth(level: number, minLevel: number): number {
  const depth = level - minLevel;
  return Math.max(10, 18 - depth * 4);
}

function TocList({
  items,
  activeId,
  onItemClick,
}: {
  items: TocItem[];
  activeId: string;
  onItemClick: (item: TocItem, index: number) => void;
}) {
  const minLevel = Math.min(...items.map((i) => i.level));

  return (
    <nav className="space-y-0.5">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemClick(item, index)}
          className={`orbit-toc-link${activeId === item.id ? " orbit-toc-link--active" : ""}`}
          style={{ "--toc-indent": `${(item.level - minLevel) * 12 + 4}px` } as CSSProperties}
          title={item.text}
        >
          {item.text}
        </button>
      ))}
    </nav>
  );
}

interface Props {
  items: TocItem[];
}

export function TocRail({ items }: Props) {
  const [expanded, setExpanded] = useRailExpanded(TOC_RAIL_STORAGE_KEY, false);
  const { activeId, handleClick } = useScrollHighlight(items);

  if (items.length === 0) return null;

  const minLevel = Math.min(...items.map((item) => item.level));

  return (
    <aside
      className={`orbit-toc-rail hidden xl:flex shrink-0${
        expanded ? " orbit-toc-rail--expanded" : " orbit-toc-rail--collapsed"
      }`}
    >
      {!expanded ? (
        <div className="orbit-toc-rail-collapsed">
          <button
            type="button"
            className="orbit-toc-rail-pin"
            onClick={() => setExpanded(true)}
            aria-label="展开目录"
          >
            <TocIcon />
          </button>
          <div className="orbit-toc-dashes" role="navigation" aria-label="目录">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`orbit-toc-dash orbit-toc-dash--level-${item.level}${
                  activeId === item.id ? " orbit-toc-dash--active" : ""
                }`}
                style={{ width: `${dashWidth(item.level, minLevel)}px` }}
                onClick={() => handleClick(item, index)}
                title={item.text}
                aria-label={item.text}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="orbit-toc-rail-body">
          <div className="orbit-rail-header">
            <button
              type="button"
              className="orbit-rail-collapse orbit-rail-collapse--left"
              onClick={() => setExpanded(false)}
              aria-label="收起目录"
            >
              &laquo;
            </button>
            <h3 className="orbit-rail-header-title">目录</h3>
          </div>
          <TocList
            items={items}
            activeId={activeId}
            onItemClick={(item, index) => handleClick(item, index)}
          />
        </div>
      )}
    </aside>
  );
}

export function MobileToc({ items }: Props) {
  const [open, setOpen] = useState(false);
  const { activeId, handleClick } = useScrollHighlight(items);

  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="orbit-toc-fab xl:hidden"
        aria-label="打开目录"
      >
        <TocIcon size="md" />
      </button>

      {open && (
        <div
          className="orbit-overlay-scrim fixed inset-0 z-40 xl:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className={`orbit-toc-drawer xl:hidden${open ? " orbit-toc-drawer--open" : ""}`}>
        <div className="orbit-toc-drawer-panel">
          <div className="orbit-toc-drawer-header">
            <div className="flex items-center gap-3">
              <div className="orbit-toc-drawer-handle" aria-hidden />
              <span className="orbit-toc-drawer-title">目录</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="orbit-icon-btn p-1 cursor-pointer"
              aria-label="关闭目录"
            >
              <CloseIcon size="md" />
            </button>
          </div>

          <div className="orbit-toc-drawer-body">
            <TocList
              items={items}
              activeId={activeId}
              onItemClick={(item, index) =>
                handleClick(item, index, () => setOpen(false))
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
