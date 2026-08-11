import mermaid from 'mermaid'
import { showSuccess, showError } from './appleNotification'

/**
 * 本地 Mermaid 渲染器
 * 使用本地 mermaid 库进行渲染，支持中文和复杂语法
 */
export class LocalMermaidRenderer {
  private static instance: LocalMermaidRenderer
  private initialized = false

  private constructor() {
    this.initializeMermaid()
  }

  static getInstance(): LocalMermaidRenderer {
    if (!LocalMermaidRenderer.instance) {
      LocalMermaidRenderer.instance = new LocalMermaidRenderer()
    }
    return LocalMermaidRenderer.instance
  }

  /**
   * 初始化 Mermaid
   */
  private initializeMermaid(): void {
    if (this.initialized) return

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'PingFang SC, Microsoft YaHei UI, SF Pro Display, Segoe UI Variable, sans-serif',
        fontSize: 14,
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        },
        sequence: {
          useMaxWidth: true,
          wrap: true
        },
        gantt: {
          useMaxWidth: true
        },
        journey: {
          useMaxWidth: true
        },
        gitGraph: {
          useMaxWidth: true
        }
      })

      this.initialized = true
      console.log('本地 Mermaid 渲染器初始化成功')
    } catch (error) {
      console.error('Mermaid 初始化失败:', error)
      throw new Error('Mermaid 初始化失败')
    }
  }

  /**
   * 渲染 Mermaid 图表
   */
  async renderMermaid(content: string, containerId: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now()

    try {
      // 确保 Mermaid 已初始化
      if (!this.initialized) {
        this.initializeMermaid()
      }

      // 获取容器元素
      const container = document.getElementById(containerId)
      if (!container) {
        throw new Error(`找不到容器元素: ${containerId}`)
      }

      console.log('开始本地 Mermaid 渲染:', content.substring(0, 50) + '...')

      // 清理内容
      const cleanContent = content.trim()
      
      // 验证 Mermaid 语法
      if (!this.validateMermaidSyntax(cleanContent)) {
        throw new Error('Mermaid 语法验证失败')
      }

      // 生成唯一的图表 ID
      const chartId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // 使用 mermaid.render 方法渲染
      const { svg } = await mermaid.render(chartId, cleanContent)

      // 显示渲染结果
      this.displayMermaidResult(container, svg)

      const renderTime = Date.now() - startTime

      // 显示成功通知
      showSuccess(
        '图表渲染完成',
        `Mermaid 图表已成功渲染 (${renderTime.toFixed(0)}ms)`,
        { 
          duration: 2000,
          liquidGlass: true
        }
      )

      console.log(`Mermaid 图表渲染成功 (本地渲染, ${renderTime}ms)`)

      return { success: true }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      
      console.error('本地 Mermaid 渲染失败:', error)
      
      // 显示错误信息
      const container = document.getElementById(containerId)
      if (container) {
        this.showMermaidError(container, errorMessage)
      }

      showError(
        'Mermaid 渲染失败', 
        errorMessage,
        { liquidGlass: true }
      )

      return { 
        success: false, 
        error: errorMessage 
      }
    }
  }

  /**
   * 验证 Mermaid 语法
   */
  private validateMermaidSyntax(content: string): boolean {
    try {
      // 基本语法检查
      const trimmedContent = content.trim()
      
      // 检查是否为空
      if (!trimmedContent) {
        return false
      }

      // 检查是否包含基本的 Mermaid 关键词
      const mermaidKeywords = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
        'stateDiagram', 'journey', 'gantt', 'pie', 'gitgraph',
        'erDiagram', 'mindmap', 'timeline'
      ]

      const hasValidKeyword = mermaidKeywords.some(keyword => 
        trimmedContent.toLowerCase().includes(keyword.toLowerCase())
      )

      if (!hasValidKeyword) {
        console.warn('Mermaid 内容缺少有效关键词')
        return false
      }

      return true
    } catch (error) {
      console.error('Mermaid 语法验证失败:', error)
      return false
    }
  }

  /**
   * 显示 Mermaid 渲染结果
   */
  private displayMermaidResult(container: HTMLElement, svg: string): void {
    // 隐藏加载状态
    const loading = container.querySelector('.chart-loading')
    if (loading) loading.remove()

    // 显示图表
    let contentElement = container.querySelector('.chart-content') as HTMLElement
    if (!contentElement) {
      contentElement = document.createElement('div')
      contentElement.className = 'chart-content'
      container.appendChild(contentElement)
    }

    // 保留data-content属性
    const dataContent = contentElement.getAttribute('data-content')
    
    // 设置 SVG 内容
    contentElement.innerHTML = `
      <div class="mermaid-chart-wrapper" style="
        width: 100%;
        max-width: 100%; 
        overflow-x: auto; 
        border-radius: 8px; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        padding: 16px;
      ">
        ${svg}
      </div>
    `
    
    // 恢复data-content属性
    if (dataContent) {
      contentElement.setAttribute('data-content', dataContent)
    }

    // 隐藏错误信息
    const errorElement = container.querySelector('.chart-error')
    if (errorElement) {
      (errorElement as HTMLElement).style.display = 'none'
    }

    // 应用样式优化
    this.optimizeMermaidSvg(contentElement)
  }

  /**
   * 优化 Mermaid SVG 样式
   */
  private optimizeMermaidSvg(container: HTMLElement): void {
    const svg = container.querySelector('svg')
    if (!svg) return

    // 设置响应式
    svg.style.width = '100%'
    svg.style.maxWidth = '100%'
    svg.style.height = 'auto'
    
    // 优化字体
    const textElements = svg.querySelectorAll('text')
    textElements.forEach(text => {
      text.style.fontFamily = 'PingFang SC, Microsoft YaHei UI, SF Pro Display, Segoe UI Variable, sans-serif'
    })

    // 优化颜色对比度
    const rectElements = svg.querySelectorAll('rect')
    rectElements.forEach(rect => {
      const fill = rect.getAttribute('fill')
      if (fill && fill.includes('#')) {
        // 确保足够的对比度
        rect.style.stroke = '#e1e5e9'
        rect.style.strokeWidth = '1px'
      }
    })
  }

  /**
   * 显示 Mermaid 错误信息
   */
  private showMermaidError(container: HTMLElement, message: string): void {
    // 隐藏加载状态
    const loading = container.querySelector('.chart-loading')
    if (loading) loading.remove()

    // 显示错误信息
    let errorElement = container.querySelector('.chart-error') as HTMLElement
    if (!errorElement) {
      errorElement = document.createElement('div')
      errorElement.className = 'chart-error'
      container.appendChild(errorElement)
    }

    errorElement.innerHTML = `
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Mermaid 图表渲染失败</div>
        <div class="error-message">${message}</div>
        <div class="error-actions">
          <button class="retry-button" onclick="retryChart('${container.id}', 'mermaid', \`${this.getContentFromContainer(container)}\`)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.65 2.35A8 8 0 1 0 16 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M16 4V8H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            重试
          </button>
        </div>
      </div>
    `
    errorElement.style.display = 'block'
  }

  /**
   * 从容器中获取图表内容
   */
  private getContentFromContainer(container: HTMLElement): string {
    const contentElement = container.querySelector('.chart-content')
    if (contentElement) {
      const dataContent = contentElement.getAttribute('data-content')
      if (dataContent) {
        return decodeURIComponent(dataContent).replace(/`/g, '\\`')
      }
      return (contentElement.textContent || '').replace(/`/g, '\\`')
    }
    return ''
  }
}

// 导出单例实例
export const localMermaidRenderer = LocalMermaidRenderer.getInstance()
