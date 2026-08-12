/**
 * 版本号文件名生成器（编辑后另存为时使用）
 *
 * 规则（用户约定，2026-08-12）：
 *   1. 文件名（不含扩展名）匹配 v数字(.数字)*（如 v2.0.0 / v0.01 / v3）：
 *      → 取最后一段数字 +1（保留原数字位数）：
 *        README-v2.0.0.md → README-v2.0.1.md
 *        README-v0.01.md  → README-v0.02.md
 *        README-v2.md     → README-v3.md
 *   2. 不匹配任何版本号：
 *      → 追加 -v0.01：README.md → README-v0.01.md
 *
 * 边界约定：
 *   - 版本号必须带 v 前缀（README-2.0.0 不算版本号）
 *   - 版本号前后必须是文件边界或非字母数字字符（README-v2.0.0-final 中 v2.0.0 不算，
 *     因为后面紧跟字母；此时整体无版本号 → 追加 -v0.01）
 *   - 多个版本号只处理最后一个
 */
export function generateVersionedFilename(filename: string): string {
  // 拆分主名与扩展名（保留原扩展名，插件只处理 .md/.markdown）
  const dotIndex = filename.lastIndexOf('.')
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : ''

  // 匹配版本号：v 后跟数字段（可带 . 分隔），前后为边界或非字母数字
  const versionRegex = /(^|[^a-zA-Z0-9])v(\d+(?:\.\d+)*)(?=$|[^a-zA-Z0-9])/gi
  let match: RegExpExecArray | null
  let lastMatch: RegExpExecArray | null = null
  while ((match = versionRegex.exec(base)) !== null) {
    lastMatch = match
  }

  if (lastMatch) {
    const prefix = lastMatch[1] // 版本号前的分隔符（如 '-' 或 ''）
    const versionStr = lastMatch[2]
    const segments = versionStr.split('.')
    const lastSegment = segments[segments.length - 1]
    const nextSegment = String(Number(lastSegment) + 1).padStart(lastSegment.length, '0')
    segments[segments.length - 1] = nextSegment
    const newVersion = segments.join('.')
    // 'v' 字符位置（group1 分隔符之后；match 起点=分隔符位置，+prefix 长度即 'v' 位置）
    const vPos = lastMatch.index + prefix.length
    // 只替换版本号本身，保留版本号之后的任何文本（如 README-v1.0-final → README-v1.1-final）
    const versionEnd = vPos + 1 + versionStr.length
    return base.slice(0, vPos) + 'v' + newVersion + base.slice(versionEnd) + ext
  }

  return `${base}-v0.01${ext}`
}
