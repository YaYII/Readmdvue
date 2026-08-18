# Word 导出代码块字距异常修复（2026-08-18）

## 目标

修复 Word/WPS 导出后代码块和项目架构树出现逐字拉伸的问题。典型表现是英文、路径和中文字符被均匀分散到整行宽度，只有代码块最后一行保持正常间距。

## 根因

`src/utils/htmlToDocx.ts` 的 `convertCodeBlock` 将多行代码放在同一个 Word 段落中，并用 `TextRun({ break: 1 })` 插入手动换行。代码段落原先没有明确的 `alignment`，在中文 Word/WPS 默认段落样式下会继承两端或分散对齐，手动换行行因此被逐字拉伸。

## 修复

仅在代码块段落上增加 `alignment: AlignmentType.LEFT`，保留现有字体、字号、灰底、换行和代码内容处理。正文段落继续使用政府公文要求的两端对齐，不改变其他导出组件。

## 验证

- `npm test`：39 个测试全部通过。
- `npm run type-check`：通过。
- `npm run build`：生产构建通过。
- 用 `docx` 生成最小代码段落并解压 XML，确认包含 `<w:jc w:val="left"/>`。
- `git diff --check`：通过。

## 遗留与限制

本机默认可见浏览器未预装 Readmdvue 扩展，系统 Chrome 不接受命令行加载未安装扩展；Playwright 自带 Chromium 未安装，因此没有完成真实扩展 UI 导出和 Word GUI 回归。生产构建和 DOCX XML 结构已验证，后续在 Chrome 扩展详情页启用“允许访问文件网址”后，可用真实 Markdown 文件再做一次人工 Word/WPS 视觉确认。

## 关键文件和命令

- 修复入口：[src/utils/htmlToDocx.ts](/home/as-workstation01/Documents/project/Readmdvue/src/utils/htmlToDocx.ts)
- 相关代码行处理：[src/utils/docxDirectory.ts](/home/as-workstation01/Documents/project/Readmdvue/src/utils/docxDirectory.ts)
- 测试：`npm test`
- 类型检查：`npm run type-check`
- 构建：`npm run build`
