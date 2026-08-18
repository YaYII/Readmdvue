# Readmdvue 项目熟悉与交接（2026-08-18）

## 1. 任务目标

本次先完成项目调研、基线核验和交接整理，随后补充 `enhanced-code-block` 独立组件改造及 Word 代码保真修复。目标是让后续开发者能够直接进入具体模块，不需要重新扫描整个仓库。

## 2. 当前基线

- 仓库：`/home/as-workstation01/Documents/project/Readmdvue`
- 分支：`main`，跟踪 `origin/main`
- 当前版本：`package.json` 与 `manifest.json` 均为 `2.1.14`
- 技术栈：Chrome Manifest V3、Vue 3、TypeScript、Vite、CRXJS、Pinia、CodeMirror 6、marked、highlight.js、KaTeX、Mermaid、docx
- 当前工作区不是干净状态，已有 5 个未提交文件：
  - `src/utils/docxDirectory.ts`
  - `src/utils/docxPure.ts`
  - `src/utils/htmlToDocx.ts`
  - `tests/docxDirectory.test.ts`
  - `tests/docxPure.test.ts`
- 本次没有重置、覆盖或提交上述在途改动。

## 3. 产品定位

Readmdvue 是一个浏览器 Markdown 工作台，主要处理 `.md` / `.markdown` 页面和本地 `file://` Markdown 文件，核心能力包括：

1. Markdown 阅读渲染。
2. CodeMirror 双屏编辑与实时预览。
3. Markdown 格式化和版本号另存。
4. 目录、设置、打赏、性能监控等注入式界面。
5. HTML、PDF、Markdown、PNG、JPEG、Word 导出。

离线边界需要准确描述：marked、highlight.js、KaTeX、Mermaid 已本地打包；非 Mermaid 图表仍依赖 Kroki，远程图片和在线 Markdown 源文件也需要网络。本地文件模式需要用户在扩展详情页开启“允许访问文件网址”。

## 4. 运行架构

```text
manifest.json
├── content script: src/content/main.ts
│   ├── MarkdownRenderer: marked + highlight.js + TOC/代码块处理
│   ├── KaTeX 公式渲染
│   ├── AsyncChartRenderer: 本地 Mermaid + Kroki 降级
│   ├── VueComponentManager: 动态挂载目录/设置/导出/编辑器
│   ├── CSSVariableManager: 主题、强调色、字号、行距
│   └── 消息监听: 与 popup/background 同步状态和配置
├── background service worker: src/background/main.ts
│   ├── 标签页状态
│   ├── 配置消息
│   ├── 保存文件/downloads API
│   └── 停止、禁用、清理扩展资源
└── popup: src/popup/main.ts + src/popup/App.vue
    ├── 当前页识别状态
    ├── 配置读写
    ├── 日志显示
    └── 停止/重载操作
```

`src/main.ts` + 根 `index.html` 是独立的 Vue/Vite 页面入口；正式扩展构建在 `vite.config.ts` 中明确使用 `src/content/main.ts`、`src/background/main.ts`、`src/popup/main.ts` 三个入口。处理扩展问题时不要误把根入口当成 popup 主入口。

## 5. 核心链路

### 5.1 Markdown 渲染

1. `src/content/main.ts` 判断当前页面是否为 Markdown，加载配置并提取原始内容。
2. `src/utils/markdownRenderer.ts` 使用 marked 生成 HTML，完成代码高亮、标题 ID、目录、表格/引用/列表增强。
3. content script 将结果写入 `.markdown-reader-content`，再渲染图表和数学公式。
4. `src/content/vueIntegration.ts` 在宿主页面动态挂载 Vue 组件。

### 5.2 编辑与保存

1. `src/components/MarkdownEditor.vue` 使用 CodeMirror 6 编辑 Markdown。
2. 预览继续使用 `MarkdownRenderer`，目标是与正式阅读使用同一渲染规则。
3. `src/utils/markdownNormalizer.ts` 负责格式化。
4. `src/utils/versionedFilename.ts` 生成新版本文件名。
5. background service worker 使用 `chrome.downloads` 保存文件，避免 MV3 service worker 不支持 `URL.createObjectURL` 的限制。

### 5.3 配置同步

- 配置模型和默认值：`src/types/index.ts`
- 配置管理：`src/utils/configManager.ts`
- popup 状态：`src/stores/plugin.ts`
- content script 会通过 runtime message、storage event、自定义事件和轮询同步配置。
- 渲染类配置更新后会防抖重渲染，并尝试恢复滚动位置。

### 5.4 图表与公式

- Mermaid：`src/utils/localMermaidRenderer.ts`，本地 UMD 全量包。
- 异步图表调度：`src/utils/asyncChartRenderer.ts`。
- Kroki：`src/utils/chartRenderers.ts`，用于 PlantUML、GraphViz 等非 Mermaid 图表。
- KaTeX：content script 静态导入 JS/CSS，字体由构建脚本处理，避免 `file://` 动态资源跨源问题。

### 5.5 导出与 Word

导出调用链：

```text
ExportDialog.vue
→ getCurrentPageContent()
→ DocumentExporter.exportDocument()
→ exportAsWord()
→ htmlToDocx()
→ docxDirectory.ts / docxPure.ts
```

`src/utils/exportUtils.ts` 负责多格式导出、样式收集、字体内嵌和下载；`src/utils/htmlToDocx.ts` 负责把当前渲染 DOM 转为政府公文风格 DOCX，包括段落、标题、列表、表格、图片、图表、公式和分页符。

## 6. 当前未提交改动的准确含义

当前在途修改是 Word 导出双回归修复及页面方向修复，不是本次调研新增：

1. 图片显示尺寸从“只限宽”扩展为“宽高都受实际纸张版心约束”，默认 A3 纵向，避免竖图或高图在 Word 中被裁掉下半部分。
2. `clampDisplaySize` 新增可选 `maxHeight`，不传时保持旧行为，属于兼容性扩展。
3. SVG 图表光栅化前先做宽高约束，避免超大 canvas 和超出版心高度。
4. 嵌套列表剥离子列表后，清理残留的纯空白文本节点，避免目录父项与子项之间多出空白行。
5. `extractRuns` 忽略纯空白文本节点。
6. 对应单元测试已经加入 `tests/docxDirectory.test.ts` 和 `tests/docxPure.test.ts`。

后续继续 Word 导出任务时，应保留这 5 个文件，不要 reset 或用旧分支覆盖。

## 7. 初始调研基线验证证据

以下是 enhanced-code-block 改造前、仅完成项目熟悉时的基线结果：

```bash
npm test
npm run type-check
git diff --check
```

结果：

- `npm test`：34 个 node:test 用例通过；版本号文件名 13/13 通过；Markdown 格式化 16/16 通过。
- `npm run type-check`：通过。
- `git diff --check`：通过。
- 初始阶段未执行真实 Chrome 扩展可视化回归，也未生成/打开 DOCX 做 LibreOffice 实证；最终实测证据见第 11 节。

## 8. 已发现的文档/显示漂移

以下内容与当前 `2.1.14` 基线不一致，本次只记录、不修改：

1. `README.md` 顶部仍标记 `v2.1.8`。
2. `src/popup/App.vue` 的版本徽章仍写死为 `2.0.0`。
3. `docs/product_manager_log.md` 仍写 `v2.0.0`。
4. `src/utils/exportUtils.ts` 的导出 HTML 注释仍写 `export-version: 2.1.4`。

如果下一任务是发版，应先确认哪些版本字段需要用户可见，再一次性统一，避免只改其中一处。

## 9. 风险与注意事项

1. content script 文件超过 3000 行，是当前主要编排中心；修改时优先局部替换，不做无关重构。
2. 配置同步存在 runtime、storage、自定义事件和轮询多条路径，调整配置逻辑必须防止写回循环和重复渲染。
3. Word 导出同时受浏览器 DOM、canvas、Mermaid、docx XML 和 LibreOffice/Word 渲染影响，只跑 TypeScript 测试不足以证明最终文件正确。
4. `file://` 是核心场景，任何动态 import、字体 URL、图片 fetch 改动都必须在真实本地文件页面验证。
5. Cerebrate 已完成代码结构 harvest，但尚无已确认的业务画像；当前 draft 仅按顶层模块生成，不能替代真实代码分析。

## 10. 后续任务入口

- Markdown 渲染/目录/代码块：`src/utils/markdownRenderer.ts`
- 页面接管/主题/交互/消息：`src/content/main.ts`
- 注入式 Vue 组件：`src/content/vueIntegration.ts`
- 双屏编辑：`src/components/MarkdownEditor.vue`
- 设置：`src/components/SettingsPanel.vue`
- 导出弹窗：`src/components/ExportDialog.vue`
- 多格式导出：`src/utils/exportUtils.ts`
- Word 转换：`src/utils/htmlToDocx.ts`
- Word 纯函数：`src/utils/docxPure.ts`
- Word 目录/列表：`src/utils/docxDirectory.ts`
- 图表：`src/utils/localMermaidRenderer.ts`、`src/utils/asyncChartRenderer.ts`、`src/utils/chartRenderers.ts`
- 配置默认值：`src/types/index.ts`
- 构建：`vite.config.ts`
- 打包：`./pack.sh`，输出 `releases/Readmdvue-v<version>.zip`；已有 `dist/` 时可用 `./pack.sh --skip-build` 快速压缩。`npm run pack` 与 `npm run pack:zip` 现在是这两个 Bash 命令的别名。

## 11. 2026-08-18 enhanced-code-block 改造与真实验证

### 11.1 页面代码块组件化

原实现由 `src/utils/markdownRenderer.ts` 在 `renderer.code` 中直接拼接完整 `.enhanced-code-block` HTML，之后由 content script 和编辑器预览通过 `innerHTML` 注入。这样会把交互按钮、代码布局和全局 `pre/code` 样式混在 Markdown 字符串中。

当前实现分为三层：

1. `src/utils/markdownRenderer.ts` 只负责 highlight.js 高亮，并输出不可见的 `data-enhanced-code-block-host` 占位符。
2. `src/components/EnhancedCodeBlock.vue` 独立构建代码块 DOM，负责代码文本、复制按钮、复制反馈和横向滚动边界。
3. `src/utils/enhancedCodeBlockMount.ts` 使用 `createApp()` 挂载占位符，并在正式阅读重渲染、编辑器预览刷新、旧容器删除和插件停止时卸载，避免重复 Vue app 泄漏。

`src/utils/enhancedCodeBlockMarkup.ts` 负责语言规范化、属性转义和 inert template 占位符。复制使用原始代码文本，不读取高亮后的 HTML；组件把 `overflow-x: auto` 固定在 `.code-content`，`pre` 使用可见溢出，`code` 使用 `white-space: pre` 和 `min-width: max-content`。

### 11.2 Word 导出代码保真

真实导出反馈确认 Word 中代码内容被处理不正确。根因是 `src/utils/htmlToDocx.ts` 的 `convertCodeBlock()` 对所有代码块调用 `processDirectoryLines()`，该函数会压缩连续空格、删除空行并按 70 字符主动换行。

当前改为 `preserveCodeLines()`：统一 CRLF、逐行保留原始文本、缩进、连续空格、空行和末尾换行；目录整理函数仍保留给目录专用逻辑，不再污染普通代码块。

### 11.3 验证证据

- `npm test`：39 项全部通过。
- `npm run type-check`：通过。
- `npm run build`：通过；仅保留已有字体路径、动态/静态 import 重叠、CSS 同名覆盖和大 bundle 警告。
- `git diff --check`：通过。
- 真实 Chrome 扩展：加载 `/home/as-workstation01/Documents/project/Readmdvue/dist` 后打开 `/tmp/readmdvue-enhanced-code-block-test.md`，得到 `hostCount=2`、`blockCount=2`，两段代码 `textContent` 与原文逐字匹配。
- 真实布局：两段代码的 `.code-content` 是唯一横向滚动层，`pre` 为 `overflow: visible`，`code` 为 `display: block; white-space: pre; min-width: max-content`；hover 后复制按钮 `opacity=1`，点击后标题变为“已复制”，控制台无错误。
- 双屏编辑器：点击真实页面“编辑文档”后，`.editor-preview` 内得到 `previewHostCount=2`、`previewBlockCount=2`；两段原文逐字一致，滚动边界和 hover 复制按钮与正式阅读一致，控制台无错误。
- 真实 Word：导出 `/tmp/readmdvue-word-downloads/readmdvue-code-block-verification.docx`，文件 10,407 bytes；解包 `word/document.xml` 后确认调用链和目录树全部存在，`├──`、`│   ├──`、`└──` 字符及缩进均保留，两个代码段落均含 `<w:jc w:val="left"/>`，不会继承两端对齐造成逐字拉伸。
- 按用户要求，不启动 `drive-browser` 或浏览器扩展测试脚本；当前环境无法可靠安装和验收扩展，扩展行为由用户在真实浏览器中人工确认。

### 11.4 关键文件与命令

- 页面组件：`src/components/EnhancedCodeBlock.vue`
- 挂载生命周期：`src/utils/enhancedCodeBlockMount.ts`
- 占位符：`src/utils/enhancedCodeBlockMarkup.ts`
- Markdown 入口：`src/utils/markdownRenderer.ts`
- 正式阅读接入：`src/content/main.ts`
- 编辑器预览接入：`src/components/MarkdownEditor.vue`
- Word 代码转换：`src/utils/htmlToDocx.ts`、`src/utils/docxDirectory.ts`
- 组件测试：`tests/enhancedCodeBlockMarkup.test.ts`
- Word 行处理测试：`tests/docxDirectory.test.ts`

### 11.5 页面方向修复（2026-08-18）

- 根因：`src/utils/htmlToDocx.ts` 曾把页面硬编码为 A3 横向，导致政府文书导出为横向，图片也按 1300px 横向版心生成。
- 修复：`src/utils/docxPure.ts` 新增 `resolveDocxPageLayout()`；默认 A3 纵向，并将页面大小、方向和图片版心统一参数化。
- 调用链：`ExportDialog.vue` 的页面设置仅对 PDF 生效；`exportUtils.ts` 在 Word 链路固定传入 `pageSize: 'A3'`、`orientation: 'portrait'`。
- 预期默认 XML：`<w:pgSz w:w="16838" w:h="23811" w:orient="portrait"/>`；默认图片最大宽度约 863px，按 A3 纵向版心计算。
- 验证：`npm test` 44 项通过；`npm run type-check` 通过；字体映射改为 `Calibri`（代码块仍为 `Consolas`，且同步设置 `ascii/hAnsi`）。不启动浏览器测试脚本。

## 12. 建议的下一步验证

如果后续继续处理当前 Word 导出改动，建议按以下顺序：

1. 保留当前工作区差异，先准备“超高竖图 + 高 Mermaid 图 + 空行嵌套目录”最小 Markdown 样例。
2. 在真实扩展中导出 DOCX。
3. 用 LibreOffice 或 Microsoft Word 检查图片是否完整、目录父子交界是否仍有空白行。
4. 再运行 `npm test`、`npm run type-check` 和 `npm run pack`。
5. 版本字段统一后再提交和发布。
