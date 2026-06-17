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
    __mdCopyDelegationBound?: boolean
    retryChart: (chartId: string, chartType: string, code: string) => Promise<void>

    handleImageLoad: (imageId: string) => void
    handleImageError: (imageId: string) => void

    closeChartModal: () => void
  }
}

// 立即定义全局函数，确保在任何时候都可用
if (typeof window !== 'undefined') {
  // 强制定义全局函数，确保在任何时候都可用
  const defineGlobalFunctions = () => {
    // 复制代码：宿主页面 CSP 会阻止内联 onclick，故用全局函数 + 事件委托双保险
    window.copyCode = async (codeId: string) => {
      const codeElement = document.getElementById(codeId)
      if (!codeElement) return

      const codeText = codeElement.textContent || ''

      try {
        // navigator.clipboard 仅在安全上下文(https/扩展页)可用，失败时回退 execCommand
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(codeText)
        } else {
          copyViaExecCommand(codeText)
        }
        showSuccess('复制成功', '代码已复制到剪贴板')
      } catch (err) {
        // 主路径异常时再兜底一次 execCommand
        if (copyViaExecCommand(codeText)) {
          showSuccess('复制成功', '代码已复制到剪贴板')
        } else {
          console.error('复制失败:', err)
          showError('复制失败', '无法复制到剪贴板')
        }
      }
    }

    // 全局函数：切换图表源码显示




    // 全局函数：关闭图表放大模态框
    window.closeChartModal = () => {
      const modal = document.getElementById('chart-modal')
      if (modal) {
        modal.classList.remove('show')
        setTimeout(() => {
          modal.remove()
        }, 300)
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

  // execCommand 兜底复制：用于非安全上下文或 clipboard API 不可用时
  const copyViaExecCommand = (text: string): boolean => {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }

  // 事件委托：宿主页面 CSP 会阻止内联 onclick，故统一用委托触发复制（绑定一次）
  if (!window.__mdCopyDelegationBound) {
    window.__mdCopyDelegationBound = true
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const btn = target.closest('[data-action="copy-code"]') as HTMLElement | null
      if (!btn) return
      const codeId = btn.getAttribute('data-code-id')
      if (codeId) window.copyCode(codeId)
    })
  }

  // 立即定义函数
  defineGlobalFunctions()

  // 确保在DOM加载完成后也重新定义
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', defineGlobalFunctions)
  }

  // 确保在页面完全加载后也重新定义
  window.addEventListener('load', defineGlobalFunctions)
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
        <button class="copy-button" data-action="copy-code" data-code-id="${codeId}" title="复制代码">
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
renderer.code = function (code: string, language: string | undefined) {
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

    // 创建图表容器 - CSP友好版本，使用数据属性而非内联事件
    const chartHtml = `
      <div class="chart-wrapper">
        
        <div class="chart-container chart-action-container" 
             id="${chartId}" 
             data-chart-type="${analysis.type}" 
             data-chart-id="${chartId}" 
             data-action="open-modal"
             title="双击放大查看">
          <div class="chart-loading">
            <div class="loading-spinner">
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
            </div>
            <div class="loading-text">正在渲染 ${analysis.type.toUpperCase()} 图表 (${analysis.chartRenderer === 'mermaid' ? 'Mermaid' : 'Kroki'})...</div>
          </div>
          <div class="chart-content"></div>
          <div class="chart-error" style="display: none;"></div>
          <div class="chart-fallback" style="display: none;">
            <div style="margin: 8px 0; font-size: 12px; color: #666;">
              图表渲染失败，显示为代码：
            </div>
            ${renderAsCode(code, lang, codeId)}
          </div>
        </div>
        <div class="chart-analysis-info" style="font-size: 12px; color: var(--md-text-secondary); margin-bottom: 12px; padding: 8px 12px; background: var(--md-bg-secondary); border-radius: 8px; border-left: 3px solid var(--md-accent-primary);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>📊 智能识别为${analysis.type}图表 (置信度: ${(analysis.confidence * 100).toFixed(1)}%)</span>
            <button class="view-source-btn chart-action-btn" 
                    data-action="toggle-source" 
                    data-chart-id="${chartId}" 
                    style="background: none; border: 1px solid var(--md-border-primary); border-radius: 4px; padding: 2px 8px; font-size: 11px; color: var(--md-text-secondary); cursor: pointer; transition: all 0.2s ease;">
              查看源码
            </button>
          </div>
          ${analysis.features.length > 0 ? `<div style="margin-top: 4px; font-size: 11px; color: var(--md-text-tertiary);">检测特征: ${analysis.features.slice(0, 2).join(', ')}${analysis.features.length > 2 ? '...' : ''}</div>` : ''}
          <div style="margin-top: 4px; font-size: 11px; color: var(--md-text-tertiary);">💡 双击图表可放大查看</div>
        </div>
        <div class="chart-source" id="${chartId}-source" style="display: none;">
          <div style="font-size: 12px; color: var(--md-text-secondary); margin-bottom: 8px; padding: 4px 8px; background: var(--md-bg-tertiary); border-radius: 4px;">
            原始 ${lang.toUpperCase()} 代码：
          </div>
          ${renderAsCode(code, lang, `${codeId}-source`)}
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

// 自定义图片渲染器 - 解决打印时图片丢失问题
renderer.image = function (href: string, title: string | null, text: string) {
  const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // 构建图片HTML，移除内联事件处理器，确保打印时图片正常显示
  let imageHtml = `<img src="${href}" alt="${text || ''}" id="${imageId}"`

  if (title) {
    imageHtml += ` title="${title}"`
  }

  // 确保打印时图片可见，添加数据属性用于事件委托
  imageHtml += ` class="markdown-image" data-image-id="${imageId}" data-clickable="true"`

  // 添加样式确保图片正确显示
  imageHtml += ` style="max-width: 100%; height: auto; cursor: pointer;"`

  imageHtml += ` />`

  // 简化容器结构，移除JavaScript依赖的加载状态
  return `
    <div class="image-container" data-image-container="${imageId}">
      ${imageHtml}
    </div>
  `
}

// 增强表格渲染
const originalTableRenderer = renderer.table
renderer.table = function (header: string, body: string) {
  const originalTable = originalTableRenderer.call(this, header, body)

  return `
    <div class="enhanced-table-container">
      <div class="table-wrapper">
        ${originalTable}
      </div>
    </div>
  `
}

// 自定义标题渲染器 - 添加ID和锚点
renderer.heading = function (text: string, level: number) {
  // 生成标题ID
  const headingId = text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff-]/g, '') // 保留中文字符
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') // 移除开头和结尾的连字符
  
  // 如果ID为空，使用随机ID
  const finalId = headingId || `heading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  return `<h${level} id="${finalId}" class="markdown-heading" data-level="${level}">${text}</h${level}>`
}

// 设置自定义渲染器
marked.use({ renderer })

/**
 * 目录项接口
 */
export interface TocItem {
  id: string
  text: string
  level: number
  children?: TocItem[]
}

/**
 * Markdown渲染器类 - 简化版
 */
export class MarkdownRenderer {
  private config: MarkdownConfig
  private tocItems: TocItem[] = []

  constructor(config: MarkdownConfig) {
    this.config = config
  }

  updateConfig(config: MarkdownConfig): void {
    this.config = config
  }

  /**
   * 获取目录数据
   */
  getTocItems(): TocItem[] {
    return this.tocItems
  }

  /**
   * 从内容中提取标题并生成目录
   */
  private extractTocFromContent(content: string): TocItem[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm
    const tocItems: TocItem[] = []
    let match

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fff-]/g, '') // 保留中文字符
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '') // 移除开头和结尾的连字符
      
      const finalId = id || `heading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      tocItems.push({
        id: finalId,
        text,
        level
      })
    }

    return tocItems
  }

  async render(content: string): Promise<RenderResult> {
    try {
      let processedContent = content
      const warnings: string[] = []

      // 提取目录
      this.tocItems = this.extractTocFromContent(processedContent)

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