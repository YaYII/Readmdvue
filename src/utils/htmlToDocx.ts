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
    if (!img) return null
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null // 跨域污染时 toDataURL 抛错 → 降级 fetch
  }
}

/** 图片 src → base64 + 宽高（优先已加载 DOM 图；否则 fetch；失败返回 null） */
async function imageToDocxImage(src: string): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    let dataUrl: string | null = await drawLoadedImage(src)
    if (!dataUrl) {
      // 降级：加载图片获取宽高（data URL / blob / 可访问 URL）
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('load error'))
        img.src = src
      })
      if (src.startsWith('data:')) {
        dataUrl = src
      } else {
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
      }
    }
    const data = dataUrlToBytes(dataUrl)
    if (!data) return null
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
    return { data, width: w, height: h }
  } catch {
    return null
  }
}

/** mermaid SVG → PNG（canvas 绘制；foreignObject 文字可能缺失，结构/连线保留） */
async function svgToDocxImage(svg: SVGSVGElement): Promise<{ data: Uint8Array; width: number; height: number } | null> {
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
    if (!data) return null
    // 限制尺寸
    const maxW = 620
    if (w > maxW) {
      h = Math.round((h * maxW) / w)
      w = maxW
    }
    return { data, width: w, height: h }
  } catch {
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
          const img = await imageToDocxImage(el.getAttribute('src') || '')
          if (img) result.push(new Paragraph({ children: [new ImageRun({ data: img.data, transformation: { width: img.width, height: img.height }, type: 'png' })] }))
          else result.push(new Paragraph({ children: [new TextRun({ text: `[图片: ${el.getAttribute('alt') || '未加载'}]`, italics: true, color: '8E8E93' })] }))
          break
        }
        case 'svg': {
          const img = await svgToDocxImage(el as unknown as SVGSVGElement)
          if (img) result.push(new Paragraph({ children: [new ImageRun({ data: img.data, transformation: { width: img.width, height: img.height }, type: 'png' })] }))
          else result.push(new Paragraph({ children: [new TextRun({ text: '[图表]', italics: true, color: '8E8E93' })] }))
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
