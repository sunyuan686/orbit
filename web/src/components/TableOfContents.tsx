import { useState, useEffect, useCallback } from "react";

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

/** 从 HTML 或 Markdown 文本中提取标题 */
export function extractToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  let idx = 0;

  // HTML 格式（TipTap 输出）
  if (content.trimStart().startsWith("<")) {
    const matches = content.matchAll(/<h([1-4])[^>]*>(.*?)<\/h\1>/gi);
    for (const m of matches) {
      const level = parseInt(m[1]);
      // 去除内嵌 HTML 标签
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      if (text) items.push({ level, text, id: `toc-${idx++}` });
    }
    return items;
  }

  // Markdown 格式（旧数据兼容）
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

/** 计算当前 index 之前，有多少个同 level + 同 text 的项 */
function countPrevSame(items: TocItem[], index: number): number {
  let count = 0;
  for (let i = 0; i < index; i++) {
    if (items[i].level === items[index].level && items[i].text === items[index].text) {
      count++;
    }
  }
  return count;
}

// ─── 跳转 + 滚动高亮逻辑（共用） ───

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

// ─── 目录列表（纯展示） ───

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
          onClick={() => onItemClick(item, index)}
          className={`block w-full text-left text-sm py-1.5 rounded transition-colors truncate ${
            activeId === item.id
              ? "text-stone-900 dark:text-stone-100 font-medium"
              : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
          }`}
          style={{ paddingLeft: `${(item.level - minLevel) * 12 + 4}px` }}
          title={item.text}
        >
          {item.text}
        </button>
      ))}
    </nav>
  );
}

// ─── 桌面端：右侧栏 ───

interface Props {
  items: TocItem[];
}

export function TableOfContents({ items }: Props) {
  const { activeId, handleClick } = useScrollHighlight(items);

  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
        目录
      </p>
      <TocList
        items={items}
        activeId={activeId}
        onItemClick={(item, index) => handleClick(item, index)}
      />
    </div>
  );
}

// ─── 移动端：浮动按钮 + 底部抽屉 ───

export function MobileToc({ items }: Props) {
  const [open, setOpen] = useState(false);
  const { activeId, handleClick } = useScrollHighlight(items);

  if (items.length === 0) return null;

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-6 z-30 w-11 h-11 rounded-full bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-800 shadow-lg flex items-center justify-center hover:bg-stone-700 dark:hover:bg-stone-300 active:scale-95 transition-all xl:hidden"
        aria-label="打开目录"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M3 12h12M3 18h18" />
        </svg>
      </button>

      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 xl:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 底部抽屉 */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 xl:hidden transition-transform duration-250 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-white dark:bg-stone-800 rounded-t-2xl max-h-[60vh] flex flex-col shadow-2xl">
          {/* 拖拽指示条 + 标题 */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-stone-100 dark:border-stone-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-1 rounded-full bg-stone-300 dark:bg-stone-600" />
              <span className="text-sm font-medium text-stone-500 dark:text-stone-400">目录</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 目录列表 */}
          <div className="overflow-y-auto px-4 py-3">
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
