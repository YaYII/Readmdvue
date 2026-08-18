# Word 导出页面方向修复（2026-08-18）

## 目标

政府交付文书应默认使用 A3 纵向页面。此前 Word 导出结果为横向，且图片/图表仍按横向版心宽度生成，导致纵向内容比例和图片宽度不符合公文使用场景。

## 根因

`src/utils/htmlToDocx.ts` 的 `Document.sections[0].properties.page.size` 曾硬编码为 A3 横向：

```ts
size: { width: 16838, height: 23811, orientation: PageOrientation.LANDSCAPE }
```

同时，图片和图表使用固定的横向宽度上限 `1300px`，没有读取导出选项中的 `pageSize/orientation`。

## 修复

- `src/utils/docxPure.ts` 新增 `resolveDocxPageLayout()`，统一解析 A4/A3/Letter/Legal 和纵向/横向。
- Word 默认使用 A3 纵向：逻辑尺寸 `16838 × 23811`，方向 `portrait`。
- `src/utils/exportUtils.ts` 固定传入 `pageSize: 'A3'` 和 `orientation: 'portrait'`，避免 PDF 选项改变政府 Word 文书页面。
- `src/components/ExportDialog.vue` 的页面设置仅适用于 PDF；Word 始终按 A3 纵向导出。
- 普通图片、SVG/Mermaid 图表和最终 `ImageRun` 均按实际版心动态计算宽高；默认 A3 纵向最大图片宽度约 `863px`，高度约 `1284px`。
- 英文和数字统一使用 `Calibri`，代码块继续使用 `Consolas` 等宽字体；避免 `Times New Roman` 在 Linux/LibreOffice 中被替换为 `Liberation Serif` 后观感不一致。
- 保留 `clampDisplaySize()` 的兼容行为：未传高度时仍只限制宽度，Word 图片路径传入实际版心高度。

## 验证证据

- `npm test`：44 项通过。
- `npm run type-check`：通过。
- `npm run build`：通过，`dist` 已更新。
- `git diff --check`：通过。
- 使用真实 `docx@9.7.1` 生成最小 DOCX 并解包 XML，确认：
  - `<w:pgSz w:w="16838" w:h="23811" w:orient="portrait"/>`
  - 页边距仍为 `top=2098/right=1474/bottom=1984/left=1587`
  - 默认图片布局计算为 `maxImageWidthPx=863`、`maxImageHeightPx=1284`

## 浏览器状态

按用户要求，不启动 `drive-browser` 或浏览器扩展测试脚本；该环境无法可靠安装和验收扩展。后续以源码、单元测试、构建结果和 DOCX XML 为验证依据。

## 后续建议

安装扩展后，用真实政府文书 Markdown 导出一次 Word，检查 Word 页面设置显示为 A3 纵向，并确认图片/表格/代码块没有超出左右页边界。
