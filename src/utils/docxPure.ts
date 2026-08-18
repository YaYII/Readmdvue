/**
 * HTML → DOCX 转换的纯函数模块（无 DOM / docx 依赖，可被 node:test 单元测试）。
 * 从 htmlToDocx.ts 抽离，保证换行/尺寸等核心逻辑有真实测试覆盖。
 */

/** docx 支持的图片类型（与 ImageRun type 对齐） */
export type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp'

export const DOCX_LATIN_FONT = 'Calibri'
export const DOCX_CODE_FONT = 'Consolas'

export type DocxPageOrientation = 'portrait' | 'landscape'

export interface DocxPageLayout {
  pageWidth: number
  pageHeight: number
  orientation: DocxPageOrientation
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
  maxImageWidthPx: number
  maxImageHeightPx: number
  maxImageSidePx: number
}

const DOCX_PAGE_MARGINS = {
  top: 2098,
  right: 1474,
  bottom: 1984,
  left: 1587,
} as const

const DOCX_PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 11906, height: 16838 },
  A3: { width: 16838, height: 23811 },
  Letter: { width: 12240, height: 15840 },
  Legal: { width: 12240, height: 20160 },
}

/**
 * 根据导出选项解析 Word 页面布局。
 * width/height 保持纸张的逻辑纵向尺寸，docx 库在 landscape 时负责交换 XML 宽高。
 * 图片显示尺寸按实际物理版心计算，不能复用固定的横向宽度。
 */
export function resolveDocxPageLayout(
  pageSize = 'A3',
  orientation: DocxPageOrientation = 'portrait',
): DocxPageLayout {
  const paper = DOCX_PAGE_SIZES[pageSize] || DOCX_PAGE_SIZES.A3
  const pageOrientation: DocxPageOrientation = orientation === 'landscape' ? 'landscape' : 'portrait'
  const physicalWidth = pageOrientation === 'landscape' ? paper.height : paper.width
  const physicalHeight = pageOrientation === 'landscape' ? paper.width : paper.height
  const contentWidthTwips = Math.max(1, physicalWidth - DOCX_PAGE_MARGINS.left - DOCX_PAGE_MARGINS.right)
  const contentHeightTwips = Math.max(1, physicalHeight - DOCX_PAGE_MARGINS.top - DOCX_PAGE_MARGINS.bottom)
  const twipsPerPixel = 15 // 96dpi: 1440 twips / 96px
  const maxImageWidthPx = Math.max(1, Math.floor((contentWidthTwips / twipsPerPixel) * 0.94))
  const maxImageHeightPx = Math.max(1, Math.round((contentHeightTwips / twipsPerPixel) * 0.976))

  return {
    pageWidth: paper.width,
    pageHeight: paper.height,
    orientation: pageOrientation,
    margin: { ...DOCX_PAGE_MARGINS },
    maxImageWidthPx,
    maxImageHeightPx,
    maxImageSidePx: Math.max(maxImageWidthPx, maxImageHeightPx) * 2,
  }
}

/** data URL / mime 格式 → docx 图片类型 */
export function mimeToDocxType(mime: string | undefined): DocxImageType {
  const m = (mime || '').toLowerCase()
  if (m === 'jpeg' || m === 'jpg') return 'jpg'
  if (m === 'gif') return 'gif'
  if (m === 'bmp') return 'bmp'
  return 'png' // png / webp（webp 会被 canvas 重编码为 png）/ 未知
}

/** 长行在空格处换行（主动拆分，避免代码块/目录树单行过长；不硬断单词） */
export function wrapLongLine(line: string, max: number): string[] {
  if (line.length <= max) return [line]
  const parts: string[] = []
  let rest = line
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max)
    if (cut <= 0) cut = Math.min(max, rest.length) // 无空格长串：不得已才在 max 处截断
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut).replace(/^ +/, '')
  }
  if (rest) parts.push(rest)
  return parts
}

/** 图片/画布 base64 → 字节（data URL 解析） */
export function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  try {
    const m = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/)
    if (!m) return null
    const binary = atob(m[1])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** canvas 重编码时限制最大边长（等比）：原图过大会产生 10MB+ PNG，docx 文件暴涨 */
export function clampCanvasSize(w: number, h: number, maxSide: number): { width: number; height: number } {
  if (Math.max(w, h) <= maxSide) return { width: w, height: h }
  const s = maxSide / Math.max(w, h)
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) }
}

/** 显示尺寸最终约束（双保险：任何转换路径漏约束，ImageRun 都不超过版心）——
 * 只限宽会在竖图/竖向图表时高度超版心：Word 裁掉下半张图（"图片生成一半"），
 * 因此宽、高都要约束（调用方按实际纸张版心传 maxHeight）。 */
export function clampDisplaySize(
  w: number,
  h: number,
  maxWidth: number,
  maxHeight = 0,
): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 400, height: 300 }
  let width = w
  let height = h
  if (width > maxWidth) {
    const s = maxWidth / width
    width = maxWidth
    height = Math.max(1, Math.round(height * s))
  }
  if (maxHeight > 0 && height > maxHeight) {
    const s = maxHeight / height
    height = maxHeight
    width = Math.max(1, Math.round(width * s))
  }
  return { width: Math.round(width), height: Math.round(height) }
}

/** 连续换行合并状态（贯穿整个 walk，跨多个子节点共享） */
export interface BreakMergeState {
  lastWasBreak: boolean
}

/**
 * 文本 → runs（含连续换行合并）：任意连续换行（\n\n 等）只产生一个 break——
 * 目录/列表不能有空行。docx TextRun 不渲染 \n，必须拆成多个 run + break。
 * state 由调用方持有并跨节点共享（前一个子节点输出的 break 也参与合并）。
 */
export function textToRuns<T>(
  text: string,
  makeTextRun: (line: string) => T,
  makeBreakRun: () => T,
  state: BreakMergeState,
): T[] {
  const runs: T[] = []
  text.split('\n').forEach((line, i) => {
    if (i > 0) {
      if (!state.lastWasBreak) runs.push(makeBreakRun())
      state.lastWasBreak = true
    }
    if (line) {
      runs.push(makeTextRun(line))
      state.lastWasBreak = false
    }
  })
  return runs
}
