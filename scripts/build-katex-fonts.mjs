/**
 * 构建时生成 KaTeX 字体 base64 常量（src/utils/katexFontsData.ts）
 * 导出 HTML 时硬编码进 @font-face，保证公式字体自包含（不依赖运行时 fetch）
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fontsDir = join(process.cwd(), 'node_modules', 'katex', 'dist', 'fonts')
const outFile = join(process.cwd(), 'src', 'utils', 'katexFontsData.ts')

// 从文件名解析 font-family / font-weight / font-style
// 文件名格式: KaTeX_<Family>-<Style>.woff2
function parseFontName(name) {
  const m = name.match(/^(KaTeX_[A-Za-z0-9]+)-([A-Za-z]+)\.woff2$/)
  if (!m) return null
  const family = m[1]
  const styleName = m[2]
  let weight = 'normal'
  let style = 'normal'
  if (styleName.includes('Bold') && styleName.includes('Italic')) {
    weight = 'bold'; style = 'italic'
  } else if (styleName.includes('Bold')) {
    weight = 'bold'
  } else if (styleName.includes('Italic')) {
    style = 'italic'
  } else if (styleName !== 'Regular') {
    return null // 其他样式跳过
  }
  return { family, weight, style }
}

const files = readdirSync(fontsDir)
  .filter((f) => f.endsWith('.woff2'))
  .sort()

const faces = []
for (const file of files) {
  const parsed = parseFontName(file)
  if (!parsed) {
    console.log(`[katex-fonts] 跳过无法解析的字体: ${file}`)
    continue
  }
  const buf = readFileSync(join(fontsDir, file))
  const b64 = buf.toString('base64')
  faces.push({
    family: parsed.family,
    weight: parsed.weight,
    style: parsed.style,
    data: `url(data:font/woff2;base64,${b64}) format("woff2")`,
    size: buf.length,
  })
}

const css = faces
  .map(
    (f) =>
      `@font-face { font-family: "${f.family}"; src: ${f.data}; font-weight: ${f.weight}; font-style: ${f.style}; }`
  )
  .join('\n')

const ts = `/**
 * 自动生成：scripts/build-katex-fonts.mjs（npm run build 前置执行）
 * KaTeX 字体 base64 硬编码（自包含），导出 HTML 时追加到 <head>，
 * 保证公式字体在任何环境都能显示，不依赖外部字体文件/运行时 fetch。
 * 共 ${faces.length} 个 woff2 字体，base64 总大小 ${(faces.reduce((s, f) => s + f.data.length, 0) / 1024).toFixed(0)} KB。
 */
export const KATEX_FONTS_CSS = \`${css}\`
`

writeFileSync(outFile, ts, 'utf8')
console.log(`[katex-fonts] 已生成 ${outFile}（${faces.length} 个字体，base64 ${(faces.reduce((s, f) => s + f.data.length, 0) / 1024).toFixed(0)} KB）`)
