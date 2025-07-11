/**
 * 统一图表渲染器 - 基于Kroki服务
 * 支持Mermaid、PlantUML、GraphViz等多种图表格式
 * 基于苹果设计哲学的简洁统一架构
 */

import type { MarkdownConfig } from '@/types'

// 图表渲染器接口
export interface ChartRenderer {
  readonly type: string
  supports(content: string): boolean
  render(content: string, element: HTMLElement): Promise<void>
  initialize(config: MarkdownConfig): void
}

// 基础图表渲染器
abstract class BaseChartRenderer implements ChartRenderer {
  protected config: MarkdownConfig
  
  constructor(config: MarkdownConfig) {
    this.config = config
  }

  abstract readonly type: string
  abstract supports(content: string): boolean
  abstract render(content: string, element: HTMLElement): Promise<void>

  initialize(config: MarkdownConfig): void {
    this.config = config
  }

  protected generateId(): string {
    return `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  protected generateCacheKey(content: string): string {
    return btoa(unescape(encodeURIComponent(`${this.type}-${content}`)))
  }

  protected showLoading(element: HTMLElement, message: string = '正在渲染图表...'): void {
    const loading = element.querySelector('.chart-loading') as HTMLElement
    if (loading) {
      loading.style.display = 'flex'
      const text = loading.querySelector('.loading-text')
      if (text) text.textContent = message
    }
  }

  protected hideLoading(element: HTMLElement): void {
    const loading = element.querySelector('.chart-loading')
    if (loading) loading.remove()
  }

  protected showError(element: HTMLElement, message: string): void {
    this.hideLoading(element)
    const errorElement = element.querySelector('.chart-error') as HTMLElement
    if (errorElement) {
      errorElement.innerHTML = `
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <div class="error-message">${message}</div>
        </div>
      `
      errorElement.style.display = 'block'
    }
  }

  protected showAsyncError(loadingElement: HTMLElement, errorElement: HTMLElement, message: string): void {
    if (loadingElement) loadingElement.style.display = 'none'
    if (errorElement) {
      errorElement.innerHTML = `
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <div class="error-message">${message}</div>
        </div>
      `
      errorElement.style.display = 'block'
    }
  }

  protected displayImage(contentElement: HTMLElement, imageUrl: string, loadingElement: HTMLElement): void {
    contentElement.innerHTML = `<img src="${imageUrl}" alt="Chart" style="max-width: 100%; height: auto;" />`
    if (loadingElement) loadingElement.style.display = 'none'
  }
}

// 统一Kroki渲染器 - 支持所有图表类型
export class UnifiedKrokiRenderer extends BaseChartRenderer {
  readonly type = 'kroki'
  
  // Kroki支持的所有图表类型
  private readonly supportedTypes = [
    'mermaid', 'plantuml', 'graphviz', 'blockdiag', 'seqdiag', 
    'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml',
    'ditaa', 'erd', 'excalidraw', 'nomnoml', 'svgbob', 'vega',
    'vegalite', 'wavedrom', 'wireviz', 'structurizr'
  ]
  
  private static renderCache = new Map<string, string>()
  private currentChartType: string = 'mermaid'

  constructor(config: MarkdownConfig, chartType: string = 'mermaid') {
    super(config)
    this.currentChartType = chartType
  }

  supports(content: string): boolean {
    // 根据内容或类型判断是否支持
    return this.supportedTypes.includes(this.currentChartType.toLowerCase())
  }

  async render(content: string, element: HTMLElement): Promise<void> {
    try {
      console.log(`开始渲染${this.currentChartType}图表 (Kroki):`, content.substring(0, 50) + '...')
      
      const contentElement = element.querySelector('.chart-content') as HTMLElement
      const loadingElement = element.querySelector('.chart-loading') as HTMLElement
      const errorElement = element.querySelector('.chart-error') as HTMLElement
      
      if (!contentElement) throw new Error('找不到图表内容容器')
      
      // 显示加载状态
      this.showLoading(element, `正在渲染${this.currentChartType.toUpperCase()}图表 (Kroki)...`)
      
      // 异步渲染图表
      await this.renderChartAsync(content, contentElement, loadingElement, errorElement)
      
    } catch (err) {
      console.error(`${this.currentChartType}渲染失败:`, err)
      this.showError(element, err instanceof Error ? err.message : '未知错误')
    }
  }

  private async renderChartAsync(
    content: string, 
    contentElement: HTMLElement, 
    loadingElement: HTMLElement, 
    errorElement: HTMLElement
  ): Promise<void> {
    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey(content)
      
      // 检查缓存
      if (UnifiedKrokiRenderer.renderCache.has(cacheKey)) {
        const cachedUrl = UnifiedKrokiRenderer.renderCache.get(cacheKey)!
        this.displayImage(contentElement, cachedUrl, loadingElement)
        console.log(`${this.currentChartType}图表从缓存加载成功`)
        return
      }
      
      // 生成Kroki图表URL
      const imageUrl = this.generateKrokiUrl(content)
      
      // 创建图片元素进行预加载
      const img = new Image()
      
      // 设置超时处理
      const timeoutId = setTimeout(() => {
        this.showAsyncError(loadingElement, errorElement, '图表加载超时，请稍后重试')
      }, 15000) // 15秒超时
      
      // 设置加载成功回调
      img.onload = () => {
        clearTimeout(timeoutId)
        // 缓存成功的URL
        UnifiedKrokiRenderer.renderCache.set(cacheKey, imageUrl)
        this.displayImage(contentElement, imageUrl, loadingElement)
        console.log(`${this.currentChartType}图表渲染成功 (Kroki)`)
      }
      
      // 设置加载失败回调
      img.onerror = () => {
        clearTimeout(timeoutId)
        this.showAsyncError(loadingElement, errorElement, `${this.currentChartType}图表加载失败，请检查网络连接或图表语法`)
      }
      
      // 开始加载图片
      img.src = imageUrl
      
    } catch (err) {
      this.showAsyncError(loadingElement, errorElement, err instanceof Error ? err.message : '渲染过程中发生未知错误')
    }
  }

  private generateKrokiUrl(content: string): string {
    // 使用Kroki API生成图表
    const encodedContent = btoa(unescape(encodeURIComponent(content)))
    return `https://kroki.io/${this.currentChartType}/svg/${encodedContent}`
  }

  // 设置当前图表类型
  setChartType(type: string): void {
    if (this.supportedTypes.includes(type.toLowerCase())) {
      this.currentChartType = type.toLowerCase()
    } else {
      console.warn(`不支持的图表类型: ${type}，将使用默认的mermaid类型`)
      this.currentChartType = 'mermaid'
    }
  }

  // 获取支持的图表类型列表
  getSupportedTypes(): string[] {
    return [...this.supportedTypes]
  }
}

// 图表渲染器工厂 - 简化版
export class ChartRendererFactory {
  private static renderers = new Map<string, ChartRenderer>()

  static register(renderer: ChartRenderer): void {
    this.renderers.set(renderer.type, renderer)
  }

  static create(type: string, config: MarkdownConfig): ChartRenderer {
    // 统一使用Kroki渲染器，支持所有图表类型
    return new UnifiedKrokiRenderer(config, type)
  }

  static getSupportedTypes(): string[] {
    return [
      'mermaid', 'plantuml', 'graphviz', 'blockdiag', 'seqdiag', 
      'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml',
      'ditaa', 'erd', 'excalidraw', 'nomnoml', 'svgbob', 'vega',
      'vegalite', 'wavedrom', 'wireviz', 'structurizr'
    ]
  }
}

// 图表渲染管理器 - 简化版
export class ChartRenderManager {
  private config: MarkdownConfig
  private renderer: UnifiedKrokiRenderer

  constructor(config: MarkdownConfig) {
    this.config = config
    this.renderer = new UnifiedKrokiRenderer(config)
  }

  async renderChart(type: string, content: string, element: HTMLElement): Promise<void> {
    try {
      // 设置图表类型
      this.renderer.setChartType(type)
      
      // 渲染图表
      await this.renderer.render(content, element)
      
    } catch (error) {
      console.error('图表渲染失败:', error)
      throw error
    }
  }

  async renderAllCharts(): Promise<void> {
    if (!this.config.enableMermaid && !this.config.enableCharts) return

    // 等待DOM完全渲染
    await new Promise(resolve => setTimeout(resolve, 100))

    // 获取所有图表元素
    const chartElements = document.querySelectorAll('[data-chart-type]')
    
    const renderPromises: Promise<void>[] = []

    chartElements.forEach(element => {
      const chartType = element.getAttribute('data-chart-type')
      const contentElement = element.querySelector('.chart-content')
      let content = ''

      // 获取图表内容
      if (contentElement) {
        content = contentElement.getAttribute('data-content') || contentElement.textContent || ''
        if (contentElement.hasAttribute('data-content')) {
          content = decodeURIComponent(content)
        }
      }

      if (chartType && content.trim()) {
        console.log(`发现${chartType}图表，准备渲染...`)
        // 所有图表都异步渲染，不阻塞页面
        this.renderChartAsync(chartType, content.trim(), element as HTMLElement)
      }
    })

    console.log('统一图表渲染管理器：所有图表已开始渲染')
  }

  private async renderChartAsync(chartType: string, content: string, element: HTMLElement): Promise<void> {
    try {
      await this.renderChart(chartType, content, element)
    } catch (error) {
      console.error(`${chartType}图表异步渲染失败:`, error)
      
      // 显示错误信息
      const errorElement = element.querySelector('.chart-error') as HTMLElement
      if (errorElement) {
        errorElement.innerHTML = `
          <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-message">图表渲染失败: ${error instanceof Error ? error.message : '未知错误'}</div>
            <div class="error-actions">
              <button class="retry-button" onclick="retryChart('${element.id}', '${chartType}', \`${content.replace(/`/g, '\\`')}\`)">
                重试
              </button>
            </div>
          </div>
        `
        errorElement.style.display = 'block'
      }
      
      // 隐藏加载状态
      const loadingElement = element.querySelector('.chart-loading')
      if (loadingElement) loadingElement.remove()
    }
  }

  // 获取支持的图表类型
  getSupportedTypes(): string[] {
    return this.renderer.getSupportedTypes()
  }
}

// 导出渲染器实例
export const chartRenderManager = new ChartRenderManager({
  enableMermaid: true,
  enableCharts: true
} as MarkdownConfig)