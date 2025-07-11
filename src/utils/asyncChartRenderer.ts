import { showSuccess, showError } from './appleNotification'
import { localMermaidRenderer } from './localMermaidRenderer'

// 统一的图表渲染选项
export interface ChartRenderOptions {
  type: string // 支持所有Kroki图表类型
  content: string
  containerId: string
  timeout?: number
  retryCount?: number
  cacheEnabled?: boolean
}

// 统一的图表渲染结果
export interface ChartRenderResult {
  success: boolean
  content?: string
  error?: string
  renderTime?: number
  cached?: boolean
}

/**
 * 统一异步图表渲染器 - 基于Kroki服务
 * 支持Mermaid、PlantUML、GraphViz等所有Kroki支持的图表格式
 */
export class AsyncChartRenderer {
  private renderCache = new Map<string, string>()
  private defaultTimeout = 30000 // 增加到30秒
  private defaultRetryCount = 3

  // Kroki支持的所有图表类型
  private readonly supportedTypes = [
    'mermaid', 'plantuml', 'graphviz', 'blockdiag', 'seqdiag', 
    'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml',
    'ditaa', 'erd', 'excalidraw', 'nomnoml', 'svgbob', 'vega',
    'vegalite', 'wavedrom', 'wireviz', 'structurizr'
  ]

  /**
   * 渲染图表
   */
  async renderChart(options: ChartRenderOptions): Promise<ChartRenderResult> {
    const {
      type,
      content,
      containerId,
      timeout = this.defaultTimeout,
      retryCount = this.defaultRetryCount,
      cacheEnabled = true
    } = options

    const startTime = Date.now()

    try {
      // 验证图表类型
      if (!this.supportedTypes.includes(type.toLowerCase())) {
        throw new Error(`不支持的图表类型: ${type}`)
      }

      // 获取容器元素
      const container = document.getElementById(containerId)
      if (!container) {
        throw new Error(`找不到容器元素: ${containerId}`)
      }

      // 对于 Mermaid 图表，优先使用本地渲染
      if (type.toLowerCase() === 'mermaid') {
        console.log('使用本地 Mermaid 渲染器')
        
        try {
          const result = await localMermaidRenderer.renderMermaid(content, containerId)
          
          if (result.success) {
            const renderTime = Date.now() - startTime
            return {
              success: true,
              content: 'local-mermaid-rendered',
              renderTime,
              cached: false
            }
          } else {
            // 本地渲染失败，回退到 Kroki
            console.warn('本地 Mermaid 渲染失败，回退到 Kroki 服务')
          }
        } catch (error) {
          console.warn('本地 Mermaid 渲染异常，回退到 Kroki 服务:', error)
        }
      }

      console.log(`开始渲染${type}图表 (Kroki):`, content.substring(0, 50) + '...')

      // 尝试渲染，支持重试机制
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
          const result = await this.renderWithKroki(
            type, 
            content, 
            container, 
            timeout, 
            cacheEnabled && attempt === 1 // 只在第一次尝试时使用缓存
          )

          const renderTime = Date.now() - startTime

          // 显示成功通知
          showSuccess(
            '图表渲染完成',
            `${this.getTypeDisplayName(type)}图表已成功渲染 (${renderTime.toFixed(0)}ms)`,
            { 
              duration: 2000,
              liquidGlass: true
            }
          )

          return {
            success: true,
            content: result.content,
            renderTime,
            cached: result.cached
          }

        } catch (error) {
          lastError = error as Error
          console.warn(`${type}图表渲染失败 (尝试 ${attempt}/${retryCount}):`, error)
          
          if (attempt < retryCount) {
            // 等待一段时间后重试
            await this.delay(1000 * attempt)
          }
        }
      }

      // 所有重试都失败了
      const renderTime = Date.now() - startTime
      const errorMessage = lastError?.message || '渲染失败'
      
      this.showErrorInContainer(container, errorMessage, type)
      
      showError(
        '图表渲染失败', 
        `${this.getTypeDisplayName(type)}: ${errorMessage}`,
        { liquidGlass: true }
      )

      return {
        success: false,
        error: errorMessage,
        renderTime
      }

    } catch (error) {
      const renderTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      
      console.error('图表渲染异常:', error)
      
      showError(
        '图表渲染异常', 
        errorMessage,
        { liquidGlass: true }
      )

      return {
        success: false,
        error: errorMessage,
        renderTime
      }
    }
  }

  /**
   * 使用 Kroki POST API 渲染图表 - 简化方案
   */
  private async renderWithKroki(
    type: string, 
    content: string, 
    container: HTMLElement,
    timeout: number,
    useCache: boolean
  ): Promise<{ content: string; cached: boolean }> {
    // 生成缓存键
    const cacheKey = this.generateCacheKey(type, content)
    
    // 检查缓存
    if (useCache && this.renderCache.has(cacheKey)) {
      const cachedUrl = this.renderCache.get(cacheKey)!
      this.displayResult(container, cachedUrl)
      console.log(`${type}图表从缓存加载成功`)
      return { content: cachedUrl, cached: true }
    }

    try {
      // 使用 POST 方式直接发送图表代码
      const response = await fetch(`https://kroki.io/${type.toLowerCase()}/svg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: content.trim(),
        signal: AbortSignal.timeout(timeout)
      })

      if (!response.ok) {
        throw new Error(`Kroki API 错误: ${response.status} ${response.statusText}`)
      }

      // 获取 SVG 内容
      const svgContent = await response.text()
      
      // 创建 Blob URL 用于显示
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const imageUrl = URL.createObjectURL(blob)
      
      // 缓存结果
      if (useCache) {
        this.renderCache.set(cacheKey, imageUrl)
      }
      
      // 显示图表
      this.displayResult(container, imageUrl)
      console.log(`${type}图表渲染成功 (Kroki POST API)`)
      
      return { content: imageUrl, cached: false }
      
    } catch (error) {
      console.error(`${type}图表渲染失败:`, error)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`图表渲染超时（${(timeout/1000).toFixed(1)}秒），请检查网络连接`)
        } else if (error.message.includes('Failed to fetch')) {
          throw new Error('无法连接到 Kroki 服务器，请检查网络连接')
        } else {
          throw new Error(`图表渲染失败: ${error.message}`)
        }
      } else {
        throw new Error('图表渲染过程中发生未知错误')
      }
    }
  }



  /**
   * 简化的缓存键生成
   */
  private generateCacheKey(type: string, content: string): string {
    // 使用简单的哈希方法生成缓存键
    const combined = `${type}:${content.trim()}`
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return `kroki_${Math.abs(hash).toString(36)}`
  }

  /**
   * 在容器中显示渲染结果
   */
  private displayResult(container: HTMLElement, imageUrl: string): void {
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

    // 保留data-content属性，只更新显示内容
    const dataContent = contentElement.getAttribute('data-content')
    contentElement.innerHTML = `
      <img 
        src="${imageUrl}" 
        alt="Chart" 
        class="kroki-chart-image" 
        style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
        loading="lazy"
      />
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
  }

  /**
   * 在容器中显示错误信息
   */
  private showErrorInContainer(container: HTMLElement, message: string, type: string): void {
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
        <div class="error-title">图表渲染失败</div>
        <div class="error-message">${message}</div>
        <div class="error-actions">
          <button class="retry-button" onclick="retryChart('${container.id}', '${type}', \`${this.getContentFromContainer(container)}\`)">
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

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取图表类型的显示名称
   */
  private getTypeDisplayName(type: string): string {
    const typeNames: Record<string, string> = {
      mermaid: 'Mermaid',
      plantuml: 'PlantUML',
      graphviz: 'Graphviz',
      blockdiag: 'BlockDiag',
      seqdiag: 'SeqDiag',
      actdiag: 'ActDiag',
      nwdiag: 'NwDiag',
      packetdiag: 'PacketDiag',
      rackdiag: 'RackDiag',
      c4plantuml: 'C4-PlantUML',
      ditaa: 'Ditaa',
      erd: 'ERD',
      excalidraw: 'Excalidraw',
      nomnoml: 'Nomnoml',
      svgbob: 'SvgBob',
      vega: 'Vega',
      vegalite: 'Vega-Lite',
      wavedrom: 'WaveDrom',
      wireviz: 'WireViz',
      structurizr: 'Structurizr'
    }
    return typeNames[type.toLowerCase()] || type
  }

  /**
   * 获取支持的图表类型列表
   */
  getSupportedTypes(): string[] {
    return [...this.supportedTypes]
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.renderCache.clear()
    console.log('图表渲染缓存已清除')
  }

  /**
   * 获取缓存信息
   */
  getCacheInfo(): { size: number; keys: string[] } {
    return {
      size: this.renderCache.size,
      keys: Array.from(this.renderCache.keys())
    }
  }
}

// 导出单例实例
export const asyncChartRenderer = new AsyncChartRenderer()