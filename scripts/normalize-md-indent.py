#!/usr/bin/env python3
"""统一留言板/信箱 markdown 缩进：左对齐正文，去掉 blockquote 与签名行大段空格。"""

from __future__ import annotations

import re
import sys
from pathlib import Path

MARKER_RE = re.compile(r"^<!-- (letter|msg) \|.+ -->\s*$")
FRONTMATTER_BOUNDARY = re.compile(r"^---\s*$")


def normalize_line(line: str) -> str | list[str]:
    s = line.rstrip("\n\r")
    if not s.strip():
        return ""

    # 去掉 blockquote 前缀（可能多层）
    while True:
        m = re.match(r"^>\s?(.*)$", s)
        if not m:
            break
        s = m.group(1)

    # 去掉任意 Unicode 行首空白（空格、tab、全角空格等）
    s = re.sub(r"^\s+", "", s).rstrip()

    # 行内大段空白 + 短签名 → 拆成两行
    m = re.match(r"^(.*[。！？.!?…~]|\S.{20,}?)\s{4,}((?:爱你的|你的|爱麟宝|爱麟宝的|超级爱).{0,40})$", s)
    if m:
        return [m.group(1).rstrip(), m.group(2).strip()]

    # 行内 tab / 连续空格压缩（不影响 ![](...) ）
    if not s.startswith("!["):
        s = re.sub(r"[\t ]{2,}", " ", s)

    return s


def normalize_file(path: Path) -> tuple[int, int]:
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    out: list[str] = []
    in_frontmatter = False
    changed = 0

    for line in lines:
        if FRONTMATTER_BOUNDARY.match(line):
            in_frontmatter = not in_frontmatter
            out.append(line)
            continue

        if in_frontmatter or MARKER_RE.match(line):
            out.append(line)
            continue

        new_line = normalize_line(line)
        if isinstance(new_line, list):
            if new_line != [line.rstrip("\n\r")]:
                changed += 1
            out.extend(new_line)
        else:
            if new_line != line.rstrip("\n\r"):
                changed += 1
            out.append(new_line)

    # 连续空行最多保留 1 行
    collapsed: list[str] = []
    prev_empty = False
    for line in out:
        empty = line == ""
        if empty and prev_empty:
            changed += 1
            continue
        collapsed.append(line)
        prev_empty = empty

    text = "\n".join(collapsed)
    if raw.endswith("\n"):
        text += "\n"

    path.write_text(text, encoding="utf-8")
    return changed, len(collapsed)


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "data"
    targets = [
        root / "messages" / "留言板.md",
        root / "letters" / "信箱.md",
    ]
    for path in targets:
        if not path.exists():
            print(f"skip (missing): {path}")
            continue
        before_markers = len(MARKER_RE.findall(path.read_text(encoding="utf-8")))
        changed, lines = normalize_file(path)
        after_markers = len(MARKER_RE.findall(path.read_text(encoding="utf-8")))
        print(f"{path.name}: {changed} 行已调整, {lines} 行, marker {before_markers}→{after_markers}")


if __name__ == "__main__":
    main()
