# Word 英文与数字字体修复（2026-08-18）

## 根因

Word 转换器原先把英文和数字指定为 `Times New Roman`。当前 Linux 环境的字体匹配证据显示：

```text
Times New Roman -> Liberation Serif
Calibri         -> Carlito
```

因此生成文件在当前环境中实际使用的是 Liberation Serif，字形观感与标准 Office 英文字体不一致。

## 修复

- 正文、标题、页码的英文字母和数字统一指定为 `Calibri`。
- 代码块和行内代码继续使用 `Consolas` + 中文等宽字体 `等线`，并同时设置 `ascii/hAnsi`，避免数字或符号回退到正文英文字体。
- 将字体名抽取为 `DOCX_LATIN_FONT` 与 `DOCX_CODE_FONT` 常量，避免不同转换分支漂移。

## 验证

- `npm test`：字体契约测试和全部既有测试通过。
- `npm run type-check`：通过。
- `npm run build`：通过。
- 不启动浏览器测试脚本；用户明确指出该环境无法可靠安装扩展，后续不以浏览器自动化作为扩展验收依据。
