import { marked } from 'marked'
import hljs from 'highlight.js'
import { asyncChartRenderer } from './asyncChartRenderer'
import { liquidGlass } from './liquidGlass'
import { showSuccess, showError } from './appleNotification'
import type { MarkdownConfig, RenderResult } from '../types'
import mermaid from 'mermaid'

// 配置marked选项
marked.setOptions({
  breaks: true,
  gfm: true
})

// 自定义渲染器
const renderer = new marked.Renderer()

// 增强代码块渲染
const originalCodeRenderer = renderer.code
renderer.code = function(code: string, language: string | undefined) {
  const lang = language || ''
  
  // 检查是否为图表类型
  if (['mermaid', 'plantuml', 'kroki'].includes(lang.toLowerCase())) {
    return renderChartBlock(code, lang.toLowerCase() as 'mermaid' | 'plantuml' | 'kroki')
  }
  
  // 普通代码块处理 - 手动高亮
  let highlighted = code
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(code, { language: lang }).value
    } catch (err) {
      console.warn('语法高亮失败:', err)
      highlighted = hljs.highlightAuto(code).value
    }
  } else {
    highlighted = hljs.highlightAuto(code).value
  }
  
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
        <pre><code class="hljs language-${lang}">${highlighted}</code></pre>
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
      // 直接渲染Mermaid图表
      if (chartType === 'mermaid') {
        await renderMermaidChart(code, containerElement)
      } else {
        // 其他图表类型使用异步渲染器
        await asyncChartRenderer.renderChart({
          type: chartType,
          content: code,
          containerId: chartId,
          timeout: 15000,
          retryCount: 3,
          cacheEnabled: true
        })
      }
      
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

// 渲染Mermaid图表
async function renderMermaidChart(content: string, container: HTMLElement): Promise<void> {
  // 初始化Mermaid
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
  })
  
  try {
    // 验证语法
    await mermaid.parse(content)
    
    // 生成唯一ID
    const chartId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // 渲染图表
    const { svg } = await mermaid.render(chartId, content)
    
    // 替换加载状态
    container.innerHTML = `
      <div class="chart-content">
        ${svg}
      </div>
    `
    
  } catch (error) {
    throw new Error(`Mermaid渲染失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 主渲染函数
export async function renderMarkdown(content: string): Promise<string> {
  try {
    // 预处理内容
    const processedContent = preprocessContent(content)
    
    // 渲染markdown
    const html = await marked(processedContent, { renderer })
    
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
  let processedContent = content

  // 处理数学公式
  processedContent = processedContent.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
    return `<div class="math-block" data-formula="${encodeURIComponent(formula.trim())}">$$${formula}$$</div>`
  })

  processedContent = processedContent.replace(/\$(.*?)\$/g, (_, formula) => {
    return `<span class="math-inline" data-formula="${encodeURIComponent(formula.trim())}">$${formula}$</span>`
  })

  // 处理任务列表
  processedContent = processedContent.replace(/^(\s*)- \[([ x])\] (.+)$/gm, (_, indent, checked, text) => {
    const isChecked = checked === 'x'
    return `${indent}- ${isChecked ? '[x]' : '[ ]'} ${text}`
  })

  // 处理警告框
  processedContent = processedContent.replace(/^> \*\*(注意|警告|提示|信息):\*\* (.+)$/gm, (_, type, text) => {
    const alertType = type === '警告' ? 'warning' : type === '注意' ? 'danger' : 'info'
    return `<div class="alert alert-${alertType}"><strong>${type}:</strong> ${text}</div>`
  })

  return processedContent
}

// 后处理HTML
function postprocessHTML(html: string): string {
  // 为标题添加锚点
  html = html.replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (_, level, text) => {
    const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
    return `<h${level} id="${id}">${text}<a class="header-anchor" href="#${id}" title="链接到此标题">#</a></h${level}>`
  })

  // 处理表格
  html = html.replace(/<table>/g, '<div class="table-responsive"><table class="enhanced-table">')
  html = html.replace(/<\/table>/g, '</table></div>')

  // 处理代码块
  html = html.replace(/<pre><code/g, '<pre class="hljs"><code class="hljs language-$1">')

  return html
}

// 窗口函数声明
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
window.copyCode = (codeId: string) => {
  const codeElement = document.getElementById(codeId)
  if (codeElement) {
    const code = codeElement.textContent || ''
    navigator.clipboard.writeText(code).then(() => {
      showSuccess('复制成功', '代码已复制到剪贴板')
    }).catch(() => {
      showError('复制失败', '无法复制代码到剪贴板')
    })
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
    if (chartType === 'mermaid') {
      await renderMermaidChart(code, containerElement)
    } else {
      await asyncChartRenderer.renderChart({
        type: chartType as 'mermaid' | 'plantuml' | 'kroki',
        content: code,
        containerId: chartId,
        timeout: 15000,
        retryCount: 3,
        cacheEnabled: false // 重试时不使用缓存
      })
    }
    
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

// 图片处理函数
window.handleImageLoad = (imageId: string) => {
  const container = document.getElementById(imageId)
  if (container) {
    const loading = container.querySelector('.image-loading')
    if (loading) loading.remove()
  }
}

window.handleImageError = (imageId: string) => {
  const container = document.getElementById(imageId)
  if (container) {
    container.innerHTML = `
      <div class="image-error">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" stroke-width="2"/>
          <path d="M16 16l16 16M32 16l-16 16" stroke="currentColor" stroke-width="2"/>
        </svg>
        <p>图片加载失败</p>
      </div>
    `
  }
}

window.openImageModal = (src: string, alt: string) => {
  // 创建图片模态框
  const modal = document.createElement('div')
  modal.className = 'image-modal'
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <img src="${src}" alt="${alt}">
        <button class="modal-close" onclick="this.closest('.image-modal').remove()">×</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}

/**
 * Markdown渲染器类
 */
export class MarkdownRenderer {
  private config: MarkdownConfig
  private chartCounter = 0

  constructor(config: MarkdownConfig) {
    this.config = config
  }

  updateConfig(config: MarkdownConfig): void {
    this.config = config
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
    // 处理块级数学公式
    content = content.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
      try {
        // 这里应该使用KaTeX渲染数学公式
        return `<div class="math-display">${formula}</div>`
      } catch (err) {
        console.warn('数学公式渲染失败:', err)
        return `<div class="math-error">公式渲染失败: ${formula}</div>`
      }
    })

    // 处理行内数学公式
    content = content.replace(/\$(.*?)\$/g, (_, formula) => {
      try {
        // 这里应该使用KaTeX渲染数学公式
        return `<span class="math-inline">${formula.trim()}</span>`
      } catch (err) {
        console.warn('数学公式渲染失败:', err)
        return `<span class="math-error">公式渲染失败: ${formula}</span>`
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
    content = content.replace(/```plantuml\s*\n([\s\S]*?)\n```/g, (_, chartContent) => {
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
      content = content.replace(regex, (_, chartContent) => {
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
    // 为代码块添加样式类
    html = html.replace(/<pre><code class="language-(\w+)">/g, '<pre class="hljs"><code class="hljs language-$1">')
    
    // 为表格添加响应式包装
    html = html.replace(/<table>/g, '<div class="table-responsive"><table class="table">')
    html = html.replace(/<\/table>/g, '</table></div>')
    
    // 为图片添加懒加载
    html = html.replace(/<img /g, '<img loading="lazy" ')
    
    return html
  }

  async renderCharts(): Promise<void> {
    // 这个方法由ChartRenderManager实现
    console.log('renderCharts方法需要由ChartRenderManager实现')
  }
}