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
  HeadingLevel,
  ImageRun,
  BorderStyle,
  WidthType,
  ShadingType,
} from 'docx'

const HEADING_MAP: Record<string, string> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
}

/** docx 支持的图片类型（与 ImageRun type 对齐） */
type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp'

/** data URL / mime 格式 → docx 图片类型 */
function mimeToDocxType(mime: string | undefined): DocxImageType {
  const m = (mime || '').toLowerCase()
  if (m === 'jpeg' || m === 'jpg') return 'jpg'
  if (m === 'gif') return 'gif'
  if (m === 'bmp') return 'bmp'
  return 'png' // png / webp（webp 会被 canvas 重编码为 png）/ 未知
}

/** 图片转换过程日志（控制台可观测：用户通过日志判断图片是否插入成功） */
let docxImgSeq = 0
function logImage(msg: string, ...rest: unknown[]): void {
  console.log(`[docx-image][${docxImgSeq}] ${msg}`, ...rest)
}
function warnImage(msg: string, ...rest: unknown[]): void {
  console.warn(`[docx-image][${docxImgSeq}] ${msg}`, ...rest)
}

/** 提取块内 inline 内容为 TextRun（strong/em/code/a/br/普通文本） */
function extractRuns(el: HTMLElement): TextRun[] {
  const runs: TextRun[] = []
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || ''
        if (text) runs.push(new TextRun({ text }))
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const c = child as HTMLElement
        const tag = c.tagName.toLowerCase()
        if (tag === 'br') {
          runs.push(new TextRun({ break: 1 }))
        } else if (tag === 'strong' || tag === 'b') {
          const t = c.textContent || ''
          if (t) runs.push(new TextRun({ text: t, bold: true }))
        } else if (tag === 'em' || tag === 'i') {
          const t = c.textContent || ''
          if (t) runs.push(new TextRun({ text: t, italics: true }))
        } else if (tag === 'code') {
          const t = c.textContent || ''
          if (t) runs.push(new TextRun({ text: t, font: 'Consolas' }))
        } else if (tag === 'a') {
          const t = c.textContent || ''
          if (t) runs.push(new TextRun({ text: t, color: '2E9FFF' }))
        } else {
          walk(c)
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

/** 从页面已加载的相同 src 图片元素绘制（canvas，不依赖 fetch——file:// 下 fetch 被禁） */
async function drawLoadedImage(src: string): Promise<string | null> {
  try {
    const img = Array.from(document.querySelectorAll('img'))
      .find((i) => i.getAttribute('src') === src && i.complete && i.naturalWidth > 0)
    if (!img) {
      logImage('drawLoadedImage: 页面 DOM 中未找到已加载的 img（src 不匹配 / 未加载 / 加载失败）')
      return null
    }
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      logImage('drawLoadedImage: 获取 2d context 失败')
      return null
    }
    ctx.drawImage(img, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    logImage(`drawLoadedImage: canvas 重编码成功 ${img.naturalWidth}x${img.naturalHeight}（png）`)
    return dataUrl
  } catch (e) {
    // 跨域污染时 toDataURL 抛错 → 降级 fetch（file:// / 跨域图必然 SecurityError）
    logImage(`drawLoadedImage: 失败 ${e instanceof Error ? e.message : e}`)
    return null
  }
}

/** 图片 src → base64 + 宽高 + 类型（优先 data URL 直解；其次已加载 DOM 图；再 fetch；失败返回 null） */
async function imageToDocxImage(src: string): Promise<{ data: Uint8Array; width: number; height: number; type: DocxImageType } | null> {
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
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('load error'))
          img.src = src
        })
        w = img.naturalWidth || 400
        h = img.naturalHeight || 300
      } catch {
        // 忽略，用默认尺寸
      }
      if (w > 600) {
        h = Math.round((h * 600) / w)
        w = 600
      }
      return { data: bytes, width: w, height: h, type }
    }

    // 非 data URL：优先已加载 DOM 图（canvas），再 fetch
    let dataUrl: string | null = await drawLoadedImage(src)
    if (!dataUrl) {
      logImage('降级：尝试 new Image + fetch 读取')
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('load error'))
        img.src = src
      })
      if (src.startsWith('data:')) {
        dataUrl = src
      } else if (/^https?:/i.test(src)) {
        logImage(`fetch 远程图：${src.slice(0, 120)}`)
        const res = await fetch(src)
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
    // 限制图片尺寸（最大 600px 宽，按比例）
    const maxW = 600
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
        const reImg = new Image()
        await new Promise<void>((resolve, reject) => {
          reImg.onload = () => resolve()
          reImg.onerror = () => reject(new Error('load error'))
          reImg.src = dUrl
        })
        const canvas = document.createElement('canvas')
        canvas.width = reImg.naturalWidth || w
        canvas.height = reImg.naturalHeight || h
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(reImg, 0, 0)
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
async function svgToDocxImage(svg: SVGSVGElement): Promise<{ data: Uint8Array; width: number; height: number; type: DocxImageType } | null> {
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
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg load error'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    const dataUrl = canvas.toDataURL('image/png')
    const data = dataUrlToBytes(dataUrl)
    if (!data) {
      logImage('svgToDocxImage: PNG 数据解析失败')
      return null
    }
    // 限制尺寸
    const maxW = 620
    if (w > maxW) {
      h = Math.round((h * maxW) / w)
      w = maxW
    }
    logImage(`svgToDocxImage: SVG→PNG 成功 ${w}x${h} 字节=${data.length}`)
    return { data, width: w, height: h, type: 'png' }
  } catch (e) {
    warnImage(`svgToDocxImage 失败 ${e instanceof Error ? e.message : e} → 占位`)
    return null
  }
}

/** 递归转换块级子节点 → docx 段落/表格 */
async function convertChildren(parent: HTMLElement): Promise<Array<Paragraph | Table>> {
  const result: Array<Paragraph | Table> = []
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) result.push(new Paragraph({ children: [new TextRun(text)] }))
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    try {
      switch (tag) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          result.push(new Paragraph({ heading: HEADING_MAP[tag] as (typeof HeadingLevel)[keyof typeof HeadingLevel], children: extractRuns(el) }))
          break
        case 'p':
          result.push(new Paragraph({ children: extractRuns(el), spacing: { after: 120 } }))
          break
        case 'ul':
        case 'ol': {
          const ordered = tag === 'ol'
          let i = 0
          for (const li of Array.from(el.children)) {
            if (li.tagName.toLowerCase() !== 'li') continue
            i++
            const prefix = ordered ? `${i}. ` : '• '
            result.push(new Paragraph({
              children: [new TextRun(prefix), ...extractRuns(li as HTMLElement)],
              indent: { left: 360 },
              spacing: { after: 60 },
            }))
          }
          break
        }
        case 'table': {
          const rows = Array.from(el.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'))
            .map((tr) =>
              new TableRow({
                children: Array.from(tr.children)
                  .filter((td) => ['td', 'th'].includes(td.tagName.toLowerCase()))
                  .map((td) => new TableCell({
                    children: convertInlineBlock(td as HTMLElement),
                    shading: td.tagName.toLowerCase() === 'th' ? { type: ShadingType.CLEAR, fill: 'F2F2F7' } : undefined,
                  })),
              })
            )
          result.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }))
          break
        }
        case 'pre':
        case 'code':
          result.push(new Paragraph({
            children: [new TextRun({ text: el.textContent || '', font: 'Consolas', size: 18 })],
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F7' },
            spacing: { before: 120, after: 120 },
          }))
          break
        case 'blockquote':
          result.push(new Paragraph({
            children: extractRuns(el),
            indent: { left: 360 },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: '2E9FFF' } },
            shading: { type: ShadingType.CLEAR, fill: 'F0F7FF' },
          }))
          break
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
            logImage(`✅ 插入 docx：type=${img.type} ${img.width}x${img.height}`)
            result.push(new Paragraph({ children: [new ImageRun({ data: img.data, transformation: { width: img.width, height: img.height }, type: img.type })] }))
          } else {
            warnImage(`❌ 转换失败 → 占位文本（图未插入）`)
            result.push(new Paragraph({ children: [new TextRun({ text: `[图片: ${el.getAttribute('alt') || '未加载'}]`, italics: true, color: '8E8E93' })] }))
          }
          break
        }
        case 'svg': {
          docxImgSeq++
          logImage(`开始处理 <svg> 图表（本地 Mermaid 渲染）viewBox=${el.getAttribute('viewBox') || '无'}`)
          const img = await svgToDocxImage(el as unknown as SVGSVGElement)
          if (img) {
            logImage(`✅ 图表插入 docx：type=${img.type} ${img.width}x${img.height}`)
            result.push(new Paragraph({ children: [new ImageRun({ data: img.data, transformation: { width: img.width, height: img.height }, type: img.type })] }))
          } else {
            warnImage(`❌ 图表转换失败 → 占位文本（图未插入）`)
            result.push(new Paragraph({ children: [new TextRun({ text: '[图表]', italics: true, color: '8E8E93' })] }))
          }
          break
        }
        case 'div':
        case 'section':
        case 'article':
        case 'main':
          result.push(...(await convertChildren(el)))
          break
        default:
          // 其他元素：有文本则作为段落输出
          if (el.textContent?.trim()) result.push(new Paragraph({ children: extractRuns(el) }))
          break
      }
    } catch {
      // 单个节点转换失败不中断整体
    }
  }
  return result
}

/** 表格单元格内容（可能含多个段落） */
function convertInlineBlock(el: HTMLElement): Paragraph[] {
  const blocks = Array.from(el.querySelectorAll(':scope > p, :scope > div, :scope > ul, :scope > ol'))
  if (blocks.length === 0) return [new Paragraph({ children: extractRuns(el) })]
  const result: Paragraph[] = []
  for (const b of blocks) {
    const t = b.tagName.toLowerCase()
    if (t === 'ul' || t === 'ol') {
      let i = 0
      for (const li of Array.from(b.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue
        i++
        result.push(new Paragraph({ children: [new TextRun(`${t === 'ol' ? `${i}. ` : '• '}`), ...extractRuns(li as HTMLElement)] }))
      }
    } else {
      result.push(new Paragraph({ children: extractRuns(b as HTMLElement) }))
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
    sections: [{ properties: {}, children }],
  })
  return Packer.toBlob(doc)
}
