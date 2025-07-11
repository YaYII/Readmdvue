import { marked } from 'marked'
import hljs from 'highlight.js'
import { asyncChartRenderer } from './asyncChartRenderer'
import { liquidGlass } from './liquidGlass'
import { showSuccess, showError } from './appleNotification'
import { CodeBlockAnalyzer } from './codeBlockAnalyzer'
import type { MarkdownConfig, RenderResult } from '../types'

// 声明全局window方法
declare global {
  interface Window {
    copyCode: (codeId: string) => Promise<void>
    retryChart: (chartId: string, chartType: string, code: string) => Promise<void>
    handleImageLoad: (imageId: string) => void
    handleImageError: (imageId: string) => void
  }
}

// 立即定义全局函数，确保在任何时候都可用
if (typeof window !== 'undefined') {
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
    console.log('retryChart 被调用:', { chartId, chartType, code: code.substring(0, 50) + '...' })
    
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
      // 所有图表重试都通过统一的异步渲染器处理，增加超时时间
      await asyncChartRenderer.renderChart({
        type: chartType as any,
        content: code,
        containerId: chartId,
        timeout: 30000, // 增加到30秒
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
}

// 配置marked选项
marked.setOptions({
  breaks: true,
  gfm: true
})

// 渲染为代码的独立函数
function renderAsCode(code: string, lang: string, codeId: string): string {
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

// 自定义渲染器
const renderer = new marked.Renderer() as any

// 增强代码块渲染 - 集成智能分析
renderer.code = function(code: string, language: string | undefined) {
  const lang = language || 'text'
  const codeId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // 使用智能分析器判断代码块类型
  const analysis = CodeBlockAnalyzer.analyze(lang, code)
  
  console.log(`代码块分析结果:`, {
    language: lang,
    shouldRenderAsChart: analysis.shouldRenderAsChart,
    confidence: analysis.confidence,
    reason: analysis.reason,
    features: analysis.features
  })

  // 如果应该渲染为图表
  if (analysis.shouldRenderAsChart && analysis.chartRenderer) {
    const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // 创建图表容器
    const chartHtml = `
      <div class="chart-container" id="${chartId}" data-chart-type="${analysis.type}" data-chart-id="${chartId}">
        <div class="chart-analysis-info" style="font-size: 12px; color: #666; margin-bottom: 8px; padding: 4px 8px; background: rgba(0,0,0,0.05); border-radius: 4px;">
          <span>📊 智能识别为${analysis.type}图表 (置信度: ${(analysis.confidence * 100).toFixed(1)}%)</span>
          ${analysis.features.length > 0 ? `<br><small>检测特征: ${analysis.features.slice(0, 2).join(', ')}${analysis.features.length > 2 ? '...' : ''}</small>` : ''}
        </div>
        <div class="chart-loading">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <div class="loading-text">正在渲染 ${analysis.type.toUpperCase()} 图表 (${analysis.chartRenderer === 'mermaid' ? 'Mermaid' : 'Kroki'})...</div>
        </div>
        <div class="chart-content" data-content="${encodeURIComponent(code)}"></div>
        <div class="chart-error" style="display: none;"></div>
        <div class="chart-fallback" style="display: none;">
          <div style="margin: 8px 0; font-size: 12px; color: #666;">
            图表渲染失败，显示为代码：
          </div>
          ${renderAsCode(code, lang, codeId)}
        </div>
      </div>
    `
    
    // 异步渲染图表
    setTimeout(async () => {
      const containerElement = document.getElementById(chartId)
      if (!containerElement) return
      
      try {
        await asyncChartRenderer.renderChart({
          type: analysis.type as any,
          content: code,
          containerId: chartId,
          timeout: 30000, // 增加到30秒
          retryCount: 2,
          cacheEnabled: true
        })
        
        // 应用Liquid Glass效果
        liquidGlass.applyLiquidGlass(containerElement, {
          opacity: 0.95,
          blur: 15,
          borderRadius: 12
        })
        
        showSuccess('图表渲染完成', `${analysis.type.toUpperCase()} 图表已成功渲染`)
        
      } catch (error) {
        console.error('Chart render error:', error)
        
        // 渲染失败时显示为代码
        const fallbackElement = containerElement.querySelector('.chart-fallback') as HTMLElement
        const loadingElement = containerElement.querySelector('.chart-loading') as HTMLElement
        const errorElement = containerElement.querySelector('.chart-error') as HTMLElement
        
        if (fallbackElement && loadingElement && errorElement) {
          loadingElement.style.display = 'none'
          errorElement.style.display = 'none'
          fallbackElement.style.display = 'block'
        }
        
        console.warn(`图表渲染失败，回退到代码显示: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }, 100)
    
    return chartHtml
  }
  
  // 显示为代码
  return renderAsCode(code, lang, codeId)
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

/**
 * Markdown渲染器类 - 简化版
 */
export class MarkdownRenderer {
  private config: MarkdownConfig

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

      // 渲染Markdown - 图表处理现在在代码渲染阶段进行智能分析
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