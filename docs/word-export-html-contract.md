# Readmdvue Word 导出——HTML 渲染契约与转换审计（全局换行检查）

> 日期：2026-08-18　原理：**链路是固定契约**——md → HTML 由我们自己的 markdownRenderer.ts（marked 12 + 自定义 renderer）生成，
> HTML → Word 由我们自己的 htmlToDocx.ts 转换。既然 HTML 结构是我们生成的，就应该逐条按契约精确转换，不存在"解析不出来"。

## 一、渲染契约（markdownRenderer.ts 实际输出，node 实测）

| md 写法 | HTML 输出（契约） | 转换处理 | 状态 |
|---|---|---|---|
| 普通段落 | `<p>...</p>` | p case：独立段落 + 首行缩进 480twips + 行距 1.5 | ✅ |
| 段落内软换行（单 \n） | **`<p>` 被 renderer.paragraph 按 `<br>` 拆成多个独立 `<p>`** | 每个 p 独立段落 | ✅ |
| 段内硬换行（双 \n） | 多个 `<p>`（空行分隔） | 每 p 独立段落（段间距来自 spacing） | ✅ |
| 冒号行尾 → 子内容 | `<p class="md-sub-indent">`（renderer.paragraph 子缩进） | p case 统一处理（缩进样式在 Word 中由首行缩进承担） | ✅ |
| 标题 | `<h1 id=..>..</h1>` … `<h6>` | heading case：15/13/12pt 加粗黑体（h1 居中） | ✅ |
| 无序列表 | `<ul><li>..</li></ul>` 可嵌套 | convertList 递归：每 li 独立段落 + `• ` 前缀 + 层级缩进 | ✅ |
| 有序列表 | `<ol><li>..</li></ol>` | convertList 递归：`1. ` 前缀 | ✅ |
| li 内多段/换行 | `<li>文本<br>文本2<ul>..</ul></li>` | convertList 剥离嵌套列表独立递归；li 内文本经 extractRuns（含 \n 拆 break） | ✅ |
| 代码块 | `<pre><code class="language-xx">多行代码</code></pre>` | convertCodeBlock：每行拆 run+break、长行 70 字符空格处换行、灰底等宽 | ✅ |
| 引用块 | `<blockquote class="enhanced-blockquote"><p>..</p><ul>..</ul><pre>..</pre></blockquote>`（**内部是多个块级元素**） | blockquote case：**每块独立段落 + 引用样式（左蓝边/浅底/缩进）** | ✅ 2026-08-18 修复 |
| alert 引用 | `<blockquote class="alert note"><p class="alert-title">Note</p><p>..</p></blockquote>` | blockquote case：alert-title 加粗独立段落 | ✅ 2026-08-18 修复 |
| 表格 | `<table><thead><tr><th>..</th></tr></thead><tbody>..</tbody></table>` | table case：表头加粗浅底、内容 11pt、边框；表格后补空段落 | ✅ |
| 图片 | `<img src="data:…|http…|相对路径">` | imageToDocxImage：data URL 直解 / canvas 原分辨率重编码 / fetch；**保留原图分辨率** | ✅ |
| mermaid 图表 | `.chart-container` 内 `<svg viewBox=..>` + `.chart-fallback` 源码块 | svg case：renderChartLight 浅色重渲染 → svgToDocxImage **2x 高清光栅化** | ✅ 2026-08-18 高清 |
| 分隔线 | `<hr>` | hr case：下边框分隔线段落 | ✅ 2026-08-18 新增（此前丢失） |
| 行内 code | `<code>..</code>` | extractRuns：Consolas/等线 | ✅ |
| 行内加粗/斜体/链接 | `<strong>/<em>/<a>` | extractRuns：bold/italics/链接蓝色 | ✅（链接不可点，候选） |
| 容器 div/section | `<div class="md-sub-indent">…</div>` 等 | div case：递归子节点 | ✅ |

## 二、换行审计清单（每类内容"一行"的界定）

1. **段落**：一个 `<p>` = 一个 Word 段落（首行缩进）。软换行已被 renderer.paragraph 拆成独立 `<p>`，不会丢。
2. **列表**：一个 `<li>` = 一个 Word 段落（`• `/`1. ` 前缀）。嵌套列表 = 更深的独立段落。li 内多行（br/\n）经 extractRuns 拆 break，不连成一行。
3. **代码块/目录树**：一行源码 = 一个 `<w:br/>` + run；长行 70 字符在空格处再拆；**空行保留为 break**（不丢行）。
4. **引用块**：blockquote 内每个块级子元素 = 一个 Word 段落（全部套引用样式）。**不再合并成单段**（2026-08-18 修复）。
5. **表格单元格**：convertInlineBlock 处理单元格内多段落/列表（每段独立 + 11pt）。
6. **直接文本节点**（div 直接子文本含 \n）：convertChildren 的 TEXT_NODE 分支拆 break（2026-08-18 已修）。

## 三、审计方法（防回归）

- 契约由代码固定，改动 markdownRenderer.ts 的 renderer 时**必须同步本表**。
- 转换器 htmlToDocx.ts 的每个 case 必须有契约对应项；新增 md 语法 → 先查 marked 输出结构，再补 case。
- 换行断点统一规则：**一个块级元素 = 一个 Word 段落**；块内多行 = run + `<w:br/>`；禁止用单个 Paragraph 拼接多个块级元素（blockquote 教训）。
- 验证：node 复刻生成 docx → unzip 检查 XML（见 /tmp/rmv-word-check/gen6-learn2.mjs 引用块/分隔线样例）。

## 四、图片高清原则（2026-08-18 定稿）

- **普通图片（raster）**：canvas 重编码 PNG 无损，canvas = 原图 naturalWidth×naturalHeight → **源像素 = 原图**，Word 放大不模糊。
- **mermaid 图表（SVG）**：矢量 → canvas 按 **2x 光栅化**（源像素 4 倍），显示尺寸仍按 viewBox 比例；Word 放大 2 倍依然清晰。
- **显示宽度上限**：A3 版心 1300px（1300px=34.4cm < 版心 36.6cm），只缩不放，不超宽。
- **不学 html-to-docx 的图片处理**：它按版心固定缩放、不保源分辨率，导致大图超出/模糊；我们保留原图高清 + 显示约束。
