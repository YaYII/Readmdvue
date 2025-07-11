import { marked } from 'marked'
import hljs from 'highlight.js'
import { asyncChartRenderer } from './asyncChartRenderer'
import { liquidGlass } from './liquidGlass'
import { showSuccess, showError } from './appleNotification'
import type { MarkdownConfig, RenderResult } from '../types'

// 配置marked选项
marked.setOptions({
  breaks: true,
  gfm: true
})

// 自定义渲染器
const renderer = new marked.Renderer()

// 增强代码块渲染
renderer.code = function(code: string, language: string | undefined) {
  const lang = language || ''
  
  // 检查是否为图表类型 - 所有图表类型都通过Kroki处理
  if (isSupportedChartType(lang.toLowerCase())) {
    return renderChartBlock(code, lang.toLowerCase())
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

// 设置自定义渲染器
marked.use({ renderer })

// 检查是否为支持的图表类型
function isSupportedChartType(type: string): boolean {
  const supportedTypes = [
    'mermaid', 'plantuml', 'graphviz', 'blockdiag', 'seqdiag', 
    'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml',
    'ditaa', 'erd', 'excalidraw', 'nomnoml', 'svgbob', 'vega',
    'vegalite', 'wavedrom', 'wireviz', 'structurizr'
  ]
  return supportedTypes.includes(type)
}

// 渲染图表块 - 统一使用Kroki
function renderChartBlock(code: string, chartType: string): string {
  const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // 创建统一的图表容器
  const container = `
    <div class="enhanced-chart-container" id="${chartId}" data-chart-type="${chartType}">
      <div class="chart-loading">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
        <div class="loading-text">正在渲染 ${chartType.toUpperCase()} 图表 (Kroki)...</div>
      </div>
      <div class="chart-content" data-content="${encodeURIComponent(code)}"></div>
      <div class="chart-error" style="display: none;"></div>
    </div>
  `
  
  // 异步渲染图表 - 统一使用Kroki
  setTimeout(async () => {
    const containerElement = document.getElementById(chartId)
    if (!containerElement) return
    
    try {
      // 所有图表类型都通过统一的异步渲染器处理
      await asyncChartRenderer.renderChart({
        type: chartType as any,
        content: code,
        containerId: chartId,
        timeout: 15000,
        retryCount: 3,
        cacheEnabled: true
      })
      
      // 应用Liquid Glass效果
      liquidGlass.applyLiquidGlass(containerElement, {
        opacity: 0.95,
        blur: 15,
        borderRadius: 12
      })
      
      showSuccess('图表渲染完成', `${chartType.toUpperCase()} 图表已成功渲染 (Kroki)`)
      
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

// 复制代码函数
window.copyCode = async (codeId: string) => {
  const codeElement = document.getElementById(codeId)
  if (!codeElement) return

  const codeText = codeElement.textContent || ''
  
  try {
    await navigator.clipboard.writeText(codeText)
    showSuccess('复制成功', '代码已复制到剪贴板')
  } catch (err) {
    console.error('复制失败:', err)
    showError('复制失败', '无法复制到剪贴板')
  }
}

// 重试图表渲染函数 - 统一处理
window.retryChart = async (chartId: string, chartType: string, code: string) => {
  const containerElement = document.getElementById(chartId)
  if (!containerElement) {
    console.error('找不到图表容器:', chartId)
    return
  }
  
  // 重置容器状态
  containerElement.innerHTML = `
    <div class="chart-loading">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      <div class="loading-text">重新渲染 ${chartType.toUpperCase()} 图表 (Kroki)...</div>
    </div>
    <div class="chart-content" data-content="${encodeURIComponent(code)}"></div>
    <div class="chart-error" style="display: none;"></div>
  `
  
  try {
    // 所有图表重试都通过统一的异步渲染器处理
    await asyncChartRenderer.renderChart({
      type: chartType as any,
      content: code,
      containerId: chartId,
      timeout: 15000,
      retryCount: 3,
      cacheEnabled: false // 重试时不使用缓存
    })
    
    liquidGlass.applyLiquidGlass(containerElement, {
      opacity: 0.95,
      blur: 15,
      borderRadius: 12
    })
    
    showSuccess('图表渲染完成', `${chartType.toUpperCase()} 图表重试渲染成功 (Kroki)`)
    
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
        <div class="error-message">请检查图表语法是否正确或网络连接</div>
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
    const loading = container.querySelector('.image-loading')
    const img = container.querySelector('img')
    if (loading) loading.remove()
    if (img) {
      img.style.display = 'none'
      container.innerHTML += '<div class="image-error">图片加载失败</div>'
    }
  }
}

/**
 * Markdown渲染器类 - 简化版
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

      // 预处理图表 - 统一处理
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
    // 行内数学公式
    content = content.replace(/\$([^$\n]+)\$/g, '<span class="math-inline">$1</span>')
    
    // 块级数学公式
    content = content.replace(/\$\$([\s\S]+?)\$\$/g, '<div class="math-block">$1</div>')
    
    return content
  }

  private async processCharts(content: string): Promise<{ content: string; warnings: string[] }> {
    const warnings: string[] = []
    let processedContent = content

    // 统一处理所有图表类型
    const supportedTypes = [
      'mermaid', 'plantuml', 'graphviz', 'blockdiag', 'seqdiag', 
      'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml',
      'ditaa', 'erd', 'excalidraw', 'nomnoml', 'svgbob', 'vega',
      'vegalite', 'wavedrom', 'wireviz', 'structurizr'
    ]

    for (const chartType of supportedTypes) {
      const regex = new RegExp(`\`\`\`${chartType}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'g')
      const matches = [...processedContent.matchAll(regex)]
      
      for (const match of matches) {
        try {
          const chartId = `${chartType}-${++this.chartCounter}`
          const chartContent = match[1].trim()
          
          if (!chartContent) {
            warnings.push(`${chartType}图表内容为空`)
            continue
          }

          const chartHtml = `
            <div class="chart-container" data-chart-type="${chartType}" data-chart-id="${chartId}">
              <div class="chart-loading">正在渲染${chartType}图表 (Kroki)...</div>
              <div class="chart-content" data-content="${encodeURIComponent(chartContent)}"></div>
              <div class="chart-error" style="display: none;"></div>
            </div>
          `
          
          processedContent = processedContent.replace(match[0], chartHtml)
        } catch (err) {
          warnings.push(`${chartType}图表处理失败: ${err instanceof Error ? err.message : '未知错误'}`)
        }
      }
    }

    return { content: processedContent, warnings }
  }

  private postProcess(htmlContent: string): string {
    // 添加增强样式类
    let processedContent = htmlContent
    
    // 增强表格
    processedContent = processedContent.replace(
      /<table>/g, 
      '<table class="enhanced-table">'
    )
    
    // 增强引用块
    processedContent = processedContent.replace(
      /<blockquote>/g, 
      '<blockquote class="enhanced-blockquote">'
    )
    
    // 增强列表
    processedContent = processedContent.replace(
      /<ul>/g, 
      '<ul class="enhanced-list">'
    )
    
    processedContent = processedContent.replace(
      /<ol>/g, 
      '<ol class="enhanced-list enhanced-list-ordered">'
    )
    
    return processedContent
  }
}

// 导出默认渲染器实例
export const markdownRenderer = new MarkdownRenderer({
  enableMermaid: true,
  enableCharts: true,
  enableMath: true,
  theme: 'light'
} as MarkdownConfig)