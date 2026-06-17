#!/usr/bin/env python3
"""规范化 diary/timeline 的 ## 标题：## YYYYMMDD 事件名（日期与事件名之间有空格）"""

import re
import sys
from pathlib import Path

H2_RE = re.compile(r"^## (.+)$")
DATE_RE = re.compile(r"^(\d{8})日?\s*(.*)$")
GLUED_RE = re.compile(r"^(\d{8})(.+)$")
IMG_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")


def normalize_h2_line(raw: str) -> tuple[str | None, list[str]]:
    """返回 (新标题行, 需插入正文开头的图片行)"""
    rest = raw.strip()
    if not rest:
        return None, []

    # 明显笔误：9 位日期
    if rest.startswith("202302014"):
        rest = "20230214" + rest[9:]

    dm = DATE_RE.match(rest)
    if dm:
        date, title = dm.group(1), dm.group(2)
    else:
        gm = GLUED_RE.match(rest)
        if gm:
            date, title = gm.group(1), gm.group(2)
        else:
            # 无日期前缀，如「期待下次见面」
            return f"## {rest}", []

    images = IMG_RE.findall(title)
    title_clean = IMG_RE.sub("", title).strip()
    return f"## {date} {title_clean}", images


def normalize_file(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    out: list[str] = []
    changed = 0

    for line in lines:
        if line.strip() in ("##", ""):
            if line.strip() == "##":
                changed += 1
            if line.strip() == "":
                out.append(line)
            continue

        m = H2_RE.match(line)
        if not m:
            out.append(line)
            continue

        new_line, images = normalize_h2_line(m.group(1))
        if new_line is None:
            if line.strip() == "##":
                changed += 1
            continue

        if new_line != line or images:
            changed += 1
        out.append(new_line)
        out.extend(images)

    path.write_text("\n".join(out), encoding="utf-8")
    return changed


def fix_timeline_preamble(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = text.replace("type: letter\n", "type: timeline\n", 1)
    # 去掉 H1 前的 HTML 残留
    text = re.sub(
        r"---\ntype: timeline\ntitle: 恋爱时间线\n---\n\n<br />\n\n\*\*\*\n\n",
        "---\ntype: timeline\ntitle: 恋爱时间线\n---\n\n",
        text,
    )
    path.write_text(text, encoding="utf-8")


def main() -> None:
    root = Path(__file__).resolve().parent.parent / "data" / "diary"
    total = 0
    for name in ("daily.md", "timeline.md"):
        p = root / name
        if not p.exists():
            print(f"skip {p}")
            continue
        n = normalize_file(p)
        total += n
        print(f"{name}: {n} 处标题已规范化")
    fix_timeline_preamble(root / "timeline.md")
    print("timeline.md: frontmatter 与文首残留已清理")


if __name__ == "__main__":
    main()
