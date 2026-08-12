/**
 * Markdown 书写规范化器（配合 Prettier 使用）
 *
 * 解决「用户手写 MD 符号间隔不规范」问题（Prettier 对这些错误写法会原样保留）：
 *   1. 标题：#标题 → # 标题（# 后补空格）
 *   2. 无序列表：-项目 / *项目 → - 项目 / * 项目（符号后补空格；排除 --- 分隔线）
 *   3. 有序列表：1.第一项 → 1. 第一项（排除 1.2 版本号误伤）
 *   4. 引用：>引用 → > 引用（含嵌套 >>）
 *   5. 行尾空白去除
 *   6. 连续空行压缩（≥2 空行 → 1 空行）
 *
 * 安全边界：代码块（``` 包裹）内一律不动；行内代码边界情况接受（低风险）
 */
export function normalizeMarkdown(source: string): string {
  const lines = source.split(/\r?\n/)
  const out: string[] = []
  let inCodeBlock = false

  for (const raw of lines) {
    // 1) 行尾空白去除
    let line = raw.replace(/[ \t]+$/, '')

    // 2) 代码块 fence 切换（``` 开/闭）
    if (/^\s*(```+|~~~+)/.test(line)) {
      inCodeBlock = !inCodeBlock
      out.push(line)
      continue
    }

    if (!inCodeBlock) {
      // 3) 标题：#标题 → # 标题（# 后必须是文本才补空格）
      line = line.replace(/^(#{1,6})(?![#\s])/, '$1 ')

      // 4) 无序列表：-项目 → - 项目（排除 ---、--、- 单独行；符号后非空白/非符号才补）
      line = line.replace(/^(\s*)([-*+])(?![\s-*+])/, '$1$2 ')

      // 5) 有序列表：1.第一项 → 1. 第一项（排除 1.2 版本号：点后为数字时不处理）
      line = line.replace(/^(\s*)(\d+)(\.)(?![\s\d])/, '$1$2$3 ')

      // 6) 引用：>引用 → > 引用（含 >> 嵌套；> 后非空白才补）
      line = line.replace(/^(\s*)(>+)(?!\s)/, '$1$2 ')
    }

    out.push(line)
  }

  // 7) 连续空行压缩（≥2 空行 → 1 空行）
  const text = out.join('\n')
  return text.replace(/\n{3,}/g, '\n\n')
}
