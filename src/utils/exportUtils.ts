/**
 * 文档导出工具类
 * 实现HTML、PDF、Markdown、PNG、JPEG等格式的导出功能
 * 遵循苹果设计理念，提供优雅的导出体验
 */

import type { ExportOptions } from '../types'
import { showNotification, showSuccess, showError } from './appleNotification'
import { KATEX_FONTS_CSS } from './katexFontsData'
import { htmlToDocx } from './htmlToDocx'

/**
 * 文档导出管理器
 */
export class DocumentExporter {
  private static instance: DocumentExporter
  
  private constructor() {}
  
  public static getInstance(): DocumentExporter {
    if (!DocumentExporter.instance) {
      DocumentExporter.instance = new DocumentExporter()
    }
    return DocumentExporter.instance
  }

  /**
   * 导出文档
   * @param content 文档内容
   * @param options 导出选项
   */
  public async exportDocument(content: string, options: ExportOptions): Promise<void> {
    try {
      showNotification({
        title: '开始导出',
        message: `正在导出为 ${options.format.toUpperCase()} 格式...`,
        type: 'info',
        duration: 2000
      })

      switch (options.format) {
        case 'html':
          await this.exportAsHTML(content, options)
          break
        case 'pdf':
          await this.exportAsPDF(content, options)
          break
        case 'markdown':
          await this.exportAsMarkdown(content, options)
          break
        case 'word':
          await this.exportAsWord(content, options)
          break
        case 'png':
          await this.exportAsPNG(content, options)
          break
        case 'jpeg':
          await this.exportAsJPEG(content, options)
          break
        default:
          throw new Error(`不支持的导出格式: ${options.format}`)
      }

      showSuccess('导出成功', `文件已保存为 ${options.filename}`)
    } catch (error) {
      console.error('导出失败:', error)
      showError('导出失败', error instanceof Error ? error.message : '未知错误')
    }
  }

  /**
   * 导出为HTML格式
   */
  private async exportAsHTML(content: string, options: ExportOptions): Promise<void> {
    const htmlContent = await this.generateHTMLContent(content, options)
    await this.downloadFile(htmlContent, options.filename, 'text/html')
  }

  /**
   * 导出为PDF格式
   */
  private async exportAsPDF(content: string, options: ExportOptions): Promise<void> {
    // 使用浏览器的打印功能生成PDF
    const htmlContent = await this.generateHTMLContent(content, options)
    const printWindow = window.open('', '_blank')
    
    if (!printWindow) {
      throw new Error('无法打开打印窗口，请检查浏览器弹窗设置')
    }

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    // 等待内容加载完成
    await new Promise(resolve => {
      printWindow.onload = resolve
      setTimeout(resolve, 1000) // 备用超时
    })

    // 设置打印选项
    const mediaQuery = options.orientation === 'landscape' ? '@page { size: landscape; }' : '@page { size: portrait; }'
    const style = printWindow.document.createElement('style')
    style.textContent = mediaQuery
    printWindow.document.head.appendChild(style)

    // 触发打印对话框
    printWindow.print()
    
    // 延迟关闭窗口，给用户时间完成打印
    setTimeout(() => {
      printWindow.close()
    }, 1000)
  }

  /**
   * 导出为Markdown格式
   */
  private async exportAsMarkdown(content: string, options: ExportOptions): Promise<void> {
    // 如果内容已经是Markdown，直接导出
    // 如果是HTML，需要转换为Markdown
    let markdownContent = content
    
    if (this.isHTMLContent(content)) {
      markdownContent = this.convertHTMLToMarkdown(content)
    }
    
    await this.downloadFile(markdownContent, options.filename, 'text/markdown')
  }

  /**
   * 导出为 Word（标准 .docx）：
   * 渲染后的 HTML 转成 docx 结构（docx 库生成标准 Word 文档），
   * 标题/表格/代码块/图片/mermaid 图表（转 PNG）均保留。
   */
  private async exportAsWord(content: string, options: ExportOptions): Promise<void> {
    const processedContent = this.processContent(content, options)
    const blob = await htmlToDocx(processedContent)
    await this.downloadBlob(blob, options.filename)
  }

  /**
   * 下载 Blob（docx 等二进制）
   */
  private async downloadBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.downloads?.download) {
        await new Promise<void>((resolve) => {
          chrome.downloads.download({ url, filename }, () => {
            if (chrome.runtime.lastError) {
              console.warn('[export] chrome.downloads.download(blob) 失败:', chrome.runtime.lastError.message)
            }
            resolve()
          })
        })
        return
      }
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }

  /**
   * 导出为PNG格式
   */
  private async exportAsPNG(content: string, options: ExportOptions): Promise<void> {
    const canvas = await this.contentToCanvas(content, options)
    const dataURL = canvas.toDataURL('image/png')
    await this.downloadDataURL(dataURL, options.filename)
  }

  /**
   * 导出为JPEG格式
   */
  private async exportAsJPEG(content: string, options: ExportOptions): Promise<void> {
    const canvas = await this.contentToCanvas(content, options)
    const quality = options.quality || 0.9
    const dataURL = canvas.toDataURL('image/jpeg', quality)
    await this.downloadDataURL(dataURL, options.filename)
  }

  /**
   * 生成HTML内容
   */
  private async generateHTMLContent(content: string, options: ExportOptions): Promise<string> {
    const styles = options.includeStyles ? await this.getDocumentStyles(!!options.includeFonts) : ''
    // 仅当用户选择「包含公式字体」时才内嵌 KaTeX 字体 base64（默认关闭：导出文件更小、源码干净）
    const katexFonts = options.includeFonts ? KATEX_FONTS_CSS : ''
    const themeOverrides = this.getCurrentThemeOverrides()
    const processedContent = this.processContent(content, options)
    
    return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${this.getCurrentThemeAttr()}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- export-version: 2.1.4 (theme+image-viewer) -->
    <title>${this.getDocumentTitle()}</title>
    ${styles}
    ${katexFonts}
    ${themeOverrides}
    <style>
        /* 导出专用样式 */
        body {
            font-family: 'PingFang SC', 'Microsoft YaHei UI', 'Segoe UI Variable', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            color: var(--md-text-primary, #1d1d1f);
            margin: 0 auto;
            padding: 20px;
            background: var(--md-bg-primary, #ffffff);
        }
        
        @media print {
            body {
                margin: 0;
                padding: 15mm;
            }
            
            .no-print {
                display: none !important;
            }
        }
        
        /* 苹果风格的排版 */
        h1, h2, h3, h4, h5, h6 {
            font-weight: 600;
            margin-top: 2em;
            margin-bottom: 1em;
            color: #1d1d1f;
        }
        
        h1 { font-size: 2.5em; }
        h2 { font-size: 2em; }
        h3 { font-size: 1.5em; }
        h4 { font-size: 1.25em; }
        h5 { font-size: 1.1em; }
        h6 { font-size: 1em; }
        
        p {
            margin-bottom: 1em;
        }
        
        code {
            background: #f5f5f7;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        }
        
        pre {
            background: #f5f5f7;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
        }
        
        blockquote {
            border-left: 4px solid #007aff;
            margin: 1em 0;
            padding-left: 1em;
            color: #3c3c43;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
        }
        
        th, td {
            border: 1px solid #d1d1d6;
            padding: 8px 12px;
            text-align: left;
            /* 长内容强制换行：禁止单元格内容撑破页面（长英文/URL/数字串），打印也不会被隐藏 */
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: normal;
        }

        /* 用户规则：表格第一列短内容单行；超过 200px 时换行（与页面渲染一致） */
        th:first-child,
        td:first-child {
            max-width: 200px;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: break-word;
        }
        
        th {
            background: #f5f5f7;
            font-weight: 600;
        }
        
        img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1em 0;
        }

        /* 图片完整显示：覆盖 content.css 的 height:300px 固定高度
           （阅读器靠双击放大看全图；导出文档应直接显示原始完整比例） */
        .markdown-reader-container img,
        .markdown-reader-container .markdown-image {
            height: auto !important;
            max-height: none !important;
            width: auto !important;
            max-width: 100% !important;
            object-fit: contain;
        }

        /* 图片容器居中 */
        .markdown-reader-container .image-container {
            text-align: center;
        }

        /* Mermaid 图表：智能宽度（小图按 viewBox 本宽、大图才缩 100%）+ 不裁切 */
        .markdown-reader-container .mermaid {
            overflow-x: auto;
            max-height: none;
        }
        .markdown-reader-container .mermaid svg {
            width: auto !important;
            max-width: none !important;
            height: auto !important;
        }
        .markdown-reader-container .mermaid svg foreignObject div,
        .markdown-reader-container .mermaid svg foreignObject span,
        .markdown-reader-container .mermaid svg foreignObject p,
        .markdown-reader-container .mermaid svg text {
            line-height: normal !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
        }
    </style>
</head>
<body>
    <!-- 与页面渲染结构一致：正文样式（content.css）大量使用 .markdown-reader-container 后代选择器，
         导出内容必须包同样容器，否则样式全部失效 -->
    <div class="markdown-reader-container">
      <div class="markdown-reader-content">
        ${processedContent}
      </div>
    </div>
    <script>
      /* 点击放大查看：图片（IMG）与 mermaid 图表（SVG）均可点击放大
         （导出文档保留 md 阅读器的查看交互） */
      (function () {
        function showViewer(el) {
          var mask = document.createElement('div');
          mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;' +
            'align-items:center;justify-content:center;z-index:9999;cursor:zoom-out;';
          if (el.tagName === 'IMG') {
            var big = document.createElement('img');
            big.src = el.currentSrc || el.src;
            big.alt = el.alt || '';
            big.style.cssText = 'max-width:92vw;max-height:92vh;object-fit:contain;border-radius:8px;' +
              'box-shadow:0 8px 40px rgba(0,0,0,0.5);';
            mask.appendChild(big);
          } else {
            // SVG（mermaid 图表）：克隆并按原始 viewBox 比例大图显示
            var svg = el.cloneNode(true);
            svg.removeAttribute('width');
            svg.removeAttribute('height');
            svg.style.cssText = 'max-width:92vw;max-height:92vh;width:auto;height:auto;' +
              'box-shadow:0 8px 40px rgba(0,0,0,0.5);';
            mask.appendChild(svg);
          }
          var close = function () { if (mask.parentNode) mask.parentNode.removeChild(mask); };
          mask.addEventListener('click', close);
          document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
          });
          document.body.appendChild(mask);
        }
        document.addEventListener('click', function (e) {
          var t = e.target;
          if (!t || !t.closest) return;
          // 图片：链接内不拦截
          if (t.tagName === 'IMG' && !t.closest('a') && t.closest('.markdown-reader-container')) {
            e.preventDefault();
            showViewer(t);
            return;
          }
          // mermaid 图表：点击 SVG 任意位置放大
          var svg = t.tagName === 'svg' ? t : t.closest('svg');
          if (svg && svg.closest('.markdown-reader-container')) {
            e.preventDefault();
            showViewer(svg);
          }
        });
      })();
    </script>
</body>
</html>`
  }

  /**
   * 当前主题属性（导出 HTML 保留 data-theme，使 :root[data-theme=...] 规则生效）
   */
  private getCurrentThemeAttr(): string {
    return document.documentElement.getAttribute('data-theme') || 'light'
  }

  /**
   * 固化当前生效的主题/排版/强调色 CSS 变量（getComputedStyle 实际计算值）：
   * 导出文档默认呈现与页面一致的外观（背景色/文字色/强调色/字号/行高/宽度等），
   * 而不是回退到样式表默认值。
   */
  private getCurrentThemeOverrides(): string {
    try {
      const style = getComputedStyle(document.documentElement)
      const vars: string[] = []
      for (let i = 0; i < style.length; i++) {
        const name = style.item(i)
        if (name && name.startsWith('--')) {
          const value = style.getPropertyValue(name).trim()
          if (value) vars.push(`${name}: ${value};`)
        }
      }
      if (vars.length) {
        return `<style>\n:root {\n${vars.join('\n')}\n}\n</style>`
      }
    } catch {
      // 读取失败时忽略（使用样式表默认值）
    }
    return ''
  }

  /**
   * 处理内容
   */
  private processContent(content: string, options: ExportOptions): string {
    let processedContent = content
    
    // 移除不需要导出的元素
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = processedContent
    
    // 移除导航、工具栏、目录面板、标题锚点、扩展 UI 容器、隐藏原始内容等不需要导出的元素
    const elementsToRemove = tempDiv.querySelectorAll(
      '.no-print, .toolbar, .navigation, .settings-panel, .export-dialog, ' +
      '.toc-panel, .toc-trigger-zone, .markdown-vue-toolbar, .vue-toolbar, .heading-anchor, ' +
      // 扩展 UI 容器（目录/导出对话框/遮罩/通知）
      '#vue-table-of-contents, .vue-toc-container, #vue-component-export, #vue-overlay-export, ' +
      '.vue-component-container, .vue-component-overlay, .markdown-reader-notification, .donation-modal, ' +
      // 图表 UI：只保留 .chart-content 里的渲染结果（SVG/img），
      // 移除加载/错误/源码/分析信息等 UI（否则代码块与界面文本会污染导出）；
      // .chart-fallback 保留（渲染失败时有内容兜底），由 htmlToDocx 按 display:none 判断跳过
      '.chart-loading, .chart-error, .chart-source, .chart-analysis-info, .chart-wrapper .view-source-btn, ' +
      // 隐藏的原始 Markdown 内容（页面快照 fallback 时可能带入）
      '.md-original-content-wrapper, .md-original-content-hidden'
    )
    elementsToRemove.forEach(el => el.remove())
    
    // 处理图片
    if (!options.includeImages) {
      const images = tempDiv.querySelectorAll('img')
      images.forEach(img => {
        const placeholder = document.createElement('div')
        placeholder.textContent = '[图片已移除]'
        placeholder.style.cssText = 'padding: 20px; background: #f5f5f7; border-radius: 8px; text-align: center; color: #8e8e93;'
        img.parentNode?.replaceChild(placeholder, img)
      })
    } else {
      // 图片尺寸规范化（内联样式优先级最高，彻底覆盖 content.css 的 height:300px 固定高度）：
      // 小图按原始宽度显示、大图不超过容器宽度、等比不变形
      const images = tempDiv.querySelectorAll('img')
      images.forEach(img => {
        img.style.maxWidth = '100%'
        img.style.height = 'auto'
        img.style.width = 'auto'
        img.style.objectFit = 'contain'
      })
    }
    
    // 处理图表
    if (!options.includeCharts) {
      const charts = tempDiv.querySelectorAll('.mermaid, .chart, [data-chart]')
      charts.forEach(chart => {
        const placeholder = document.createElement('div')
        placeholder.textContent = '[图表已移除]'
        placeholder.style.cssText = 'padding: 20px; background: #f5f5f7; border-radius: 8px; text-align: center; color: #8e8e93;'
        chart.parentNode?.replaceChild(placeholder, chart)
      })
    }
    
    // 处理数学公式
    if (!options.includeMath) {
      const mathElements = tempDiv.querySelectorAll('.katex, .MathJax, [data-math]')
      mathElements.forEach(math => {
        const placeholder = document.createElement('span')
        placeholder.textContent = '[数学公式已移除]'
        placeholder.style.cssText = 'background: #f5f5f7; padding: 2px 6px; border-radius: 4px; color: #8e8e93;'
        math.parentNode?.replaceChild(placeholder, math)
      })
    }
    
    return tempDiv.innerHTML
  }

  /**
   * 获取文档样式
   * 只导出正文排版所需样式：过滤扩展 UI 组件样式（按钮/开关/毛玻璃/弹窗/工具栏等），
   * 剔除 chrome-extension:// 引用；KaTeX 等字体 **内嵌为 base64 data URL**
   * （自包含，导出的 HTML 在任何环境公式都能正常显示，不依赖外部字体文件）。
   */
  private async getDocumentStyles(includeFonts: boolean): Promise<string> {
    const styleSheets = Array.from(document.styleSheets)
    // 扩展 UI 组件样式选择器（导出文档不需要按钮/开关/卡片/弹窗/工具栏/目录等）
    const UI_SELECTOR = /\.(btn|switch|slider|liquid-glass|tag-|card-|tooltip|progress-|loading-|animate-|export-|dialog|toolbar|vue-|toc-|notification|donation|modal|overlay|setting|close-btn|format-|option-item|section-title|filename-|footer-|header-icon|select-apple|input-apple|slider-|switch-)/i
    // 引用扩展资源的 URL（chrome-extension://...）跨环境失效，剔除
    const EXTENSION_URL = /chrome-extension:\/\/[^"')]+/i

    // ArrayBuffer → base64（分块处理避免大数组栈溢出）
    const toBase64 = (buffer: ArrayBuffer): string => {
      const bytes = new Uint8Array(buffer)
      let binary = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      return btoa(binary)
    }

    // 抓取字体文件并内嵌为 data URL（只取 woff2，浏览器首选；失败返回 null → 跳过该字体）
    const embedFont = async (url: string): Promise<string | null> => {
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const buf = await res.arrayBuffer()
        return `url(data:font/woff2;base64,${toBase64(buf)}) format("woff2")`
      } catch {
        return null
      }
    }

    const rules: string[] = []
    const fontPromises: Promise<string | null>[] = []

    styleSheets.forEach((sheet) => {
      try {
        if (!sheet.cssRules) return
        // 相对/绝对路径字体 URL 以样式表所在位置解析（如 /assets/KaTeX_*.woff2 → chrome-extension://.../assets/...）
        const base = sheet.href || document.baseURI
        Array.from(sheet.cssRules).forEach((rule) => {
          try {
            // content script 隔离世界（isolated world）中 DOM 对象的 instanceof 检查不可靠
            // （样式表规则来自主 world，本 world 的 CSSStyleRule 等构造函数不同），
            // 必须用 CSSRule.type 数字常量判断（跨 world 可靠）
            // type: 1=STYLE_RULE 4=MEDIA_RULE 5=FONT_FACE_RULE 7=KEYFRAMES_RULE
            const ruleType = (rule as CSSRule).type
            if (ruleType === 1) {
              // 跳过 UI 组件样式
              const styleRule = rule as CSSStyleRule
              if (!UI_SELECTOR.test(styleRule.selectorText)) {
                rules.push(styleRule.cssText)
              }
            } else if (ruleType === 4) {
              // 递归处理 @media 内的规则
              const inner: string[] = []
              const mediaRule = rule as CSSMediaRule
              Array.from(mediaRule.cssRules).forEach((r) => {
                if ((r as CSSRule).type === 1 && !UI_SELECTOR.test((r as CSSStyleRule).selectorText)) {
                  inner.push((r as CSSStyleRule).cssText)
                }
              })
              if (inner.length) {
                rules.push(`@media ${mediaRule.conditionText} {\n${inner.join('\n')}\n}`)
              }
            } else if (ruleType === 5) {
              // @font-face：内嵌 woff2 字体（自包含）
              // 未开启「包含公式字体」时跳过所有 @font-face（避免导出外部字体 URL 404）
              if (!includeFonts) return
              const fontFace = rule as CSSFontFaceRule
              const src = fontFace.style.getPropertyValue('src')
              const urls = src.match(/url\((['"]?)([^)'"]+)\1\)/g) || []
              const woff2 = urls
                .map((u) => u.replace(/^url\((['"]?)([^)'"]+)\1\)$/, '$2'))
                .find((u) => /\.woff2($|\?)/i.test(u))
              if (woff2) {
                try {
                  // 解析字体绝对 URL：/assets/ 开头的扩展资源优先用 chrome.runtime.getURL（最可靠），
                  // 其余按样式表所在位置解析
                  const abs = woff2.startsWith('/assets/') && typeof chrome !== 'undefined' && chrome.runtime?.getURL
                    ? chrome.runtime.getURL(woff2.slice(1))
                    : new URL(woff2, base).href
                  fontPromises.push(
                    embedFont(abs).then((embedded) => {
                      if (!embedded) return null
                      const family = fontFace.style.getPropertyValue('font-family') || '"KaTeX"'
                      const weight = fontFace.style.getPropertyValue('font-weight') || 'normal'
                      const styleVal = fontFace.style.getPropertyValue('font-style') || 'normal'
                      return `@font-face { font-family: ${family}; src: ${embedded}; font-weight: ${weight}; font-style: ${styleVal}; }`
                    })
                  )
                } catch {
                  // URL 解析失败 → 跳过该字体
                }
              }
            } else if (ruleType === 7) {
              // 正文不需要动画关键帧，跳过（减小体积）
            } else {
              // 其他规则（@supports/@layer 等）保留
              rules.push(rule.cssText)
            }
          } catch {
            // 单条规则无法访问时忽略
          }
        })
      } catch {
        // 跨域样式表无法访问，忽略
      }
    })

    // 等待所有字体内嵌完成，字体规则在前（保证被正文规则引用时已定义）
    const fontRules = (await Promise.all(fontPromises)).filter((f): f is string => !!f)
    // 过滤掉任何残留的扩展资源 URL
    const cleaned = [...fontRules, ...rules].join('\n').replace(EXTENSION_URL, '')
    return `<style>\n${cleaned}\n</style>`
  }

  /**
   * 获取文档标题
   */
  private getDocumentTitle(): string {
    const h1 = document.querySelector('h1')
    if (h1) {
      return h1.textContent || 'Markdown文档'
    }
    return document.title || 'Markdown文档'
  }

  /**
   * 判断是否为HTML内容
   */
  private isHTMLContent(content: string): boolean {
    return /<[^>]+>/.test(content)
  }

  /**
   * 将HTML转换为Markdown
   */
  private convertHTMLToMarkdown(html: string): string {
    // 简单的HTML到Markdown转换
    // 在实际项目中，可以使用更专业的库如turndown
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    let markdown = ''
    
    // 处理标题
    for (let i = 1; i <= 6; i++) {
      const headings = tempDiv.querySelectorAll(`h${i}`)
      headings.forEach(heading => {
        const text = heading.textContent || ''
        const prefix = '#'.repeat(i)
        heading.outerHTML = `${prefix} ${text}\n\n`
      })
    }
    
    // 处理段落
    const paragraphs = tempDiv.querySelectorAll('p')
    paragraphs.forEach(p => {
      const text = p.textContent || ''
      p.outerHTML = `${text}\n\n`
    })
    
    // 处理代码块
    const codeBlocks = tempDiv.querySelectorAll('pre code')
    codeBlocks.forEach(code => {
      const text = code.textContent || ''
      code.parentElement!.outerHTML = `\`\`\`\n${text}\n\`\`\`\n\n`
    })
    
    // 处理行内代码
    const inlineCodes = tempDiv.querySelectorAll('code')
    inlineCodes.forEach(code => {
      const text = code.textContent || ''
      code.outerHTML = `\`${text}\``
    })
    
    // 处理链接
    const links = tempDiv.querySelectorAll('a')
    links.forEach(link => {
      const text = link.textContent || ''
      const href = link.getAttribute('href') || ''
      link.outerHTML = `[${text}](${href})`
    })
    
    // 处理图片
    const images = tempDiv.querySelectorAll('img')
    images.forEach(img => {
      const alt = img.getAttribute('alt') || ''
      const src = img.getAttribute('src') || ''
      img.outerHTML = `![${alt}](${src})`
    })
    
    // 处理列表
    const lists = tempDiv.querySelectorAll('ul, ol')
    lists.forEach(list => {
      const items = list.querySelectorAll('li')
      let listText = ''
      items.forEach((item, index) => {
        const text = item.textContent || ''
        const prefix = list.tagName === 'UL' ? '- ' : `${index + 1}. `
        listText += `${prefix}${text}\n`
      })
      list.outerHTML = listText + '\n'
    })
    
    // 处理引用
    const blockquotes = tempDiv.querySelectorAll('blockquote')
    blockquotes.forEach(quote => {
      const text = quote.textContent || ''
      quote.outerHTML = `> ${text}\n\n`
    })
    
    markdown = tempDiv.textContent || tempDiv.innerText || ''
    return markdown.trim()
  }

  /**
   * 将内容转换为Canvas
   */
  private async contentToCanvas(content: string, options: ExportOptions): Promise<HTMLCanvasElement> {
    // 创建临时容器
    const container = document.createElement('div')
    container.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: 800px;
      background: white;
      padding: 20px;
      font-family: 'PingFang SC', 'Microsoft YaHei UI', sans-serif;
      line-height: 1.6;
      color: #1d1d1f;
    `
    
    container.innerHTML = this.processContent(content, options)
    document.body.appendChild(container)
    
    try {
      // 使用html2canvas库（如果可用）
      if (typeof (window as any).html2canvas === 'function') {
        const canvas = await (window as any).html2canvas(container, {
          backgroundColor: '#ffffff',
          scale: 2, // 高分辨率
          useCORS: true,
          allowTaint: true
        })
        return canvas
      } else {
        // 降级方案：创建简单的文本画布
        return this.createTextCanvas(container.textContent || '', options)
      }
    } finally {
      document.body.removeChild(container)
    }
  }

  /**
   * 创建文本画布（降级方案）
   */
  private createTextCanvas(text: string, _options: ExportOptions): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    // 设置画布尺寸
    canvas.width = 800
    canvas.height = Math.max(600, text.length / 50 * 20) // 根据文本长度估算高度
    
    // 设置样式
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#1d1d1f'
    ctx.font = '16px PingFang SC, Microsoft YaHei UI, sans-serif'
    
    // 绘制文本
    const lines = text.split('\n')
    const lineHeight = 24
    let y = 30
    
    lines.forEach(line => {
      if (y > canvas.height - 30) return // 防止超出画布
      
      // 处理长行换行
      const maxWidth = canvas.width - 60
      const words = line.split(' ')
      let currentLine = ''
      
      words.forEach(word => {
        const testLine = currentLine + word + ' '
        const metrics = ctx.measureText(testLine)
        
        if (metrics.width > maxWidth && currentLine !== '') {
          ctx.fillText(currentLine, 30, y)
          currentLine = word + ' '
          y += lineHeight
        } else {
          currentLine = testLine
        }
      })
      
      if (currentLine) {
        ctx.fillText(currentLine, 30, y)
        y += lineHeight
      }
    })
    
    return canvas
  }

  /**
   * 下载文件
   */
  private async downloadFile(content: string, filename: string, mimeType: string): Promise<void> {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    try {
      // 扩展环境优先用 chrome.downloads.download：
      // file:// 页面中 <a download> 的 download 属性会被 Chrome 忽略（blob 跨源），
      // 表现为点击导出无任何反应；downloads API 是扩展内唯一可靠的下载通道
      // （manifest 已有 downloads 权限，MarkdownEditor 保存文件走的同一条通道）。
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.downloads?.download) {
        await new Promise<void>((resolve) => {
          chrome.downloads.download({ url, filename }, () => {
            if (chrome.runtime.lastError) {
              // downloads API 失败（如 data URL 超限）→ 降级 <a download>
              console.warn('[export] chrome.downloads.download 失败，降级 <a download>:', chrome.runtime.lastError.message)
            }
            resolve()
          })
        })
        return
      }

      // 降级：普通页面 / 非扩展环境 <a download>
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      // 延迟清理 URL，确保下载已读取 blob
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }

  /**
   * 下载DataURL
   */
  private async downloadDataURL(dataURL: string, filename: string): Promise<void> {
    // 扩展环境优先用 chrome.downloads.download（data URL 原生支持）
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.downloads?.download) {
      await new Promise<void>((resolve) => {
        chrome.downloads.download({ url: dataURL, filename }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[export] chrome.downloads.download(dataURL) 失败，降级 <a download>:', chrome.runtime.lastError.message)
          }
          resolve()
        })
      })
      return
    }

    const link = document.createElement('a')
    link.href = dataURL
    link.download = filename
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

/**
 * 导出文档的便捷函数
 */
export async function exportDocument(content: string, options: ExportOptions): Promise<void> {
  const exporter = DocumentExporter.getInstance()
  await exporter.exportDocument(content, options)
}

/**
 * 获取当前页面内容用于导出
 */
export function getCurrentPageContent(): string {
  // 渲染容器类名是 .markdown-reader-content（.markdown-content 在页面中不存在）
  const markdownContainer = document.querySelector(
    '.markdown-reader-content, .markdown-content, .markdown-body, .md-content, main, article'
  )
  if (markdownContainer) {
    return markdownContainer.innerHTML
  }

  // 降级方案：获取body内容
  return document.body.innerHTML
}

/**
 * 生成默认文件名
 */
export function generateDefaultFilename(format: string): string {
  const title = document.title || 'markdown-document'
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
  const cleanTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').substring(0, 50)
  
  return `${cleanTitle}-${timestamp}.${format}`
}
