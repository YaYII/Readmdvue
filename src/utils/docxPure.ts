/**
 * HTML → DOCX 转换的纯函数模块（无 DOM / docx 依赖，可被 node:test 单元测试）。
 * 从 htmlToDocx.ts 抽离，保证换行/尺寸等核心逻辑有真实测试覆盖。
 */

/** docx 支持的图片类型（与 ImageRun type 对齐） */
export type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp'

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

/** 显示尺寸最终约束（双保险：任何转换路径漏约束，ImageRun 都不超过版心宽度） */
export function clampDisplaySize(w: number, h: number, maxWidth: number): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 400, height: 300 }
  if (w <= maxWidth) {
    return { width: Math.round(w), height: Math.round(h) }
  }
  const s = maxWidth / w
  return { width: maxWidth, height: Math.max(1, Math.round(h * s)) }
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
