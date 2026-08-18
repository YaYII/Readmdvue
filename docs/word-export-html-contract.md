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
| li 内多段/换行 | `<li>文本<br>文本2<ul>..</ul></li>` 或带空行嵌套 `<li><p>第一章</p><ul>…` | convertList 剥离嵌套列表独立递归；li 内文本经 extractRuns + **suppressFirstBlockBreak**（li 内第一个块级 `<p>` 不插多余 break，符号与首段同行） | ✅ 2026-08-18 修 |
| 代码块 | `<pre><code class="language-xx">多行代码</code></pre>` | convertCodeBlock：每行拆 run+break、长行 70 字符空格处换行、灰底等宽 | ✅ |
| 引用块 | `<blockquote class="enhanced-blockquote"><p>..</p><ul>..</ul><pre>..</pre></blockquote>`（**内部是多个块级元素**） | blockquote case：**每块独立段落 + 引用样式（左蓝边/浅底/缩进）** | ✅ 2026-08-18 修复 |
| alert 引用 | `<blockquote class="alert note"><p class="alert-title">Note</p><p>..</p></blockquote>` | blockquote case：alert-title 加粗独立段落 | ✅ 2026-08-18 修复 |
| 表格 | `<table><thead><tr><th>..</th></tr></thead><tbody>..</tbody></table>` | table case：表头加粗浅底、内容 11pt、边框；表格后补空段落 | ✅ |
| 图片 | `<img src="data:…|http…|相对路径">` | imageToDocxImage：data URL 直解 / canvas 原分辨率重编码 / fetch；**保留原图分辨率** | ✅ |
| mermaid 图表 | `.chart-container` 内 `<svg viewBox=..>` + `.chart-fallback` 源码块 | svg case：renderChartLight 浅色重渲染 → svgToDocxImage **2x 高清光栅化** | ✅ 2026-08-18 高清 |
| 分隔线 | `<hr>` | hr case：下边框分隔线段落 | ✅ 2026-08-18 新增（此前丢失） |
| 行内 code | `<code>..</code>` | extractRuns：Consolas/等线 | ✅ |
| 行内加粗/斜体/链接 | `<strong>/<em>/<a>` | extractRuns：bold/italics/链接蓝色 | ✅（链接不可点，候选） |
| 删除线 | `<del>/<s>/<strike>`（gfm `~~text~~`） | extractRuns：strike run | ✅ 2026-08-18 补 |
| 任务列表 | `<li><input checked disabled type="checkbox">`（gfm `- [x]`） | extractRuns：input → `☑ `/`☐ ` 前缀 | ✅ 2026-08-18 补 |
| 数学公式（行内/块级） | `.math-inline`/`.math-block` → KaTeX `.katex` 布局 DOM | 导出前替换为 LaTeX 源码文本（`$..$`/`$$..$$`），Word 以源码呈现 | ✅ 2026-08-18 补 |
| 容器 div/section | `<div class="md-sub-indent">…</div>` 等 | div case：递归子节点 | ✅ |

### 组件映射全景（HTML 渲染组件 ↔ Word 组件）

| 页面渲染组件 | Word 对应组件 | 备注 |
|---|---|---|
| 标题 h1-h6 | 15/13/12pt 加粗黑体（h1 居中） | 公文规范 |
| 正文段落（含子缩进） | 12pt 仿宋 + 首行缩进 480twips + 行距 1.5 | |
| 加粗/斜体/删除线/行内 code | 对应 run 属性（bold/italics/strike/Consolas） | |
| 超链接 | 蓝色 run（可点候选） | file:// 可点性有限 |
| 任务列表 | `☑`/`☐` 前缀 + 文本 | checkbox 元素本身无文本 |
| 无序/有序列表（可嵌套） | `• `/`1. ` 前缀 + 层级缩进（递归） | 每 li 独立段落 |
| 代码块（hljs 高亮） | 灰底等宽代码段（每行 break + 长行 70 字符换行） | 高亮颜色不导出（公文规范） |
| 引用/alert 警告框 | 左蓝边+浅底引用段（内部每块独立段落） | alert-title 加粗 |
| 表格 | 11pt 表格 + 表头加粗浅底 + 边框 + 表格后空段落 | |
| 图片 | 原图高清 PNG（canvas 原分辨率，只缩不放） | 显示上限 A3 版心 1300px |
| mermaid/Kroki 图表 | 浅色主题 2x 高清 PNG | Word 白底适配 |
| 分隔线 hr | 下边框分隔线段落 | |
| 数学公式 | LaTeX 源码文本（`$..$`/`$$..$$`） | Word 不渲染 LaTeX |
| 分页符 | Word 分页符（PageBreak） | |
| div/section 容器 | 递归子节点 | |
| iframe/video/audio | 跳过（Word 不支持） | 合理缺省 |

## 二、换行审计清单（每类内容"一行"的界定）

1. **段落**：一个 `<p>` = 一个 Word 段落（首行缩进）。软换行已被 renderer.paragraph 拆成独立 `<p>`，不会丢。
2. **列表**：一个 `<li>` = 一个 Word 段落（`• `/`1. ` 前缀）。嵌套列表 = 更深的独立段落。li 内多行（br/\n）经 extractRuns 拆 break，不连成一行。
3. **代码块/目录树**：一行源码 = 一个 `<w:br/>` + run；长行 70 字符在空格处再拆；**空行保留为 break**（不丢行）。
4. **引用块**：blockquote 内每个块级子元素 = 一个 Word 段落（全部套引用样式）。**不再合并成单段**（2026-08-18 修复）。
5. **表格单元格**：convertInlineBlock 处理单元格内多段落/列表（每段独立 + 11pt）。
6. **直接文本节点**（div 直接子文本含 \n）：convertChildren 的 TEXT_NODE 分支拆 break（2026-08-18 已修）。
7. **嵌套列表 li 内 `<p>`**（带空行写法 `- 第一章\n\n  - 1.1`，marked 输出 `<li><p>第一章</p><ul>`）：extractRuns 对 li 内**第一个块级元素不插 break**（`• ` 与首段文本同行），后续块级元素才插 break 分隔——否则"• "孤立一行、文本错位（用户实测"多一个换行"，2026-08-18 修）。
8. **连续换行合并（空白行规则）**：任意连续换行（`<br><br>`、`\n\n`、`<br>\n` 组合）**只产生一个 break**——目录/列表/代码块不出现空白行。贯穿三处：extractRuns（lastWasBreak 状态）、convertChildren TEXT_NODE、convertCodeBlock；BLOCK_TAGS 插 break 前检查前一个 run 是否已是 break（2026-08-18 修）。

## 三、审计方法（防回归）

- 契约由代码固定，改动 markdownRenderer.ts 的 renderer 时**必须同步本表**。
- 转换器 htmlToDocx.ts 的每个 case 必须有契约对应项；新增 md 语法 → 先查 marked 输出结构，再补 case。
- 换行断点统一规则：**一个块级元素 = 一个 Word 段落**；块内多行 = run + `<w:br/>`；禁止用单个 Paragraph 拼接多个块级元素（blockquote 教训）。
- 验证：node 复刻生成 docx → unzip 检查 XML（见 /tmp/rmv-word-check/gen6-learn2.mjs 引用块/分隔线样例）。

## 四、图片高清原则（2026-08-18 定稿）

- **普通图片（raster）**：canvas 重编码 PNG 无损；canvas 最大边 **2600px（2×显示宽）**——2x 高清足够放大 2 倍清晰，同时避免超大 PNG 撑爆 docx。
- **mermaid 图表（SVG）**：矢量 → **先约束显示尺寸到版心，再按 2x 光栅化**（源像素 4 倍，最大边 ≤2600）；Word 放大 2 倍依然清晰。
- **显示宽度上限**：按导出时的纸张和方向动态计算版心；默认 A3 纵向约 863px，不能沿用 A3 横向的 1300px。
- **双保险**：ImageRun 构造点 clampDisplaySize 最终约束；任何路径漏约束都不会超版心。
- **不学 html-to-docx 的图片处理**：它按版心固定缩放、不保源分辨率，导致大图超出/模糊；我们保留原图高清 + 显示约束。

## 五、Word 页面方向与图片版心（2026-08-18）

政府 Word 文书固定使用 **A3 纵向**；PDF 的 `pageSize` 和 `orientation` 选项不参与 Word 页面生成。
Word 页面与图片/图表显示尺寸统一由同一套 A3 纵向版心计算。
默认 DOCX XML 应为 `<w:pgSz w:w="16838" w:h="23811" w:orient="portrait"/>`。

docx 库 `PageSize` 的 width/height 是**逻辑页面尺寸**，`orientation: LANDSCAPE` 时会**自动交换**。因此如果用户明确选择横向，仍要传纸张的逻辑纵向尺寸：
```ts
size: { width: 16838, height: 23811, orientation: PageOrientation.LANDSCAPE }
```
页面布局由 `resolveDocxPageLayout()` 统一解析。图片和图表先按实际版心宽高约束，再生成 `ImageRun`，避免纵向页面使用横向宽度导致图片超出右侧或被裁切。

## 六、图片丢失（后面的图不显示）两个根因与修复

1. **无超时的 `new Image()` / `fetch` 挂起**：异常 src 可能既不 onload 也不 onerror，`await` 永远
   pending → convertChildren 卡死，后面所有内容不生成。修复：`loadImageWithTimeout`（8s 超时）+ fetch
   AbortController（8s），4 处加载全部替换。
2. **超大 PNG 撑爆 docx**：drawLoadedImage 用原图尺寸（8000px+ 图 → 10MB+ PNG）、svgToDocxImage
   未约束 viewBox 直接 2x（4000px 流程图 → 8000px canvas），docx 文件暴涨 → Word 渐进加载后半图片
   不显示。修复：canvas 最大边 2600px（clampCanvasSize）；svg 先约束显示尺寸再 2x。
