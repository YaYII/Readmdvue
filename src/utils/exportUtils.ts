/**
 * 文档导出工具类
 * 实现HTML、PDF、Markdown、PNG、JPEG等格式的导出功能
 * 遵循苹果设计理念，提供优雅的导出体验
 */

import type { ExportOptions } from '../types'
import { showNotification, showSuccess, showError } from './appleNotification'

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
    const htmlContent = this.generateHTMLContent(content, options)
    await this.downloadFile(htmlContent, options.filename, 'text/html')
  }

  /**
   * 导出为PDF格式
   */
  private async exportAsPDF(content: string, options: ExportOptions): Promise<void> {
    // 使用浏览器的打印功能生成PDF
    const htmlContent = this.generateHTMLContent(content, options)
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
  private generateHTMLContent(content: string, options: ExportOptions): string {
    const styles = options.includeStyles ? this.getDocumentStyles() : ''
    const processedContent = this.processContent(content, options)
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.getDocumentTitle()}</title>
    ${styles}
    <style>
        /* 导出专用样式 */
        body {
            font-family: 'PingFang SC', 'Microsoft YaHei UI', 'Segoe UI Variable', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            color: #1d1d1f;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #ffffff;
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
    </style>
</head>
<body>
    ${processedContent}
</body>
</html>`
  }

  /**
   * 处理内容
   */
  private processContent(content: string, options: ExportOptions): string {
    let processedContent = content
    
    // 移除不需要导出的元素
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = processedContent
    
    // 移除导航、工具栏、目录面板、标题锚点等不需要导出的元素
    const elementsToRemove = tempDiv.querySelectorAll(
      '.no-print, .toolbar, .navigation, .settings-panel, .export-dialog, ' +
      '.toc-panel, .toc-trigger-zone, .markdown-vue-toolbar, .vue-toolbar, .heading-anchor'
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
   */
  private getDocumentStyles(): string {
    const styleSheets = Array.from(document.styleSheets)
    let styles = '<style>\n'
    
    styleSheets.forEach(sheet => {
      try {
        if (sheet.cssRules) {
          Array.from(sheet.cssRules).forEach(rule => {
            styles += rule.cssText + '\n'
          })
        }
      } catch (e) {
        // 跨域样式表无法访问，忽略
      }
    })
    
    styles += '</style>'
    return styles
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
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // 清理URL对象
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /**
   * 下载DataURL
   */
  private async downloadDataURL(dataURL: string, filename: string): Promise<void> {
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
  const markdownContainer = document.querySelector('.markdown-body, .md-content, main, article')
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
