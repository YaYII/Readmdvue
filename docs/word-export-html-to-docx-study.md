# Readmdvue Word 导出——html-to-docx 开源库业务逻辑学习报告与落地

> 日期：2026-08-18　分支：main（8d58676）　打包：releases/Readmdvue-v2.1.5.zip
> 原则：**学习业务逻辑，不照抄代码**——把开源库"怎么解决问题"的思路用我们自己的实现落地。

## 一、研究范围

开源库：`html-to-docx@1.8.0`（GitHub privateOmega/html-to-docx，MIT，HTML → DOCX 最流行方案）。
源码：`src/helpers/render-document-file.js`（块级分发）、`src/helpers/xml-builder.js`（段落/run/表格构建）、`src/utils/list.js`、`src/utils/unit-conversion.js`。

## 二、开源库核心业务逻辑（学习要点）

1. **HTML → VDOM 后再统一遍历**：先用 html-to-vdom 把 HTML 字符串解析成虚拟 DOM 树，再做块级/内联两层处理。
2. **块级分发（findXMLEquivalent）**：
   - 标题 h1-h6 → 段落（引用 Heading 样式）
   - p/blockquote/code/pre 等 → 段落构建
   - table → 表格 + **表格后自动补空段落**（`buildParagraph(null)`）
   - ol/ul → 列表构建（**Word 原生 numbering**：`<w:numPr>` + numbering.xml，不手写 "1." 前缀）
   - img → 图片（下载→写 media→`sizeOf` 读真实尺寸→**按版心宽度 availableDocumentSpace 约束缩放**）
   - br → 空段落（**段落外的 br**）；div.page-break → `<w:br type="page"/>` 分页符
   - head → 忽略；其他容器（div 等）→ **递归子节点**
3. **run 拆分（buildRun）**：段落内 strong/em/b/i/u/sub/sup/code 等 → 拆成多个 `<w:r>`，每个 run 独立 rPr；**段落内 br → `<w:br/>` 只换行不产生空行**。
4. **样式映射**：CSS inline style → docx 属性（color/背景/text-align/font-weight/font-family/font-size/line-height/margin/display/width）；line-height 数字 × 240 TWIP（默认行距）；blockquote → left indent 284 + justify。
5. **列表（buildList）**：队列 + level 遍历；每个 ul/ol 独立 numberingId；li 内容包成 p；嵌套 level+1；支持 `data-start`、list-style-type（decimal/upper-roman/lower-alpha 等）。
6. **图片（computeImageDimensions）**：真实尺寸 + 按版心宽度等比缩放（超宽才缩）。
7. **表格**：rowCantSplit（行不跨页）+ 表格后空段落 + 边框解析（cssBorderParser）+ colSpan/rowSpan。
8. **超链接**：a → `<w:hyperlink r:id>` + Hyperlink 样式（真可点击）。
9. **单位换算**：px/pt/cm/in ↔ HIP（half-point，docx 字号单位）/TWIP/EMU 全套工具函数。

## 三、与当前实现差距分析

| 业务逻辑 | html-to-docx | 我们（学习前） | 结论 |
|---|---|---|---|
| 块级递归分发 | 容器递归 | convertChildren 递归 | 一致 |
| 段落内 inline → run 拆分 | buildRun | extractRuns | 一致（我们更细：\n 也拆 break）|
| 段落内 br → w:br | `<w:br/>` | break:1 | 一致（我们还合并了 br+\n 双 break）|
| 列表嵌套独立段落 | 队列+level | convertList 递归 | 思路一致 |
| 图片按版心宽度 | availableDocumentSpace | **固定 600/620px** | ✅ 本次改 1300px |
| 表格后补空段落 | ✅ | **无** | ✅ 本次加 |
| 分页符 page-break | ✅ | **无** | ✅ 本次加 |
| 超链接真链接 | ✅ w:hyperlink | 仅蓝色文字 | ⏸ 候选（暂缓，理由见下）|
| 列表 Word 原生 numbering | ✅ | 手写前缀+indent | ⏸ 候选（暂缓，理由见下）|
| blockquote 缩进 | left 284+justify | left 360+左边框+底色 | 我们更丰富 |
| 行距/字号换算 | 工具函数 | 固定公文规范字号 | 我们用规范，更符合公文 |

## 四、本次落地（commit 8d58676，v2.1.5）

1. **图片/图表宽高约束改为跟随纸张和方向**
   - 默认 A3 纵向版心宽约 863px、高约 1284px；A3 横向等特殊选项会根据实际物理版心重新计算。
   - data URL、普通图片、SVG 图表和最终 `ImageRun` 统一使用 `resolveDocxPageLayout()` 的动态尺寸。
2. **表格后补单倍行距空段落**：避免表格与紧随段落文字粘连贴边框（学 html-to-docx buildTable 后 buildParagraph(null)）。
3. **分页符支持**：`div.page-break` / `style="page-break-after:always|page"` → Word 分页符（`PageBreak`），放 div/section/article/main 容器分支最前。

## 五、暂缓项与理由（最小修改原则）

- **真超链接（ExternalHyperlink）**：docx 9.7.1 支持，但需改 extractRuns 返回类型（TextRun[] → ParagraphChild[]），波及全部调用点，回归风险中等；且 file:// 本地相对链接在 Word 中点击意义有限。**收益（可点性）不涉及美观，暂缓**。
- **Word 原生 numbering**：当前手写前缀 + 缩进已满足公文美观（用户已确认目录/列表换行修复）；改真 numbering 需引入 numbering.xml 配置（docx numbering config + LevelFormat），改动面大。**暂缓**，若后续要求"列表在 Word 中是真列表（可续号）"再实施。

## 六、验证

- `npx vue-tsc --noEmit` 通过。
- node 复刻（/tmp/rmv-word-check/gen5-learn.mjs）生成 docx 检查 XML：图片 cx=12382500EMU=1300px ✓；`</w:tbl><w:p>` 表格后空段落 ✓；`w:type="page"` 分页符 ✓。
- 字号硬规则回归：全部 ≤30 HIP（15pt）——表格 22/正文 24/小标题 26/页脚 28/标题 30 ✓。
- 扩展自动化导出不做（用户已明确"不要测试了"）。

## 七、关键文件与命令

- 转换器：`src/utils/htmlToDocx.ts`（全部 Word 转换逻辑）
- 导出入口：`src/utils/exportUtils.ts` → `getCurrentPageContent()`（取页面 innerHTML）
- 渲染链：`markdownRenderer.ts`（marked → `.markdown-reader-content`）
- 打包：`npm run pack`（build+zip）/ `npm run pack:zip`（仅压缩）→ `releases/Readmdvue-v<version>.zip`
- 版本：package.json 与根 manifest.json 需同步（build-zip.mjs 从 dist/manifest.json 取版本号）
- 复刻验证：`/tmp/rmv-word-check/gen5-learn.mjs`
