# 数据迁移计划

## 一、源文件清单

| 文件 | 行数 | 内容 | 目标 |
|---|---|---|---|
| LoveLog.md | ~1670 | 恋爱时间线 + 恋爱日志（混合） | 拆分为 `journals/timeline.md` + `journals/daily.md` |
| 留言板.md | ~165 | 留言板（含归档折叠块） | `messages/留言板.md` |
| 信箱.md | ~96 | 信件（含 20+ 封折叠块） | `letters/信箱.md` |
| 恋爱原则.md | ~45 | 恋爱原则 | `journals/恋爱原则.md` |
| 关于辛芝芝.md | ~33 | 人物档案（纯文本，无图片） | `journals/关于辛芝芝.md` |

## 二、图片处理

### 2.1 提取

扫描所有 .md 文件，正则匹配两种格式：
- Markdown：`![...](https://cdn.nlark.com/...)`
- HTML：`<img src="https://cdn.nlark.com/...">`

### 2.2 下载

- 下载后计算 SHA256，取前 8 位作为文件名，存入 `data/assets/`
- URL query 参数（如 `?x-oss-process=image/auto-orient,1`）下载时保留（OSS 服务端处理），保存时去掉
- 超时/失败重试 3 次，记录失败列表
- 相同内容自动去重，只保留一份

### 2.3 heic 转 jpg

3 张 `.heic` 文件下载后用 `sharp` 库转为 `.jpg`：
- `1720443737665-...heic` → `.jpg`
- `1763913852046-...heic` → `.jpg`
- `1767541862660-...heic` → `.jpg`

### 2.4 替换 URL

生成 `{ 旧URL → assets/hash.ext }` 映射表，批量替换所有 .md 文件中的引用。

示例：
```
# 替换前
![](https://cdn.nlark.com/yuque/0/2022/jpeg/12995227/1654265848463-ecf28ac4.jpeg)

# 替换后
![](assets/a3f2c1d8.jpg)
```

## 三、Markdown 清洗

按优先级依次处理：

### 3.1 去掉 OCR 注释

```
# 删除
<!-- 这是一张图片，ocr 内容为：... -->
```

### 3.2 `<font>` 标签转 Markdown

```
# 替换前
<font style="color:rgb(0, 0, 0);">文本</font>
<font style="background:#F8CED3;color:#70000D">不可以</font>

# 替换后
文本
**不可以**
```

带背景色的 `<font>` 转为 **加粗**，纯颜色的直接去掉标签保留文本。

### 3.3 `<details>` 折叠块展开

```
# 替换前
<details class="lake-collapse"><summary id="..."><span class="ne-text">2023年12月</span></summary>
<p id="..."><span class="ne-text">内容</span></p>
</details>

# 替换后
### 2023年12月

内容
```

- 提取 `<summary>` 中的文本作为标题
- 提取 `<p>` 中的文本作为正文
- 保留 `<img>` 中的图片引用

### 3.4 语雀提示块转 Markdown

```
# 替换前
:::warning
内容
:::

# 替换后
> ⚠️ 内容
```

### 3.5 语雀 alert div 转 Markdown

```
# 替换前
<div data-type="info" class="ne-alert"><p>内容</p></div>

# 替换后
> 内容
```

### 3.6 清理残留 HTML

- `<span class="ne-text">文本</span>` → `文本`
- `<p id="...">` → 换行
- `<br>` → 换行
- `<hr>` → `---`
- `<strong>` → `**...**`
- 语雀 `@mentions` 链接 → 纯文本
- 语雀卡片占位符 → 删除

### 3.7 清理多余空行

连续 3 个以上空行合并为 2 个。

## 四、文件拆分

### 4.1 LoveLog.md 拆分

按 `# 恋爱时间线` 和 `# 恋爱日志` 两个一级标题拆分：

- `journals/timeline.md`：从文件开头到 `# 恋爱日志` 之前
- `journals/daily.md`：从 `# 恋爱日志` 到文件末尾

### 4.2 添加 frontmatter

每个目标文件添加 frontmatter：

```yaml
---
type: journal | letter | message
title: 恋爱时间线
---
```

## 五、目标文件结构

```
orbit/
├── data/                           # 数据目录（.gitignore 排除）
│   ├── journals/
│   │   ├── timeline.md             # 恋爱时间线（从 LoveLog.md 拆出）
│   │   ├── daily.md                # 恋爱日志（从 LoveLog.md 拆出）
│   │   ├── 恋爱原则.md
│   │   └── 关于辛芝芝.md
│   ├── messages/
│   │   └── 留言板.md
│   ├── letters/
│   │   └── 信箱.md
│   └── assets/                     # 图片（内容寻址，扁平存储）
│       ├── a3f2c1d8.jpg
│       ├── b7e4f920.jpg
│       └── ...
├── scripts/
│   └── migrate.ts
└── src/
```

## 六、代码实现

一个 Node.js 脚本 `scripts/migrate.ts`，依赖：

| 包 | 用途 |
|---|---|
| `sharp` | heic → jpg 转换 |
| `node-fetch` | 下载图片（或用原生 fetch） |

### 执行步骤

```
1. extractAllImageUrls()    // 扫描所有 .md，提取图片 URL 列表
2. downloadAllImages()       // 下载到 data/assets/，SHA256 命名，heic 转 jpg
3. buildUrlMap()             // 构建 旧URL → assets/hash.ext 映射
4. splitLoveLog()            // 拆分 LoveLog.md
5. cleanAllMarkdown()        // 清洗语雀 HTML + 替换 URL
6. addFrontmatter()          // 添加 frontmatter
7. moveToTargetDirs()        // 移动到 data/ 目标目录
8. deleteSourceFiles()       // 删除原始 .md 源文件
9. verify()                  // 校验：无残留 CDN 链接、图片文件完整
```

### 预计耗时

- 图片下载：200+ 张，约 2-5 分钟（取决于网络）
- 清洗转换：秒级
