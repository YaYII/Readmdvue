/**
 * HTML → DOCX 转换器
 * 把渲染后的 Markdown HTML（标题/段落/列表/表格/代码块/引用/图片/mermaid SVG）
 * 转换为标准 Word .docx（docx 库，浏览器纯 JS 生成）。
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  BorderStyle,
  WidthType,
  ShadingType,
  AlignmentType,
  LineRuleType,
  Footer,
  PageNumber,
  PageBreak,
  PageOrientation,
} from 'docx'
import mermaid from 'mermaid/dist/mermaid.min.js'

/**
 * 图片/图表最大宽度（px）：按 A3 横向版心宽度计算，学习 html-to-docx 业务逻辑
 * （computeImageDimensions 以 availableDocumentSpace=版心宽度约束图片，而非固定小宽度）。
 * 版心宽 = A3 横向页宽 23811twips − 左边距 1587 − 右边距 1474 = 20750twips
 *       = 1037.5pt ≈ 1383px（96dpi）；留 5% 余量 → 1300px。
 * 此前固定 600px 在 A3 大纸下明显偏小，大图/图表被压缩得看不清。
 */
const MAX_IMAGE_WIDTH_PX = 1300

/** 图片/图表数据源最大边长（px）：canvas 重编码时限制，避免超大 PNG 撑爆 docx 文件
 * （Word 对超大 docx 会渐进加载，后面图片可能不显示）。2×显示宽度 = 放大 2 倍依然清晰。 */
const MAX_IMAGE_SIDE_PX = MAX_IMAGE_WIDTH_PX * 2

/** docx 支持的图片类型（与 ImageRun type 对齐） */
type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp'

/** docx 图片结果（数据 + 尺寸 + 类型） */
interface DocxImageResult {
  data: Uint8Array
  width: number
  height: number
  type: DocxImageType
}

/** data URL / mime 格式 → docx 图片类型 */
function mimeToDocxType(mime: string | undefined): DocxImageType {
  const m = (mime || '').toLowerCase()
  if (m === 'jpeg' || m === 'jpg') return 'jpg'
  if (m === 'gif') return 'gif'
  if (m === 'bmp') return 'bmp'
  return 'png' // png / webp（webp 会被 canvas 重编码为 png）/ 未知
}

/** 长行在空格处换行（主动拆分，避免代码块/目录树单行过长；不硬断单词） */
function wrapLongLine(line: string, max: number): string[] {
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

/** 图片转换过程日志（控制台可观测：用户通过日志判断图片是否插入成功） */
let docxImgSeq = 0
function logImage(msg: string, ...rest: unknown[]): void {
  console.log(`[docx-image][${docxImgSeq}] ${msg}`, ...rest)
}
function warnImage(msg: string, ...rest: unknown[]): void {
  console.warn(`[docx-image][${docxImgSeq}] ${msg}`, ...rest)
}

/** 提取块内 inline 内容为 TextRun（strong/em/code/a/br/普通文本）；overrides 可统一覆盖样式 */
interface RunOverrides {
  bold?: boolean
  italics?: boolean
  size?: number
  color?: string
  font?: string | { ascii: string; eastAsia: string; hAnsi?: string }
}
interface ExtractRunsOptions {
  /** li 列表项内：第一个块级元素（如 <p>）不插 break，避免「• 符号」与首段文本被拆到两行
   * （渲染契约：带空行的嵌套列表 marked 输出 <li><p>第一章</p><ul>…，li 直接内容被包成 <p>）；
   * 后续块级元素仍插 break 分隔。 */
  suppressFirstBlockBreak?: boolean
}
function extractRuns(el: HTMLElement, overrides: RunOverrides = {}, options: ExtractRunsOptions = {}): TextRun[] {
  const runs: TextRun[] = []
  let blockSeen = false
  const apply = (opts: {
    text?: string
    bold?: boolean
    italics?: boolean
    strike?: boolean
    size?: number
    color?: string
    font?: string | { ascii: string; eastAsia: string; hAnsi?: string }
  }): Record<string, unknown> => ({ ...opts, ...overrides })
  // 连续换行合并（目录/列表不能有空行）：任意连续换行（<br><br>、\n\n、<br>\n 组合）
  // 只产生一个 break——否则 Word 出现空白行。lastWasBreak 贯穿整个 walk：
  // 一旦输出过 break，下一个 break 合并；输出文本后重置。
  let lastWasBreak = false
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || ''
        if (text) {
          // docx TextRun 的 \n 不渲染换行：必须拆成多个 run + break:1（否则多行文本挤成一行）
          const lines = text.split('\n')
          lines.forEach((line, i) => {
            if (i > 0) {
              if (!lastWasBreak) runs.push(new TextRun({ break: 1 }))
              lastWasBreak = true
            }
            if (line) {
              runs.push(new TextRun(apply({ text: line }) as never))
              lastWasBreak = false
            }
          })
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const c = child as HTMLElement
        const tag = c.tagName.toLowerCase()
        if (tag === 'br') {
          if (!lastWasBreak) runs.push(new TextRun({ break: 1 }))
          lastWasBreak = true
        } else if (tag === 'strong' || tag === 'b') {
          const t = c.textContent || ''
          if (t) {
            runs.push(new TextRun(apply({ text: t, bold: true }) as never))
            lastWasBreak = false
          }
        } else if (tag === 'em' || tag === 'i') {
          const t = c.textContent || ''
          if (t) {
            runs.push(new TextRun(apply({ text: t, italics: true }) as never))
            lastWasBreak = false
          }
        } else if (tag === 'del' || tag === 's' || tag === 'strike') {
          // 删除线（渲染契约：marked gfm 的 ~~text~~ → <del>）：strike run
          const t = c.textContent || ''
          if (t) {
            runs.push(new TextRun(apply({ text: t, strike: true }) as never))
            lastWasBreak = false
          }
        } else if (tag === 'input') {
          // 任务列表（渲染契约：marked gfm 的 - [x] → <li><input checked disabled type="checkbox">）
          // checkbox 元素本身无文本 → 输出 ☑/☐ 符号保持任务语义
          const isChecked = c.hasAttribute('checked')
          runs.push(new TextRun(apply({ text: isChecked ? '☑ ' : '☐ ' }) as never))
          lastWasBreak = false
        } else if (tag === 'code') {
          const t = c.textContent || ''
          if (t) {
            runs.push(new TextRun(apply({ text: t, font: { ascii: 'Consolas', eastAsia: '等线' } }) as never))
            lastWasBreak = false
          }
        } else if (tag === 'a') {
          const t = c.textContent || ''
          if (t) {
            runs.push(new TextRun(apply({ text: t, color: '2E9FFF' }) as never))
            lastWasBreak = false
          }
        } else {
          // 块级子元素（嵌套列表/段落等）：递归前加换行，
          // 避免嵌套 ul/ol/div 的文本被拼接成一行（目录/多级列表连着的问题）
          const BLOCK_TAGS = ['p', 'div', 'ul', 'ol', 'li', 'blockquote', 'table', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
          const before = runs.length
          walk(c)
          if (BLOCK_TAGS.includes(tag) && runs.length > before) {
            // li 场景：第一个块级元素不插 break（符号与文本同行）；后续块才插 break 分隔
            if (!(options.suppressFirstBlockBreak && !blockSeen)) {
              // 连续换行合并：before 位置前一个 run 已是 break 则不再插（避免空白行）
              const prevRun = before > 0 ? runs[before - 1] : null
              const prevIsBreak = !!prevRun && (prevRun as unknown as { break?: number }).break === 1
              if (!prevIsBreak) {
                runs.splice(before, 0, new TextRun({ break: 1 }))
                lastWasBreak = true
              }
            }
            blockSeen = true
          }
        }
      }
    }
  }
  walk(el)
  return runs
}

/** 图片/画布 base64 → docx ImageRun 数据 */
function dataUrlToBytes(dataUrl: string): Uint8Array | null {
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

/** 加载图片（带超时：无超时的 new Image() 在异常 src 下可能既不 onload 也不 onerror，
 * 导致 await 永远挂起、后续所有图片/内容不生成——"后面的图片全部丢失"的根因之一） */
function loadImageWithTimeout(src: string, timeoutMs = 8000, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => {
      img.src = ''
      reject(new Error('image load timeout'))
    }, timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('image load error'))
    }
    img.src = src
  })
}

/** canvas 重编码时限制最大边长（等比）：原图过大会产生 10MB+ PNG，docx 文件暴涨 */
function clampCanvasSize(w: number, h: number): { width: number; height: number } {
  const maxSide = MAX_IMAGE_SIDE_PX
  if (Math.max(w, h) <= maxSide) return { width: w, height: h }
  const s = maxSide / Math.max(w, h)
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) }
}

/** 显示尺寸最终约束（双保险：任何转换路径漏约束，ImageRun 都不超过版心宽度） */
function clampDisplaySize(w: number, h: number): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 400, height: 300 }
  if (w <= MAX_IMAGE_WIDTH_PX) {
    return { width: Math.round(w), height: Math.round(h) }
  }
  const s = MAX_IMAGE_WIDTH_PX / w
  return { width: MAX_IMAGE_WIDTH_PX, height: Math.max(1, Math.round(h * s)) }
}

/** 从页面已加载的相同 src 图片元素绘制（canvas，不依赖 fetch——file:// 下 fetch 被禁） */
async function drawLoadedImage(src: string): Promise<string | null> {
  try {
    const img = Array.from(document.querySelectorAll('img'))
      .find((i) => i.getAttribute('src') === src && i.complete && i.naturalWidth > 0)
    if (!img) {
      logImage('drawLoadedImage: 页面 DOM 中未找到已加载的 img（src 不匹配 / 未加载 / 加载失败）')
      return null
    }
    // 限制 canvas 尺寸（最大边 2×显示宽）：原图过大会产生超大 PNG 撑爆 docx
    const cSize = clampCanvasSize(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = cSize.width
    canvas.height = cSize.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      logImage('drawLoadedImage: 获取 2d context 失败')
      return null
    }
    ctx.drawImage(img, 0, 0, cSize.width, cSize.height)
    const dataUrl = canvas.toDataURL('image/png')
    logImage(`drawLoadedImage: canvas 重编码成功 ${img.naturalWidth}x${img.naturalHeight} → ${cSize.width}x${cSize.height}（png）`)
    return dataUrl
  } catch (e) {
    // 跨域污染时 toDataURL 抛错 → 降级 fetch（file:// / 跨域图必然 SecurityError）
    logImage(`drawLoadedImage: 失败 ${e instanceof Error ? e.message : e}`)
    return null
  }
}

/** 图片 src → base64 + 宽高 + 类型（优先 data URL 直解；其次已加载 DOM 图；再 fetch；失败返回 null） */
async function imageToDocxImage(src: string): Promise<DocxImageResult | null> {
  try {
    // data URL（粘贴/拖拽插入的 base64 图）：直接解析，无 canvas/fetch 限制
    const dataMatch = src.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,(.+)$/)
    if (dataMatch) {
      const binary = atob(dataMatch[2])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const type = mimeToDocxType(dataMatch[1])
      logImage(`data URL 直解成功：格式=${type} 字节=${bytes.length}`)
      let w = 400
      let h = 300
      try {
        const img = await loadImageWithTimeout(src)
        w = img.naturalWidth || 400
        h = img.naturalHeight || 300
      } catch {
        // 忽略，用默认尺寸
      }
      if (w > MAX_IMAGE_WIDTH_PX) {
        h = Math.round((h * MAX_IMAGE_WIDTH_PX) / w)
        w = MAX_IMAGE_WIDTH_PX
      }
      return { data: bytes, width: w, height: h, type }
    }

    // 非 data URL：优先已加载 DOM 图（canvas），再 fetch
    let dataUrl: string | null = await drawLoadedImage(src)
    if (!dataUrl) {
      logImage('降级：尝试 new Image + fetch 读取')
      await loadImageWithTimeout(src, 8000, true)
      if (src.startsWith('data:')) {
        dataUrl = src
      } else if (/^https?:/i.test(src)) {
        logImage(`fetch 远程图：${src.slice(0, 120)}`)
        const controller = new AbortController()
        const timer = window.setTimeout(() => controller.abort(), 8000)
        let res: Response
        try {
          res = await fetch(src, { signal: controller.signal })
        } finally {
          window.clearTimeout(timer)
        }
        if (!res.ok) return null
        const blob = await res.blob()
        dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => resolve('')
          reader.readAsDataURL(blob)
        })
        if (!dataUrl) return null
      } else {
        // file:// / 相对路径图：浏览器禁止 fetch，无法读取二进制 → 返回 null（占位）
        warnImage(`无法读取非 http(s) 图片字节（${src.slice(0, 120)}）：file:// 下 fetch 被禁 / canvas 污染 → 占位`)
        return null
      }
    }
    // 到这里 dataUrl 逻辑上必非 null（块内所有路径已赋值或 return）；await 后 TS 收窄失效，用非空断言
    const dUrl: string = dataUrl as string
    const data = dataUrlToBytes(dUrl)
    if (!data) {
      warnImage('dataUrl 解析为字节失败 → 占位')
      return null
    }
    // 限制图片尺寸（最大按版心宽度，按比例）
    const maxW = MAX_IMAGE_WIDTH_PX
    let w = 400
    let h = 300
    // 从已加载图取自然尺寸
    const domImg = Array.from(document.querySelectorAll('img')).find((i) => i.getAttribute('src') === src && i.complete)
    if (domImg && domImg.naturalWidth > 0) {
      w = domImg.naturalWidth
      h = domImg.naturalHeight
    }
    if (w > maxW) {
      h = Math.round((h * maxW) / w)
      w = maxW
    }
    // 类型：按 data URL 头部分析；webp/未知用 canvas 重编码为 png
    const mimeMatch = dUrl.match(/^data:image\/([a-z0-9.+-]+)/i)
    const mime = mimeMatch ? mimeMatch[1].toLowerCase() : ''
    let type = mimeToDocxType(mime || undefined)
    if (mime && mime !== 'png' && type === 'png') {
      // 数据是 webp/svg 等 docx 不支持格式 → canvas 重编码 png
      try {
        const reImg = await loadImageWithTimeout(dUrl)
        const cSize = clampCanvasSize(reImg.naturalWidth || w, reImg.naturalHeight || h)
        const canvas = document.createElement('canvas')
        canvas.width = cSize.width
        canvas.height = cSize.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(reImg, 0, 0, cSize.width, cSize.height)
          const pngUrl = canvas.toDataURL('image/png')
          const pngData = dataUrlToBytes(pngUrl)
          if (pngData) {
            logImage('webp/未知格式已 canvas 重编码为 png')
            return { data: pngData, width: w, height: h, type: 'png' }
          }
        }
      } catch (e) {
        logImage(`webp 重编码失败 ${e instanceof Error ? e.message : e}`)
      }
    }
    logImage(`图片字节获取成功：type=${type} ${w}x${h} 字节=${data.length}`)
    return { data, width: w, height: h, type }
  } catch (e) {
    warnImage(`imageToDocxImage 异常 ${e instanceof Error ? e.message : e} → 占位`)
    return null
  }
}

/** mermaid SVG → PNG（canvas 绘制；foreignObject 文字可能缺失，结构/连线保留） */
async function svgToDocxImage(svg: SVGSVGElement): Promise<DocxImageResult | null> {
  try {
    let w = 800
    let h = 600
    const vb = svg.getAttribute('viewBox')
    if (vb) {
      const p = vb.split(/[\s,]+/).map(Number)
      if (p.length === 4 && p[2] > 0 && p[3] > 0) {
        w = Math.round(p[2])
        h = Math.round(p[3])
      }
    }

    // 克隆 SVG 并处理 foreignObject（mermaid flowchart/ER 图节点标签默认用 foreignObject）：
    // canvas 绘制 SVG 时 foreignObject 内 HTML 不渲染（文字丢失），且 XML 序列化可能含 <br> 等
    // 导致 blob 加载失败（流程图整图丢失）。把 foreignObject 文本提取为 SVG <text> 元素：
    // 保留文字 + 纯 SVG 结构，canvas 绘制即可正常显示。
    const clone = svg.cloneNode(true) as SVGSVGElement
    const foreignObjects = Array.from(clone.querySelectorAll('foreignObject'))
    foreignObjects.forEach((fo) => {
      const fx = parseFloat(fo.getAttribute('x') || '0')
      const fy = parseFloat(fo.getAttribute('y') || '0')
      const fw = parseFloat(fo.getAttribute('width') || '0')
      const raw = (fo.textContent || '').replace(/\u00a0/g, ' ').trim()
      if (!raw) {
        fo.remove()
        return
      }
      const lines = raw.split(/\n|<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean)
      if (lines.length === 0) {
        fo.remove()
        return
      }
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      const cx = fx + fw / 2
      t.setAttribute('x', String(cx))
      t.setAttribute('y', String(fy))
      t.setAttribute('text-anchor', 'middle')
      t.setAttribute('font-size', '13')
      t.setAttribute('font-family', 'PingFang SC, Microsoft YaHei UI, Segoe UI Variable, sans-serif')
      t.setAttribute('fill', '#1d1d1f')
      lines.forEach((line, i) => {
        const tsp = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
        tsp.setAttribute('x', String(cx))
        tsp.setAttribute('dy', i === 0 ? '0.9em' : '1.2em')
        tsp.textContent = line
        t.appendChild(tsp)
      })
      fo.parentNode?.replaceChild(t, fo)
    })

    const xml = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    let img: HTMLImageElement | null = null
    try {
      img = await loadImageWithTimeout(url)
    } catch {
      // blob 加载失败（仍可能存在 XML 问题）：降级直接用页面原 SVG 元素绘制（同文档绘制）
      logImage('svgToDocxImage: blob 加载失败，降级直接绘制页面 SVG 元素（foreignObject 文字可能缺失）')
      img = null
    }
    // 先约束显示尺寸（不超过版心宽度）：canvas 必须在约束后的尺寸上 2x，
    // 否则超大 viewBox（如 4000px 宽流程图）会生成 8000px canvas → 超大 PNG 撑爆 docx
    //（Word 对超大 docx 渐进加载，后面图片/内容可能不显示）
    const maxW = MAX_IMAGE_WIDTH_PX
    if (w > maxW) {
      h = Math.round((h * maxW) / w)
      w = maxW
    }
    // 2x 高清渲染：SVG 是矢量，canvas 按 2 倍光栅化 → PNG 源像素 4 倍，
    // Word 里放大 2 倍依然清晰（原图高清原则：源像素 ≥ 展示需求，放大不模糊）
    const HI_RES_SCALE = 2
    const canvas = document.createElement('canvas')
    canvas.width = w * HI_RES_SCALE
    canvas.height = h * HI_RES_SCALE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (img) {
      ctx.drawImage(img, 0, 0, w * HI_RES_SCALE, h * HI_RES_SCALE)
    } else {
      try {
        ctx.drawImage(svg as unknown as CanvasImageSource, 0, 0, w * HI_RES_SCALE, h * HI_RES_SCALE)
      } catch (e) {
        warnImage(`svgToDocxImage: 直接绘制页面 SVG 也失败 ${e instanceof Error ? e.message : e} → 占位`)
        return null
      }
    }
    URL.revokeObjectURL(url)
    const dataUrl = canvas.toDataURL('image/png')
    const data = dataUrlToBytes(dataUrl)
    if (!data) {
      logImage('svgToDocxImage: PNG 数据解析失败')
      return null
    }
    logImage(`svgToDocxImage: SVG→PNG 成功 ${w}x${h} 字节=${data.length}`)
    return { data, width: w, height: h, type: 'png' }
  } catch (e) {
    warnImage(`svgToDocxImage 失败 ${e instanceof Error ? e.message : e} → 占位`)
    return null
  }
}

/**
 * 图表按白色背景重渲染（Word 是白底文档，页面深色主题的 SVG 需转浅色主题）：
 * 从 SVG 所在 .chart-container 的 .chart-fallback 源码块取 mermaid 源码，
 * 用 mermaid 浅色主题（theme=default）重新渲染 → svgToDocxImage 白底 PNG。
 * 失败回退原 SVG 直接转换（保留结构/连线）。
 */
async function renderChartLight(svg: SVGSVGElement): Promise<DocxImageResult | null> {
  try {
    const container = svg.closest('.chart-container')
    const srcEl =
      container?.querySelector('.chart-fallback pre code') ||
      container?.querySelector('.chart-fallback pre')
    const code = srcEl ? (srcEl.textContent || '').trim() : ''
    if (!code) {
      warnImage('renderChartLight: 未找到 .chart-fallback 中的 mermaid 源码 → 直接用当前 SVG')
      return null
    }
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default', flowchart: { htmlLabels: false } })
    } catch {
      // 忽略初始化失败，用现有配置
    }
    const { svg: lightSvg } = await mermaid.render(`light-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, code)
    const parsed = new DOMParser().parseFromString(lightSvg, 'image/svg+xml')
    const svgEl = parsed.documentElement as unknown as SVGSVGElement
    if (!svgEl) return null
    logImage('✅ 图表已用浅色主题重渲染（theme=default），白底深色文字适配 Word')
    return await svgToDocxImage(svgEl)
  } catch (e) {
    warnImage(`renderChartLight 失败，回退当前 SVG: ${e instanceof Error ? e.message : e}`)
    return null
  }
}

/**
 * 递归转换 ul/ol 列表 → docx 段落（多级列表/目录：嵌套层独立段落 + 层级缩进，
 * 避免嵌套 li 文本被拼接成一行；wordWrap 防止长路径/URL 撑宽段落）
 * quoteStyle：引用块内列表时附加的引用样式（左边框/浅底/缩进），每项独立段落套用
 */
interface QuoteParagraphStyle {
  wordWrap?: boolean
  indent?: { left: number }
  border?: { left: { style: typeof BorderStyle.SINGLE; size: number; color: string } }
  shading?: { type: typeof ShadingType.CLEAR; fill: string }
  spacing?: { before: number; after: number; line: number; lineRule: typeof LineRuleType.AUTO }
}
function convertList(el: HTMLElement, ordered: boolean, depth: number, quoteStyle?: QuoteParagraphStyle): Paragraph[] {
  const result: Paragraph[] = []
  let i = 0
  for (const child of Array.from(el.children)) {
    if (child.tagName.toLowerCase() !== 'li') continue
    i++
    const li = child as HTMLElement
    const prefix = ordered ? `${i}. ` : '• '
    // 剥离 li 内嵌套列表（只取直接文本），嵌套列表单独递归为独立段落
    const liContent = li.cloneNode(true) as HTMLElement
    liContent.querySelectorAll('ul, ol').forEach((n) => n.remove())
    result.push(new Paragraph({
      wordWrap: true,
      children: [new TextRun(prefix), ...extractRuns(liContent, {}, { suppressFirstBlockBreak: true })],
      indent: { left: 360 + depth * 360 },
      spacing: { line: 360, lineRule: LineRuleType.AUTO, before: 0, after: 0 },
      ...quoteStyle,
    }))
    // 递归嵌套列表（缩进加深一级）
    for (const nested of Array.from(li.children)) {
      const t = nested.tagName.toLowerCase()
      if (t === 'ul' || t === 'ol') {
        result.push(...convertList(nested as HTMLElement, t === 'ol', depth + 1, quoteStyle))
      }
    }
  }
  return result
}

/** 代码块/目录树 → docx 段落（等宽字体灰底代码区；多行拆 run+break，长行在空格处换行） */
function convertCodeBlock(el: HTMLElement): Paragraph {
  // 图表代码块（mermaid 渲染失败回退显示源码）→ 提示日志，说明该图表未以图导出
  const codeText = (el.textContent || '').trim()
  const langMatch = typeof el.className === 'string' ? el.className.match(/language-(\S+)/) : null
  const codeLang = langMatch ? langMatch[1].toLowerCase() : ''
  const isChartCode = /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitgraph)\b|^(graph|flowchart)\s+/.test(codeText)
  if (isChartCode) {
    docxImgSeq++
    warnImage(`⚠️ 图表代码块（${codeLang || 'mermaid'}）未渲染为图，以代码导出 —— 页面渲染失败或未渲染，Word 中为代码而非图片：${codeText.slice(0, 60).replace(/\n/g, ' ')}...`)
  }
  // 目录树（README 项目结构等）→ 按代码区块文本输出（B 方案）：
  // 等宽字体灰底代码区，完整层级可读可搜索；不再转 mermaid 精简图（前 2 层会丢深层细节）
  // 多行代码拆成多个 run + break（docx TextRun 不渲染 \n，否则整块代码挤成一行）
  const codeLines = (el.textContent || '').split('\n')
  const codeRuns: TextRun[] = []
  // 连续换行合并（目录树/代码块不能有空行）：连续空行只保留一个换行分隔
  let lastWasBreak = false
  codeLines.forEach((line, i) => {
    // 压缩超长连续空格（目录树/代码里用于对齐的长空格 → 2 个）+ 去掉行尾空格：
    // 避免 Word 里显示几十个连续空格导致内容又长又难看
    const cleaned = line.replace(/ {3,}/g, '  ').replace(/ +$/g, '')
    // 长行在空格处主动换行（单行不超过 70 字符，保持紧凑）
    const wrapped = wrapLongLine(cleaned, 70)
    wrapped.forEach((seg, j) => {
      if (i > 0 || j > 0) {
        if (!lastWasBreak) codeRuns.push(new TextRun({ break: 1 }))
        lastWasBreak = true
      }
      if (seg) {
        codeRuns.push(new TextRun({ text: seg, font: { ascii: 'Consolas', eastAsia: '等线' }, size: 24 }))
        lastWasBreak = false
      }
    })
  })
  return new Paragraph({
    wordWrap: true,
    children: codeRuns,
    shading: { type: ShadingType.CLEAR, fill: 'F5F5F7' },
    // 紧凑：无左右缩进、单倍行距、小段间距（代码块/目录树不占多余空间）
    spacing: { before: 60, after: 60, line: 240, lineRule: LineRuleType.AUTO },
  })
}

/** 递归转换块级子节点 → docx 段落/表格 */
async function convertChildren(parent: HTMLElement): Promise<Array<Paragraph | Table>> {
  const result: Array<Paragraph | Table> = []
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (text.trim()) {
        // docx TextRun 不渲染 \n：多行文本必须拆成多个 run + break:1
        //（否则 div/section 直接文本子节点的换行会全部丢失、内容挤成一行）
        const runs: TextRun[] = []
        // 连续换行合并（目录/列表不能有空行）：\n\n 只产生一个 break
        let lastWasBreak = false
        text.split('\n').forEach((line, i) => {
          if (i > 0) {
            if (!lastWasBreak) runs.push(new TextRun({ break: 1 }))
            lastWasBreak = true
          }
          if (line.trim()) {
            runs.push(new TextRun({ text: line }))
            lastWasBreak = false
          }
        })
        result.push(new Paragraph({
          wordWrap: true,
          children: runs,
          spacing: { line: 360, lineRule: LineRuleType.AUTO, before: 0, after: 0 },
        }))
      }
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    // 跳过隐藏元素（inline display:none）：
    // 图表渲染成功时 .chart-fallback 源码块是隐藏的，不导出重复代码；渲染失败时可见则保留内容
    if (el.style && el.style.display === 'none') continue
    try {
      switch (tag) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          // 自定义标题样式：黑体加粗、深色、逐级字号（不用 Word 默认蓝色 Heading）
          // 政府公文/标书字号规范（用户定稿 2026-08-18）：
          // h1=标题 15pt 加粗居中；h2=小标题 13pt 加粗；h3+=次级标题 12pt 加粗；
          // 标题顶格不缩进、行距 1.5 倍（与 12pt 正文协调）
          const HEADING_STYLES: Record<string, { size: number; before: number; after: number; font: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }> = {
            h1: { size: 30, before: 0, after: 200, font: '黑体', align: AlignmentType.CENTER },
            h2: { size: 26, before: 200, after: 100, font: '黑体' },
            h3: { size: 24, before: 120, after: 60, font: '楷体' },
            h4: { size: 24, before: 120, after: 60, font: '仿宋' },
            h5: { size: 24, before: 120, after: 60, font: '仿宋' },
            h6: { size: 24, before: 120, after: 60, font: '仿宋' },
          }
          const hs = HEADING_STYLES[tag]
          result.push(new Paragraph({
            wordWrap: true,
            alignment: hs.align,
            spacing: { before: hs.before, after: hs.after, line: 360, lineRule: LineRuleType.AUTO },
            keepNext: true,
            children: extractRuns(el, {
              size: hs.size,
              bold: true,
              font: { ascii: 'Times New Roman', eastAsia: hs.font },
            }),
          }))
          break
        }
        case 'p':
          result.push(new Paragraph({
            wordWrap: true,
            children: extractRuns(el),
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 480 }, // 首行缩进 2 字符（正文=12pt，2 字符=24pt=480twips）
            spacing: { line: 360, lineRule: LineRuleType.AUTO, before: 0, after: 0 }, // 行距 1.5 倍、段前段后 0（公文）
          }))
          break
        case 'ul':
        case 'ol': {
          result.push(...convertList(el as HTMLElement, tag === 'ol', 0))
          break
        }
        case 'table': {
          const rows = Array.from(el.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'))
            .map((tr) =>
              new TableRow({
                children: Array.from(tr.children)
                  .filter((td) => ['td', 'th'].includes(td.tagName.toLowerCase()))
                  .map((td) => {
                    const isHead = td.tagName.toLowerCase() === 'th'
                    return new TableCell({
                      // 表头加粗 + 浅灰底；正文单元格正常
                      // 表格字号 11pt：表头 11pt 加粗、内容 11pt（用户规范）
                      children: isHead
                        ? [new Paragraph({ wordWrap: true, children: extractRuns(td as HTMLElement, { bold: true, size: 22 }), spacing: { line: 240, lineRule: LineRuleType.AUTO } })]
                        : convertInlineBlock(td as HTMLElement, { size: 22 }),
                      shading: { type: ShadingType.CLEAR, fill: isHead ? 'EDEDF2' : 'FFFFFF' },
                      margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      verticalAlign: 'center',
                    })
                  }),
              })
            )
          result.push(new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: '8A8A8E' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: '8A8A8E' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'C7C7CC' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'C7C7CC' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D1D1D6' },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D1D1D6' },
            },
          }))
          // 表格后补一个单倍行距空段落（学习 html-to-docx 业务逻辑：buildTable 后
          // 追加 buildParagraph(null)）——避免表格与紧随其后的段落文字粘连贴边框
          result.push(new Paragraph({
            children: [],
            spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 0, after: 0 },
          }))
          break
        }
        case 'pre':
        case 'code': {
          result.push(convertCodeBlock(el))
          break
        }
        case 'blockquote': {
          // 渲染契约：renderer.blockquote 输出 <blockquote class="enhanced-blockquote"><p>..</p>..</blockquote>
          // 或 alert 变体（.alert + .alert-title）。blockquote 内部是**多个块级元素**
          // （软换行已被 renderer.paragraph 拆成独立 <p>，还有 ul/ol/pre/code）。
          // 每块必须是独立 Word 段落并统一套引用样式（左蓝边/浅底/缩进）——
          // 之前 extractRuns(el) 把整块合成一个段落，段落语义/段间距全丢、内容挤在一起。
          const quoteStyle: QuoteParagraphStyle = {
            indent: { left: 360 },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: '2E9FFF' } },
            shading: { type: ShadingType.CLEAR, fill: 'F0F7FF' },
            spacing: { before: 120, after: 120, line: 360, lineRule: LineRuleType.AUTO },
          }
          const blocks = Array.from(el.children)
          if (blocks.length === 0) {
            // 无子块（纯文本引用）：单段 + 引用样式
            result.push(new Paragraph({ ...quoteStyle, wordWrap: true, children: extractRuns(el) }))
          } else {
            for (const b of blocks) {
              const t = b.tagName.toLowerCase()
              if (t === 'ul' || t === 'ol') {
                result.push(...convertList(b as HTMLElement, t === 'ol', 0, quoteStyle))
              } else if (t === 'pre' || t === 'code') {
                result.push(convertCodeBlock(b as HTMLElement))
              } else if (t === 'p' || t === 'div' || t === 'section') {
                // alert 块的 .alert-title（Note/Tip/...）加粗标识
                const isTitle = (b as HTMLElement).classList.contains('alert-title')
                result.push(new Paragraph({
                  ...quoteStyle,
                  wordWrap: true,
                  children: extractRuns(b as HTMLElement, isTitle ? { bold: true } : {}),
                }))
              } else {
                // 其他块（h1-h6 等罕见）：文本非空则作为引用段落
                const text = b.textContent?.trim()
                if (text) {
                  result.push(new Paragraph({ ...quoteStyle, wordWrap: true, children: extractRuns(b as HTMLElement) }))
                }
              }
            }
          }
          break
        }
        case 'hr': {
          // 分隔线：下边框段落（渲染契约：marked 输出 <hr>；此前无 case 直接丢失）
          result.push(new Paragraph({
            children: [],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C7C7CC' } },
            spacing: { before: 120, after: 120, line: 240, lineRule: LineRuleType.AUTO },
          }))
          break
        }
        case 'img': {
          docxImgSeq++
          const src = el.getAttribute('src') || ''
          const kind = src.startsWith('data:')
            ? 'data-url(粘贴图)'
            : /^https?:/i.test(src)
              ? 'http(远程图)'
              : src.startsWith('blob:')
                ? 'blob(Kroki/本地缓存图)'
                : src.startsWith('file:')
                  ? 'file(本地文件图)'
                  : 'relative(相对路径图)'
          logImage(`开始处理 <img> alt="${el.getAttribute('alt') || ''}" 类型=${kind} src=${src.slice(0, 100)}`)
          const img = await imageToDocxImage(src)
          if (img) {
            const disp = clampDisplaySize(img.width, img.height)
            logImage(`✅ 插入 docx：type=${img.type} ${img.width}x${img.height} → 显示 ${disp.width}x${disp.height}`)
            result.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120, line: 240, lineRule: LineRuleType.AUTO },
              children: [new ImageRun({ data: img.data, transformation: { width: disp.width, height: disp.height }, type: img.type })],
            }))
          } else {
            warnImage(`❌ 转换失败 → 占位文本（图未插入）`)
            result.push(new Paragraph({ children: [new TextRun({ text: `[图片: ${el.getAttribute('alt') || '未加载'}]`, italics: true, color: '8E8E93' })] }))
          }
          break
        }
        case 'svg': {
          docxImgSeq++
          logImage(`开始处理 <svg> 图表（本地 Mermaid 渲染）viewBox=${el.getAttribute('viewBox') || '无'}`)
          // 优先浅色主题重渲染（Word 白底文档，深色主题 SVG 需转白底），失败回退当前 SVG
          const lightImg = await renderChartLight(el as unknown as SVGSVGElement)
          const img = lightImg || (await svgToDocxImage(el as unknown as SVGSVGElement))
          if (img) {
            const disp = clampDisplaySize(img.width, img.height)
            logImage(`✅ 图表插入 docx：type=${img.type} ${img.width}x${img.height} → 显示 ${disp.width}x${disp.height}`)
            result.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120, line: 240, lineRule: LineRuleType.AUTO },
              children: [new ImageRun({ data: img.data, transformation: { width: disp.width, height: disp.height }, type: img.type })],
            }))
          } else {
            warnImage(`❌ 图表转换失败 → 占位文本（图未插入）`)
            result.push(new Paragraph({ children: [new TextRun({ text: '[图表]', italics: true, color: '8E8E93' })] }))
          }
          break
        }
        case 'div':
        case 'section':
        case 'article':
        case 'main': {
          // 分页符支持（学习 html-to-docx findXMLEquivalent 业务逻辑）：
          // div.page-break / style="page-break-after:always" → Word 分页符
          const styleText = el.getAttribute('style') || ''
          const isPageBreak =
            (el.classList && el.classList.contains('page-break')) ||
            /page-break-after\s*:\s*(always|page)/i.test(styleText) ||
            /page-break-before\s*:\s*(always|page)/i.test(styleText)
          if (isPageBreak) {
            result.push(new Paragraph({
              children: [new PageBreak()],
              spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 0, after: 0 },
            }))
            break
          }
          result.push(...(await convertChildren(el)))
          break
        }
        default:
          // 其他元素：有文本则作为段落输出
          if (el.textContent?.trim()) result.push(new Paragraph({
            wordWrap: true,
            children: extractRuns(el),
            spacing: { after: 60, line: 300, lineRule: LineRuleType.AUTO },
          }))
          break
      }
    } catch {
      // 单个节点转换失败不中断整体
    }
  }
  return result
}

/** 表格单元格内容（可能含多个段落） */
function convertInlineBlock(el: HTMLElement, overrides: RunOverrides = {}): Paragraph[] {
  const blocks = Array.from(el.querySelectorAll(':scope > p, :scope > div, :scope > ul, :scope > ol'))
  if (blocks.length === 0) return [new Paragraph({ wordWrap: true, children: extractRuns(el, overrides), spacing: { line: 240, lineRule: LineRuleType.AUTO } })]
  const result: Paragraph[] = []
  for (const b of blocks) {
    const t = b.tagName.toLowerCase()
    if (t === 'ul' || t === 'ol') {
      let i = 0
      for (const li of Array.from(b.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue
        i++
        result.push(new Paragraph({ wordWrap: true, children: [new TextRun(`${t === 'ol' ? `${i}. ` : '• '}`), ...extractRuns(li as HTMLElement, overrides, { suppressFirstBlockBreak: true })], spacing: { line: 240, lineRule: LineRuleType.AUTO } }))
      }
    } else {
      result.push(new Paragraph({ wordWrap: true, children: extractRuns(b as HTMLElement, overrides), spacing: { line: 240, lineRule: LineRuleType.AUTO } }))
    }
  }
  return result
}

/** HTML 字符串 → DOCX Blob */
export async function htmlToDocx(html: string): Promise<Blob> {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  const children = await convertChildren(tempDiv)
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            // 政府公文/标书规范：正文 12pt（小四）仿宋，数字/字母 Times New Roman
            font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '仿宋' },
            size: 24, // 12pt = 小四
          },
        },
      },
    },
    sections: [{
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            // 页码：公文规范 4 号半角宋体，格式「— 1 —」
            children: [
              new TextRun({ text: '— ', font: { ascii: 'Times New Roman', eastAsia: '宋体' }, size: 28 }),
              new TextRun({ children: [PageNumber.CURRENT], font: { ascii: 'Times New Roman', eastAsia: '宋体' }, size: 28 }),
              new TextRun({ text: ' —', font: { ascii: 'Times New Roman', eastAsia: '宋体' }, size: 28 }),
            ],
          })],
        }),
      },
      properties: {
        page: {
          // A3 横向（420×297mm）：公文大纸容纳代码/表格长行
          // 版心边距保持公文规范：上 3.7cm / 下 3.5cm / 左 2.8cm / 右 2.6cm
          // ⚠️ docx 库 PageSize 的 width/height 是"逻辑页面尺寸"，LANDSCAPE 时自动交换；
          // 要得到物理 A3 横向（pgSz w=23811 h=16838 orient=landscape）必须传逻辑 A3 纵向
          // 尺寸 16838x23811 + LANDSCAPE。此前传 23811x16838 被交换成 A3 纵向(297mm 宽)，
          // 图片 1300px(34.4cm) 超出页宽被 Word 裁掉一半——超宽根因。
          size: { width: 16838, height: 23811, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 2098, right: 1474, bottom: 1984, left: 1587 },
        },
      },
      children,
    }],
  })
  return Packer.toBlob(doc)
}
