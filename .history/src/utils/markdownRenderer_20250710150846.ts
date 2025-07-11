import { marked } from 'marked'
import hljs from 'highlight.js'
import { asyncChartRenderer } from './asyncChartRenderer'
import { liquidGlass } from './liquidGlass'
import { showSuccess, showError, showWarning } from './appleNotification'

// 配置marked选项
marked.setOptions({
  langPrefix: 'hljs language-',
  breaks: true,
  gfm: true
})

// 自定义渲染器
const renderer = new marked.Renderer()

// 增强代码块渲染
const originalCodeRenderer = renderer.code
renderer.code = function(code: string, language: string | undefined, escaped: boolean) {
  const lang = language || ''
  
  // 检查是否为图表类型
  if (['mermaid', 'plantuml', 'kroki'].includes(lang.toLowerCase())) {
    return renderChartBlock(code, lang.toLowerCase() as 'mermaid' | 'plantuml' | 'kroki')
  }
  
  // 普通代码块处理
  const highlighted = originalCodeRenderer.call(this, code, language, escaped)
  
  // 添加复制按钮和Liquid Glass效果
  const codeId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  return `
    <div class="enhanced-code-block" data-language="${lang}">
      <div class="code-header">
        <span class="code-language">${lang.toUpperCase()}</span>
        <button class="copy-button" onclick="copyCode('${codeId}')" title="复制代码">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <rect x="6" y="6" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
        </button>
      </div>
      <div class="code-content" id="${codeId}">
        ${highlighted}
      </div>
    </div>
  `
}

// 增强表格渲染
const originalTableRenderer = renderer.table
renderer.table = function(header: string, body: string) {
  const originalTable = originalTableRenderer.call(this, header, body)
  
  return `
    <div class="enhanced-table-container">
      <div class="table-wrapper">
        ${originalTable}
      </div>
    </div>
  `
}

// 增强链接渲染
const originalLinkRenderer = renderer.link
renderer.link = function(href: string, title: string | null, text: string) {
  const isExternal = href.startsWith('http') && !href.includes(window.location.hostname)
  const titleAttr = title ? ` title="${title}"` : ''
  const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
  
  return `
    <a href="${href}"${titleAttr}${targetAttr} class="enhanced-link ${isExternal ? 'external-link' : 'internal-link'}">
      ${text}
      ${isExternal ? '<svg class="external-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3.5 3.5h5v5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
    </a>
  `
}

// 增强图片渲染
const originalImageRenderer = renderer.image
renderer.image = function(href: string, title: string | null, text: string) {
  const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const titleAttr = title ? ` title="${title}"` : ''
  
  return `
    <div class="enhanced-image-container" id="${imageId}">
      <div class="image-wrapper">
        <img src="${href}" alt="${text}"${titleAttr} class="enhanced-image" 
             onload="handleImageLoad('${imageId}')" 
             onerror="handleImageError('${imageId}')"
             onclick="openImageModal('${href}', '${text}')">
        <div class="image-loading">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
          </div>
        </div>
      </div>
      ${title ? `<div class="image-caption">${title}</div>` : ''}
    </div>
  `
}

// 渲染图表块
function renderChartBlock(code: string, chartType: 'mermaid' | 'plantuml' | 'kroki'): string {
  const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // 创建图表容器
  const container = `
    <div class="enhanced-chart-container" id="${chartId}" data-chart-type="${chartType}">
      <div class="chart-loading">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
        <div class="loading-text">正在渲染 ${chartType.toUpperCase()} 图表...</div>
      </div>
    </div>
  `
  
  // 异步渲染图表
  setTimeout(async () => {
    const containerElement = document.getElementById(chartId)
    if (!containerElement) return
    
    try {
      await asyncChartRenderer.renderChart(
        chartType,
        code,
        containerElement,
        {
          timeout: 15000,
          retryCount: 3,
          enableCache: true
        }
      )
      
      // 应用Liquid Glass效果
      liquidGlass.applyLiquidGlass(containerElement, {
        opacity: 0.95,
        blur: 15,
        borderRadius: 12
      })
      
      showSuccess('图表渲染完成', `${chartType.toUpperCase()} 图表已成功渲染`)
      
    } catch (error) {
      console.error('Chart render error:', error)
      containerElement.innerHTML = `
        <div class="chart-error">
          <div class="error-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
              <path d="M16 16l16 16M32 16l-16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="error-title">图表渲染失败</div>
          <div class="error-message">${error instanceof Error ? error.message : '未知错误'}</div>
          <div class="error-actions">
            <button class="retry-button" onclick="retryChart('${chartId}', '${chartType}', \`${code.replace(/`/g, '\\`')}\`)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13.65 2.35A8 8 0 1 0 16 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M16 4V8H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              重试
            </button>
          </div>
        </div>
      `
      
      showError('图表渲染失败', error instanceof Error ? error.message : '未知错误')
    }
  }, 100)
  
  return container
}

// 主渲染函数
export async function renderMarkdown(content: string): Promise<string> {
  try {
    // 预处理内容
    const processedContent = preprocessContent(content)
    
    // 渲染markdown
    const html = marked(processedContent, { renderer })
    
    // 后处理HTML
    const enhancedHtml = postprocessHTML(html)
    
    return enhancedHtml
    
  } catch (error) {
    console.error('Markdown render error:', error)
    showError('Markdown渲染失败', error instanceof Error ? error.message : '未知错误')
    return `<div class="render-error">渲染失败: ${error instanceof Error ? error.message : '未知错误'}</div>`
  }
}

// 预处理内容
function preprocessContent(content: string): string {
  // 处理数学公式
  content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    return `<div class="math-block">${formula}</div>`
  })
  
  content = content.replace(/\$(.*?)\$/g, (match, formula) => {
    return `<span class="math-inline">${formula}</span>`
  })
  
  // 处理任务列表
  content = content.replace(/^(\s*)- \[([ x])\] (.+)$/gm, (match, indent, checked, text) => {
    const isChecked = checked === 'x'
    return `${indent}- <input type="checkbox" ${isChecked ? 'checked' : ''} disabled> ${text}`
  })
  
  // 处理警告框
  content = content.replace(/^> \*\*(注意|警告|提示|信息):\*\* (.+)$/gm, (match, type, text) => {
    const alertType = type === '注意' ? 'warning' : type === '警告' ? 'error' : type === '提示' ? 'info' : 'success'
    return `<div class="alert alert-${alertType}"><strong>${type}:</strong> ${text}</div>`
  })
  
  return content
}

// 后处理HTML
function postprocessHTML(html: string): string {
  // 添加目录锚点
  html = html.replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (match, level, text) => {
    const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')
    return `<h${level} id="${id}" class="heading-with-anchor">
      ${text}
      <a href="#${id}" class="anchor-link" title="链接到此标题">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </a>
    </h${level}>`
  })
  
  // 添加容器包装
  html = `
    <div class="markdown-content">
      ${html}
    </div>
  `
  
  return html
}

// 全局函数（用于HTML中的事件处理）
declare global {
  interface Window {
    copyCode: (codeId: string) => void
    retryChart: (chartId: string, chartType: string, code: string) => void
    handleImageLoad: (imageId: string) => void
    handleImageError: (imageId: string) => void
    openImageModal: (src: string, alt: string) => void
  }
}

// 复制代码功能
window.copyCode = async (codeId: string) => {
  const codeElement = document.getElementById(codeId)
  if (!codeElement) return
  
  const code = codeElement.textContent || ''
  
  try {
    await navigator.clipboard.writeText(code)
    showSuccess('复制成功', '代码已复制到剪贴板')
  } catch (error) {
    console.error('Copy failed:', error)
    showError('复制失败', '无法复制到剪贴板')
  }
}

// 重试图表渲染
window.retryChart = async (chartId: string, chartType: string, code: string) => {
  const containerElement = document.getElementById(chartId)
  if (!containerElement) return
  
  containerElement.innerHTML = `
    <div class="chart-loading">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      <div class="loading-text">正在重试渲染 ${chartType.toUpperCase()} 图表...</div>
    </div>
  `
  
  try {
    await asyncChartRenderer.renderChart(
      chartType as 'mermaid' | 'plantuml' | 'kroki',
      code,
      containerElement,
      {
        timeout: 15000,
        retryCount: 3,
        enableCache: false // 重试时不使用缓存
      }
    )
    
    liquidGlass.applyLiquidGlass(containerElement, {
      opacity: 0.95,
      blur: 15,
      borderRadius: 12
    })
    
    showSuccess('图表渲染完成', `${chartType.toUpperCase()} 图表重试渲染成功`)
    
  } catch (error) {
    console.error('Chart retry error:', error)
    containerElement.innerHTML = `
      <div class="chart-error">
        <div class="error-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
            <path d="M16 16l16 16M32 16l-16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="error-title">图表渲染失败</div>
        <div class="error-message">${error instanceof Error ? error.message : '未知错误'}</div>
        <div class="error-message">请检查图表语法是否正确</div>
      </div>
    `
    
    showError('图表重试失败', error instanceof Error ? error.message : '未知错误')
  }
}

// 图片加载处理
window.handleImageLoad = (imageId: string) => {
  const container = document.getElementById(imageId)
  if (!container) return
  
  const loading = container.querySelector('.image-loading')
  const img = container.querySelector('.enhanced-image')
  
  if (loading) loading.remove()
  if (img) {
    img.classList.add('loaded')
    liquidGlass.applyLiquidGlass(container, {
      opacity: 0.95,
      blur: 10,
      borderRadius: 8
    })
  }
}

window.handleImageError = (imageId: string) => {
  const container = document.getElementById(imageId)
  if (!container) return
  
  container.innerHTML = `
    <div class="image-error">
      <div class="error-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M14 30l8-8 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="18" cy="18" r="2" fill="currentColor"/>
        </svg>
      </div>
      <div class="error-text">图片加载失败</div>
    </div>
  `
  
  showWarning('图片加载失败', '无法加载图片资源')
}

// 图片模态框
window.openImageModal = (src: string, alt: string) => {
  const modal = document.createElement('div')
  modal.className = 'image-modal'
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeImageModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">${alt || '图片预览'}</h3>
          <button class="modal-close" onclick="closeImageModal()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <img src="${src}" alt="${alt}" class="modal-image">
        </div>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
  
  // 应用Liquid Glass效果
  setTimeout(() => {
    const modalContent = modal.querySelector('.modal-content') as HTMLElement
    if (modalContent) {
      liquidGlass.applyLiquidGlass(modalContent, {
        opacity: 0.95,
        blur: 25,
        borderRadius: 16
      })
    }
  }, 100)
  
  // 添加关闭函数到全局
  ;(window as any).closeImageModal = () => {
    modal.remove()
    delete (window as any).closeImageModal
  }
}

export default {
  renderMarkdown,
  preprocessContent,
  postprocessHTML
}



export class MarkdownRenderer {
  private config: MarkdownConfig
  private chartManager: ChartRenderManager
  private chartCounter = 0

  constructor(config: MarkdownConfig) {
    this.config = config
    this.chartManager = new ChartRenderManager(config)
  }

  updateConfig(config: MarkdownConfig): void {
    this.config = config
    this.chartManager.updateConfig(config)
  }





  async render(content: string): Promise<RenderResult> {
    try {
      let processedContent = content
      const warnings: string[] = []

      // 预处理数学公式
      if (this.config.enableMath) {
        processedContent = this.processMathFormulas(processedContent)
      }

      // 预处理图表
      if (this.config.enableCharts || this.config.enableMermaid) {
        const chartResult = await this.processCharts(processedContent)
        processedContent = chartResult.content
        warnings.push(...chartResult.warnings)
      }

      // 渲染Markdown
      const htmlContent = await marked(processedContent)

      // 后处理：添加样式类和属性
      const finalContent = this.postProcess(htmlContent)

      return {
        success: true,
        content: finalContent,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '渲染失败'
      }
    }
  }

  private processMathFormulas(content: string): string {
    // 处理行内数学公式 $...$
    content = content.replace(/\$([^$\n]+)\$/g, (_, formula) => {
      try {
        const html = katex.renderToString(formula, { 
          displayMode: false,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: false
        })
        return `<span class="math-inline">${html}</span>`
      } catch (err) {
        console.warn('行内数学公式渲染失败:', formula, err)
        const errorMsg = err instanceof Error ? err.message : '渲染失败'
        return `<span class="math-error" title="数学公式错误: ${errorMsg}">$${formula}$</span>`
      }
    })

    // 处理块级数学公式 $$...$$
    content = content.replace(/\$\$([^$]+)\$\$/g, (_, formula) => {
      try {
        const html = katex.renderToString(formula.trim(), { 
          displayMode: true,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: false
        })
        return `<div class="math-block">${html}</div>`
      } catch (err) {
        console.warn('块级数学公式渲染失败:', formula, err)
        const errorMsg = err instanceof Error ? err.message : '渲染失败'
        return `<div class="math-error" title="数学公式错误: ${errorMsg}">$$${formula.trim()}$$</div>`
      }
    })

    return content
  }

  private async processCharts(content: string): Promise<{ content: string; warnings: string[] }> {
    const warnings: string[] = []
    let processedContent = content

    // 处理Mermaid图表
    if (this.config.enableMermaid) {
      const mermaidRegex = /```mermaid\s*\n([\s\S]*?)\n```/g
      const mermaidMatches = [...content.matchAll(mermaidRegex)]
      
      for (const match of mermaidMatches) {
        try {
          const chartId = `mermaid-${++this.chartCounter}`
          const chartContent = match[1].trim()
          
          // 验证Mermaid语法
          const isValid = await this.validateMermaidSyntax(chartContent)
          if (!isValid) {
            warnings.push(`Mermaid图表语法错误: ${chartContent.substring(0, 50)}...`)
            continue
          }

          const chartHtml = `
            <div class="chart-container mermaid-chart" data-chart-id="${chartId}">
              <div class="chart-content" id="${chartId}">${chartContent}</div>
              <div class="chart-error" style="display: none;"></div>
            </div>
          `
          
          processedContent = processedContent.replace(match[0], chartHtml)
        } catch (err) {
          warnings.push(`Mermaid图表处理失败: ${err instanceof Error ? err.message : '未知错误'}`)
        }
      }
    }

    // 处理其他图表类型（PlantUML, Kroki等）
    if (this.config.enableCharts) {
      processedContent = await this.processOtherCharts(processedContent, warnings)
    }

    return { content: processedContent, warnings }
  }

  private async validateMermaidSyntax(content: string): Promise<boolean> {
    try {
      await mermaid.parse(content)
      return true
    } catch {
      return false
    }
  }

  private async processOtherCharts(content: string, _warnings: string[]): Promise<string> {
    // 处理PlantUML
    content = content.replace(/```plantuml\s*\n([\s\S]*?)\n```/g, (_match, chartContent) => {
      const chartId = `plantuml-${++this.chartCounter}`
      return `
        <div class="chart-container plantuml-chart" data-chart-id="${chartId}">
          <div class="chart-loading">正在渲染PlantUML图表...</div>
          <div class="chart-content" data-content="${encodeURIComponent(chartContent.trim())}"></div>
          <div class="chart-error" style="display: none;"></div>
        </div>
      `
    })

    // 处理其他Kroki支持的图表类型
    const krogiTypes = ['graphviz', 'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml']
    
    krogiTypes.forEach(type => {
      const regex = new RegExp(`\`\`\`${type}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'g')
      content = content.replace(regex, (_match, chartContent) => {
        const chartId = `${type}-${++this.chartCounter}`
        return `
          <div class="chart-container kroki-chart" data-chart-type="${type}" data-chart-id="${chartId}">
            <div class="chart-loading">正在渲染${type}图表...</div>
            <div class="chart-content" data-content="${encodeURIComponent(chartContent.trim())}"></div>
            <div class="chart-error" style="display: none;"></div>
          </div>
        `
      })
    })

    return content
  }

  private postProcess(html: string): string {
    // 添加表格响应式包装
    html = html.replace(/<table>/g, '<div class="table-wrapper"><table class="markdown-table">')
    html = html.replace(/<\/table>/g, '</table></div>')

    // 添加代码块复制按钮
    html = html.replace(/<pre><code class="([^"]*)">([\s\S]*?)<\/code><\/pre>/g, (_match, className, code) => {
      const language = className.replace('language-', '') || 'text'
      return `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span class="code-language">${language}</span>
            <button class="code-copy-btn" data-code="${encodeURIComponent(code)}" title="复制代码">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <pre><code class="${className}">${code}</code></pre>
        </div>
      `
    })

    // 添加图片懒加载和缩放功能
    html = html.replace(/<img([^>]+)>/g, (_match, attrs) => {
      return `<img${attrs} class="markdown-image" loading="lazy" onclick="toggleImageZoom(this)">`
    })

    // 添加链接安全属性
    html = html.replace(/<a href="([^"]+)"([^>]*)>/g, (match, href, attrs) => {
      if (href.startsWith('http')) {
        return `<a href="${href}"${attrs} target="_blank" rel="noopener noreferrer">`
      }
      return match
    })

    return html
  }

  async renderCharts(): Promise<void> {
    await this.chartManager.renderAllCharts()
  }

  // 移除未使用的方法
}

// 图表渲染函数
function renderChart(code: string, type: 'mermaid' | 'plantuml' | 'kroki'): string {
  const containerId = `chart-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // 创建异步渲染容器
  const container = `
    <div id="${containerId}" class="async-chart-container" data-chart-type="${type}">
      <div class="chart-loading" style="display: flex; align-items: center; justify-content: center; min-height: 200px; color: #666;">
        <div style="text-align: center;">
          <div style="margin-bottom: 12px;">
            <div class="loading-spinner" style="
              width: 32px; 
              height: 32px; 
              border: 3px solid #f3f3f3; 
              border-top: 3px solid #007AFF; 
              border-radius: 50%; 
              animation: spin 1s linear infinite;
              margin: 0 auto;
            "></div>
          </div>
          <div>正在渲染${getTypeDisplayName(type)}图表...</div>
        </div>
      </div>
      <div class="chart-content" style="display: none;" data-content="${encodeURIComponent(code)}"></div>
      <div class="chart-error" style="display: none;"></div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .async-chart-container {
        position: relative;
        margin: 16px 0;
        border-radius: 8px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      }
      .chart-loading, .chart-content, .chart-error {
        padding: 20px;
      }
    </style>
  `
  
  // 异步渲染图表
  setTimeout(() => {
    asyncChartRenderer.renderChart({
      type,
      content: code,
      containerId,
      timeout: 15000,
      retryCount: 3,
      cacheEnabled: true
    }).catch(error => {
      console.warn(`异步图表渲染失败 (${type}):`, error)
    })
  }, 100)
  
  return container
}

function getTypeDisplayName(type: string): string {
  const typeNames = {
    mermaid: 'Mermaid',
    plantuml: 'PlantUML', 
    kroki: 'Kroki'
  }
  return typeNames[type as keyof typeof typeNames] || type
}