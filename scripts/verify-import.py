#!/usr/bin/env python3
"""
对比 data-back-0616（修改前备份）与当前 data/*.md + orbit.db 导入结果。
忽略格式差异（marker、标题空格、缩进、章节头），只比实质内容与资产引用。
"""

from __future__ import annotations

import hashlib
import re
import sqlite3
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKUP = ROOT / "data-back-0616"
CURRENT = ROOT / "data"
DB_PATH = ROOT / "data" / "orbit.db"

AUTHOR_ALIASES = {
    "小圆子": "小圆子",
    "sunyuan": "小圆子",
    "孙远": "小圆子",
    "yuan": "小圆子",
    "小麟子": "小麟子",
    "linzhi": "小麟子",
    "麟宝": "小麟子",
    "辛麟芝": "小麟子",
    "zhi": "小麟子",
}

MARKER_RE = re.compile(r"^<!-- (letter|msg) \|(.+) -->\s*$")
DATE_LINE_RE = re.compile(r"^(\d{8})\s*$")
H2_RE = re.compile(r"^## (.+)$")
ASSET_RE = re.compile(r"!\[[^\]]*\]\(assets/([\w.-]+)\)")


def strip_frontmatter(text: str) -> str:
    return re.sub(r"^---\n[\s\S]*?\n---\n?", "", text).strip()


def normalize_author(raw: str) -> str:
    return AUTHOR_ALIASES.get(raw.strip(), raw.strip())


def to_plain(md: str) -> str:
    t = md
    t = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", t)
    t = re.sub(r"\[([^\]]*)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"^#{1,6}\s+", "", t, flags=re.M)
    t = re.sub(r"^>\s?", "", t, flags=re.M)
    t = re.sub(r"<br\s*/?>", "", t, flags=re.I)
    t = re.sub(r"\*\*\*", "", t)
    t = re.sub(r"[*_~`]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def parse_date_prefix(s: str) -> str | None:
    m = re.match(r"^(\d{4})(\d{2})(\d{2})", s)
    if not m:
        return None
    y, mo, d = m.groups()
    return f"{y}-{mo}-{d}"


def extract_assets(body: str) -> frozenset[str]:
    return frozenset(ASSET_RE.findall(body))


@dataclass
class Chunk:
    source: str  # backup | current | db
    kind: str  # diary | timeline | message | letter | memo
    key: str  # 匹配用键
    date: str | None = None
    author: str = ""
    title: str | None = None
    body: str = ""
    assets: frozenset[str] = field(default_factory=frozenset)
    plain: str = ""

    def __post_init__(self):
        self.plain = to_plain(self.body)
        if not self.assets:
            self.assets = extract_assets(self.body)


def split_diary_sections(text: str, kind: str, source: str) -> list[Chunk]:
    clean = strip_frontmatter(text)
    clean = re.sub(r"^# [^\n]*\n?", "", clean).strip()
    chunks: list[Chunk] = []
    title = None
    date = None
    lines: list[str] = []

    def flush():
        nonlocal title, date, lines
        body = "\n".join(lines).strip()
        if not date and not body and not title:
            lines = []
            return
        key = date or f"no-date:{hashlib.md5(body.encode()).hexdigest()[:8]}"
        if title:
            key = f"{key}|{title}"
        chunks.append(
            Chunk(source=source, kind=kind, key=key, date=date, title=title, body=body)
        )
        lines = []

    for line in clean.split("\n"):
        m = H2_RE.match(line)
        if m:
            flush()
            rest = m.group(1).strip()
            glued = re.match(r"^(\d{8})日?\s*(.*)$", rest)
            if glued:
                date = parse_date_prefix(glued.group(1))
                title = glued.group(2).strip() or None
            elif re.match(r"^(\d{8})(.+)$", rest):
                g = re.match(r"^(\d{8})(.+)$", rest)
                date = parse_date_prefix(g.group(1))
                title = g.group(2).strip() or None
            else:
                date = parse_date_prefix(rest)
                title = rest if not date else None
            lines = []
        else:
            lines.append(line)
    flush()
    return [c for c in chunks if c.plain or c.assets]


def split_by_markers(text: str, kind: str, source: str) -> list[Chunk]:
    clean = strip_frontmatter(text)
    chunks: list[Chunk] = []
    meta = None
    lines: list[str] = []

    def flush():
        nonlocal meta, lines
        if not meta:
            return
        body = "\n".join(lines).strip()
        if not body:
            lines = []
            return
        date = None
        if meta.get("date"):
            d = meta["date"].strip()
            if re.match(r"^\d{4}-\d{2}-\d{2}$", d):
                date = d
            else:
                date = parse_date_prefix(d)
        author = normalize_author(meta.get("author", ""))
        round_n = meta.get("round")
        key = f"round:{round_n}|{author}|{date or 'nodate'}"
        if kind == "message":
            key = f"{date or 'nodate'}|{author}|{hashlib.md5(body.encode()).hexdigest()[:10]}"
        chunks.append(
            Chunk(
                source=source,
                kind=kind,
                key=key,
                date=date,
                author=author,
                body=body,
            )
        )
        lines = []

    for line in clean.split("\n"):
        m = MARKER_RE.match(line)
        if m and m.group(1) == ("msg" if kind == "message" else "letter"):
            flush()
            fields = {}
            for part in m.group(2).split("|"):
                if ":" in part:
                    k, v = part.split(":", 1)
                    fields[k.strip()] = v.strip()
            meta = fields
            lines = []
            continue
        if meta is not None:
            lines.append(line)
    flush()
    return chunks


def split_backup_messages(text: str) -> list[Chunk]:
    clean = strip_frontmatter(text)
    chunks: list[Chunk] = []
    current_date = None
    lines: list[str] = []
    skip_headers = {"留言格式：", "当月内容", "留言板"}

    def flush():
        nonlocal current_date, lines
        body = "\n".join(lines).strip()
        if not body:
            lines = []
            return
        author = ""
        m = re.match(r"^(小圆子|小麟子|孙远|麟宝|辛麟芝)[：:]", body)
        if m:
            author = normalize_author(m.group(1))
        key = f"{current_date or 'nodate'}|{author}|{hashlib.md5(body.encode()).hexdigest()[:10]}"
        chunks.append(
            Chunk(
                source="backup",
                kind="message",
                key=key,
                date=current_date,
                author=author,
                body=body,
            )
        )
        lines = []

    for line in clean.split("\n"):
        if line.startswith("## "):
            h = line[3:].strip()
            if h in skip_headers or "格式" in h:
                continue
        dm = DATE_LINE_RE.match(line.strip())
        if dm:
            flush()
            current_date = parse_date_prefix(dm.group(1))
            continue
        # 内联日期行 20221011 开头
        inline = re.match(r"^(\d{8})\s*$", line.strip())
        if inline:
            flush()
            current_date = parse_date_prefix(inline.group(1))
            continue
        lines.append(line)
    flush()
    return chunks


def split_backup_letters(text: str) -> list[Chunk]:
    """按备份中的 ### 第N封信 / 主信结构拆分，辅以正文指纹匹配。"""
    clean = strip_frontmatter(text)
    # 去掉顶部装饰性 ## 行（非第N封）
    lines = clean.split("\n")
    chunks: list[Chunk] = []
    buf: list[str] = []
    in_letter = False
    round_hint = None

    def flush():
        nonlocal buf, round_hint
        body = "\n".join(buf).strip()
        if len(to_plain(body)) < 30:
            buf = []
            return
        author = ""
        if "亲亲远宝" in body[:80] or body.lstrip().startswith("亲亲远宝"):
            author = "小麟子"
        elif "你好哇，辛麟芝" in body[:120] or body.lstrip().startswith("你好哇"):
            author = "小圆子"
        elif "hello我的远宝" in body[:80]:
            author = "小麟子"
        key = f"plain:{hashlib.md5(to_plain(body).encode()).hexdigest()[:16]}"
        chunks.append(
            Chunk(
                source="backup",
                kind="letter",
                key=key,
                author=author,
                body=body,
            )
        )
        buf = []
        round_hint = None

    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^### 第.+封信", line.strip()):
            flush()
            in_letter = True
            i += 1
            continue
        if line.strip() in ("**我来了我来了**",):
            i += 1
            continue
        if re.match(r"^## 新的故事", line.strip()):
            i += 1
            continue
        if re.match(r"^## 亲亲远宝", line.strip()):
            flush()
            in_letter = True
            buf.append(line.replace("## ", "", 1))
            i += 1
            continue
        if in_letter or line.strip():
            buf.append(line)
        i += 1
    flush()
    return chunks


def load_db_chunks() -> list[Chunk]:
    if not DB_PATH.exists():
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT type, author, title, body, entry_date FROM entry WHERE deleted_at IS NULL ORDER BY type, entry_date"
    ).fetchall()
    chunks: list[Chunk] = []
    for r in rows:
        date = None
        if r["entry_date"]:
            from datetime import datetime, timezone

            date = datetime.fromtimestamp(r["entry_date"], tz=timezone.utc).strftime(
                "%Y-%m-%d"
            )
        body = r["body"] or ""
        kind = r["type"]
        author = r["author"] or ""
        if kind in ("diary", "timeline"):
            key = date or f"no-date:{hashlib.md5(body.encode()).hexdigest()[:8]}"
            if r["title"]:
                key = f"{key}|{r['title']}"
        elif kind == "message":
            key = f"{date or 'nodate'}|{author}|{hashlib.md5(body.encode()).hexdigest()[:10]}"
        else:
            key = f"plain:{hashlib.md5(to_plain(body).encode()).hexdigest()[:16]}"
        chunks.append(
            Chunk(
                source="db",
                kind=kind,
                key=key,
                date=date,
                author=author,
                title=r["title"],
                body=body,
            )
        )
    conn.close()
    return chunks


def compare_sets(
    label: str, backup: list[Chunk], current: list[Chunk], db: list[Chunk]
) -> dict:
    report = {"label": label, "counts": {}, "issues": []}

    report["counts"] = {
        "backup": len(backup),
        "current_md": len(current),
        "db": len(db),
    }

    if len(current) != len(db):
        report["issues"].append(
            f"current md ({len(current)}) 与 db ({len(db)}) 条数不一致"
        )

    # diary/timeline: 按 date+title 或 plain hash 匹配
    if label in ("diary", "timeline"):
        def index(chs: list[Chunk]) -> dict[str, Chunk]:
            out = {}
            for c in chs:
                k = c.key
                out[k] = c
            return out

        b_idx = index(backup)
        c_idx = index(current)
        d_idx = index(db)

        for k in sorted(set(b_idx) | set(c_idx)):
            b, c = b_idx.get(k), c_idx.get(k)
            if b and not c:
                report["issues"].append(f"备份有、当前无: {k}")
            elif c and not b:
                report["issues"].append(f"当前有、备份无: {k}")
            elif b and c:
                if b.plain != c.plain:
                    report["issues"].append(
                        f"正文差异 [{k}]: 备份 {len(b.plain)} 字 vs 当前 {len(c.plain)} 字"
                    )
                if b.assets != c.assets:
                    report["issues"].append(
                        f"资产差异 [{k}]: 备份 {sorted(b.assets)} vs 当前 {sorted(c.assets)}"
                    )

        for k in sorted(set(c_idx) - set(d_idx)):
            report["issues"].append(f"md 有、db 无: {k}")
        for k in sorted(set(d_idx) - set(c_idx)):
            report["issues"].append(f"db 有、md 无: {k}")

    else:
        # message/letter: 按 plain hash  multiset 匹配
        def plain_hashes(chs: list[Chunk]) -> dict[str, list[Chunk]]:
            m: dict[str, list[Chunk]] = {}
            for c in chs:
                h = hashlib.md5(c.plain.encode()).hexdigest()
                m.setdefault(h, []).append(c)
            return m

        b_h = plain_hashes(backup)
        c_h = plain_hashes(current)
        d_h = plain_hashes(db)

        b_only = set(b_h) - set(c_h)
        c_only = set(c_h) - set(b_h)
        for h in sorted(b_only):
            c = b_h[h][0]
            preview = c.plain[:60]
            report["issues"].append(f"备份独有 ({len(b_h[h])}条): {preview}…")
        for h in sorted(c_only):
            c = c_h[h][0]
            preview = c.plain[:60]
            report["issues"].append(f"当前独有 ({len(c_h[h])}条): {preview}…")

        # db vs current
        cd_only = set(c_h) - set(d_h)
        dc_only = set(d_h) - set(c_h)
        if cd_only:
            report["issues"].append(f"current md 与 db 正文 hash 不一致: md多 {len(cd_only)} 种")
        if dc_only:
            report["issues"].append(f"current md 与 db 正文 hash 不一致: db多 {len(dc_only)} 种")

        # count multiset
        from collections import Counter

        bc, cc, dc = Counter(b_h), Counter(c_h), Counter(d_h)
        if bc != cc:
            report["issues"].append(
                f"备份 vs 当前条数(按正文): 备份 {sum(len(v) for v in b_h.values())} / 当前 {sum(len(v) for v in c_h.values())}, hash种类 backup={len(b_h)} current={len(c_h)}"
            )
        if cc != dc:
            report["issues"].append("current md 与 db 正文 multiset 不完全一致")

    return report


def compare_assets():
    issues = []
    for name in ("data-back-0616/assets", "data/assets"):
        p = ROOT / name
        if not p.exists():
            issues.append(f"缺少目录 {name}")
            continue
    b_assets = set(
        f.name for f in (ROOT / "data-back-0616" / "assets").glob("*") if f.is_file()
    )
    c_assets = set(f.name for f in (ROOT / "data" / "assets").glob("*") if f.is_file())
    if b_assets != c_assets:
        only_b = sorted(b_assets - c_assets)
        only_c = sorted(c_assets - b_assets)
        if only_b:
            issues.append(f"资产文件仅备份有 ({len(only_b)}): {only_b[:5]}…")
        if only_c:
            issues.append(f"资产文件仅当前有 ({len(only_c)}): {only_c[:5]}…")
    else:
        issues.append(None)  # ok marker

    # md 引用的资产是否都存在
    missing = []
    for md in CURRENT.rglob("*.md"):
        text = md.read_text(encoding="utf-8")
        for key in extract_assets(text):
            if key not in c_assets:
                missing.append(f"{md.relative_to(ROOT)}: {key}")
    if missing:
        issues.append(f"当前 md 引用缺失资产 ({len(missing)}): {missing[:5]}…")

    return [i for i in issues if i]


def main():
    reports = []

    # diary
    b = split_diary_sections((BACKUP / "diary" / "daily.md").read_text(encoding="utf-8"), "diary", "backup")
    c = split_diary_sections((CURRENT / "diary" / "daily.md").read_text(encoding="utf-8"), "diary", "current")
    d = [x for x in load_db_chunks() if x.kind == "diary"]
    reports.append(compare_sets("diary", b, c, d))

    # timeline
    b = split_diary_sections((BACKUP / "diary" / "timeline.md").read_text(encoding="utf-8"), "timeline", "backup")
    c = split_diary_sections((CURRENT / "diary" / "timeline.md").read_text(encoding="utf-8"), "timeline", "current")
    d = [x for x in load_db_chunks() if x.kind == "timeline"]
    reports.append(compare_sets("timeline", b, c, d))

    # messages
    b = split_backup_messages((BACKUP / "messages" / "留言板.md").read_text(encoding="utf-8"))
    c = split_by_markers((CURRENT / "messages" / "留言板.md").read_text(encoding="utf-8"), "message", "current")
    d = [x for x in load_db_chunks() if x.kind == "message"]
    reports.append(compare_sets("message", b, c, d))

    # letters
    b = split_backup_letters((BACKUP / "letters" / "信箱.md").read_text(encoding="utf-8"))
    c = split_by_markers((CURRENT / "letters" / "信箱.md").read_text(encoding="utf-8"), "letter", "current")
    d = [x for x in load_db_chunks() if x.kind == "letter"]
    reports.append(compare_sets("letter", b, c, d))

    asset_issues = compare_assets()

    print("=" * 60)
    print("Orbit 数据校验：data-back-0616 vs data/ vs orbit.db")
    print("=" * 60)
    for r in reports:
        print(f"\n【{r['label']}】")
        c = r["counts"]
        print(f"  条数  备份={c['backup']}  当前md={c['current_md']}  db={c['db']}")
        if not r["issues"]:
            print("  ✓ 无实质差异")
        else:
            for issue in r["issues"][:15]:
                print(f"  ⚠ {issue}")
            if len(r["issues"]) > 15:
                print(f"  … 另有 {len(r['issues']) - 15} 条")

    print("\n【assets】")
    if not asset_issues:
        print("  ✓ 资产目录与 md 引用一致")
    else:
        for i in asset_issues:
            print(f"  ⚠ {i}")

    total_issues = sum(len(r["issues"]) for r in reports) + len(asset_issues)
    print("\n" + "=" * 60)
    if total_issues == 0:
        print("结论：导入数据与备份内容一致（仅格式不同）")
        return 0
    print(f"结论：发现 {total_issues} 项需关注（见上）")
    return 1


if __name__ == "__main__":
    sys.exit(main())
