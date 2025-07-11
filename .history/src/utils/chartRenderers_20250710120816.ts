/**
 * 图表渲染器策略模式实现
 * 基于苹果设计哲学的模块化架构
 */

import type { MarkdownConfig } from '@/types'
import mermaid from 'mermaid'

// 图表渲染器接口
export interface ChartRenderer {
  readonly type: string
  supports(content: string): boolean
  render(content: string, element: HTMLElement): Promise<void>
  initialize(config: MarkdownConfig): void
}

// 抽象基类
abstract class BaseChartRenderer implements ChartRenderer {
  abstract readonly type: string
  protected config: MarkdownConfig
  protected static counter = 0

  constructor(config: MarkdownConfig) {
    this.config = config
  }

  abstract supports(content: string): boolean
  abstract render(content: string, element: HTMLElement): Promise<void>

  initialize(config: MarkdownConfig): void {
    this.config = config
  }

  protected generateId(): string {
    return `${this.type}-${++BaseChartRenderer.counter}`
  }

  protected showError(element: HTMLElement, message: string): void {
    const errorDiv = element.querySelector('.chart-error') as HTMLElement
    const loadingDiv = element.querySelector('.chart-loading') as HTMLElement
    
    if (loadingDiv) loadingDiv.style.display = 'none'
    if (errorDiv) {
      errorDiv.textContent = `渲染失败: ${message}`
      errorDiv.style.display = 'block'
    }
  }

  protected hideLoading(element: HTMLElement): void {
    const loadingDiv = element.querySelector('.chart-loading') as HTMLElement
    if (loadingDiv) loadingDiv.style.display = 'none'
  }
}

// Mermaid渲染器
export class MermaidRenderer extends BaseChartRenderer {
  readonly type = 'mermaid'

  supports(_content: string): boolean {
    return /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|xyChart|block|sankey)/.test(_content.trim())
  }

  initialize(config: MarkdownConfig): void {
    super.initialize(config)
    const theme = config.theme === 'dark' ? 'dark' : 'default'
    
    mermaid.initialize({
      theme,
      startOnLoad: false,
      fontFamily: 'PingFang SC, Microsoft YaHei UI, Segoe UI Variable, sans-serif',
      fontSize: 14,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35
      },
      gantt: {
        titleTopMargin: 25,
        barHeight: 20,
        fontSize: 11,
        gridLineStartPadding: 35,
        leftPadding: 75,
        rightPadding: 35
      }
    })
  }

  async render(content: string, element: HTMLElement): Promise<void> {
    try {
      console.log('正在渲染Mermaid图表:', content.substring(0, 50) + '...')
      
      // 验证语法
      await mermaid.parse(content)
      
      const contentElement = element.querySelector('.chart-content') as HTMLElement
      if (!contentElement) throw new Error('找不到图表内容容器')
      
      // 确保元素有唯一ID
      const chartId = this.generateId()
      contentElement.id = chartId
      
      const { svg } = await mermaid.render(chartId, content)
      contentElement.innerHTML = svg
      
      this.hideLoading(element)
      console.log('Mermaid图表渲染成功:', chartId)
      
    } catch (err) {
      console.error('Mermaid渲染失败:', err)
      this.showError(element, err instanceof Error ? err.message : '未知错误')
    }
  }
}

// Kroki渲染器 - 优化版异步渲染
export class KrokiRenderer extends BaseChartRenderer {
  readonly type: string
  private readonly krokiTypes = [
    'plantuml', 'graphviz', 'blockdiag', 'seqdiag', 'actdiag', 
    'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml'
  ]
  private static renderCache = new Map<string, string>()

  constructor(config: MarkdownConfig, type: string = 'plantuml') {
    super(config)
    this.type = type
  }

  supports(_content: string): boolean {
    return this.krokiTypes.includes(this.type)
  }

  async render(content: string, element: HTMLElement): Promise<void> {
    try {
      console.log(`开始异步渲染${this.type}图表:`, content.substring(0, 50) + '...')
      
      const contentElement = element.querySelector('.chart-content') as HTMLElement
      const loadingElement = element.querySelector('.chart-loading') as HTMLElement
      const errorElement = element.querySelector('.chart-error') as HTMLElement
      
      if (!contentElement) throw new Error('找不到图表内容容器')
      
      // 显示加载状态
      this.showLoading(element, `正在渲染${this.type.toUpperCase()}图表...`)
      
      // 异步渲染图表
      this.renderChartAsync(content, contentElement, loadingElement, errorElement)
      
    } catch (err) {
      console.error(`${this.type}渲染失败:`, err)
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
      if (KrokiRenderer.renderCache.has(cacheKey)) {
        const cachedUrl = KrokiRenderer.renderCache.get(cacheKey)!
        this.displayImage(contentElement, cachedUrl, loadingElement)
        console.log(`${this.type}图表从缓存加载成功`)
        return
      }
      
      // 生成图表URL
      const imageUrl = this.generateKrokiUrl(content)
      
      // 创建图片元素进行预加载
      const img = new Image()
      
      // 设置加载成功回调
      img.onload = () => {
        // 缓存成功的URL
        KrokiRenderer.renderCache.set(cacheKey, imageUrl)
        this.displayImage(contentElement, imageUrl, loadingElement)
        console.log(`${this.type}图表异步渲染成功`)
      }
      
      // 设置加载失败回调
      img.onerror = () => {
        this.showAsyncError(loadingElement, errorElement, '图表加载失败，请检查网络连接或图表语法')
      }
      
      // 设置超时处理
      const timeoutId = setTimeout(() => {
        this.showAsyncError(loadingElement, errorElement, '图表加载超时，请稍后重试')
      }, 10000) // 10秒超时
      
      // 开始加载图片
      img.src = imageUrl
      
      // 加载成功后清除超时
      img.onload = () => {
        clearTimeout(timeoutId)
        KrokiRenderer.renderCache.set(cacheKey, imageUrl)
        this.displayImage(contentElement, imageUrl, loadingElement)
        console.log(`${this.type}图表异步渲染成功`)
      }
      
    } catch (err) {
      this.showAsyncError(loadingElement, errorElement, err instanceof Error ? err.message : '渲染过程中发生未知错误')
    }
  }

  private generateKrokiUrl(content: string): string {
    const encodedContent = btoa(unescape(encodeURIComponent(content)))
    return `https://kroki.io/${this.type}/svg/${encodedContent}`
  }

  private generateCacheKey(content: string): string {
    // 使用简单的哈希算法生成缓存键
    let hash = 0
    const str = `${this.type}:${content}`
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return `${this.type}_${Math.abs(hash).toString(36)}`
  }

  private displayImage(contentElement: HTMLElement, imageUrl: string, loadingElement: HTMLElement): void {
    contentElement.innerHTML = `
      <img 
        src="${imageUrl}" 
        alt="${this.type} chart" 
        class="kroki-image" 
        style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
        loading="lazy"
      >`
    
    if (loadingElement) {
      loadingElement.style.display = 'none'
    }
  }

  private showLoading(element: HTMLElement, message: string): void {
    const loadingElement = element.querySelector('.chart-loading') as HTMLElement
    if (loadingElement) {
      loadingElement.textContent = message
      loadingElement.style.display = 'block'
    }
  }

  private showAsyncError(
    loadingElement: HTMLElement, 
    errorElement: HTMLElement, 
    message: string
  ): void {
    if (loadingElement) loadingElement.style.display = 'none'
    
    if (errorElement) {
      errorElement.innerHTML = `
        <div class="chart-error-content" style="
          padding: 16px; 
          background: #fee; 
          border: 1px solid #fcc; 
          border-radius: 8px; 
          color: #c33;
          font-size: 14px;
          text-align: center;
        ">
          <div style="margin-bottom: 8px;">⚠️ ${message}</div>
          <button 
            onclick="this.closest('.chart-container').dispatchEvent(new CustomEvent('retry-render'))"
            style="
              padding: 6px 12px; 
              background: #007AFF; 
              color: white; 
              border: none; 
              border-radius: 6px; 
              cursor: pointer;
              font-size: 12px;
            "
          >
            重试渲染
          </button>
        </div>
      `
      errorElement.style.display = 'block'
    }
    
    console.error(`${this.type}异步渲染失败:`, message)
  }

  // 添加重试机制
  setupRetryMechanism(element: HTMLElement, content: string): void {
    element.addEventListener('retry-render', () => {
      console.log(`重试渲染${this.type}图表`)
      this.render(content, element)
    })
  }
}

// 图表渲染器工厂
export class ChartRendererFactory {
  private static renderers = new Map<string, ChartRenderer>()

  static register(renderer: ChartRenderer): void {
    this.renderers.set(renderer.type, renderer)
  }

  static create(type: string, config: MarkdownConfig): ChartRenderer {
    switch (type) {
      case 'mermaid':
        return new MermaidRenderer(config)
      case 'plantuml':
      case 'graphviz':
      case 'blockdiag':
      case 'seqdiag':
      case 'actdiag':
      case 'nwdiag':
      case 'packetdiag':
      case 'rackdiag':
      case 'c4plantuml':
        return new KrokiRenderer(config, type)
      default:
        throw new Error(`不支持的图表类型: ${type}`)
    }
  }

  static getSupportedTypes(): string[] {
    return ['mermaid', 'plantuml', 'graphviz', 'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml']
  }
}

// 图表渲染管理器
export class ChartRenderManager {
  private config: MarkdownConfig
  private renderers = new Map<string, ChartRenderer>()

  constructor(config: MarkdownConfig) {
    this.config = config
    this.initializeRenderers()
  }

  updateConfig(config: MarkdownConfig): void {
    this.config = config
    this.renderers.forEach(renderer => renderer.initialize(config))
  }

  private initializeRenderers(): void {
    const supportedTypes = ChartRendererFactory.getSupportedTypes()
    supportedTypes.forEach(type => {
      try {
        const renderer = ChartRendererFactory.create(type, this.config)
        this.renderers.set(type, renderer)
      } catch (err) {
        console.warn(`无法初始化${type}渲染器:`, err)
      }
    })
  }

  async renderChart(type: string, content: string, element: HTMLElement): Promise<void> {
    const renderer = this.renderers.get(type)
    if (!renderer) {
      throw new Error(`找不到${type}类型的渲染器`)
    }

    if (!renderer.supports(content)) {
      throw new Error(`${type}渲染器不支持此内容`)
    }

    await renderer.render(content, element)
  }

  async renderAllCharts(): Promise<void> {
    if (!this.config.enableMermaid && !this.config.enableCharts) return

    // 等待DOM完全渲染
    await new Promise(resolve => setTimeout(resolve, 100))

    const renderPromises: Promise<void>[] = []

    // 渲染Mermaid图表
    if (this.config.enableMermaid) {
      const mermaidElements = document.querySelectorAll('.mermaid-chart')
      mermaidElements.forEach(element => {
        const contentElement = element.querySelector('.chart-content')
        const content = contentElement?.textContent?.trim()
        if (content) {
          renderPromises.push(this.renderChart('mermaid', content, element as HTMLElement))
        }
      })
    }

    // 渲染其他图表类型（异步模式）
    if (this.config.enableCharts) {
      const krokiElements = document.querySelectorAll('.kroki-chart, .plantuml-chart')
      krokiElements.forEach(element => {
        const chartType = element.getAttribute('data-chart-type') || 
                         (element.classList.contains('plantuml-chart') ? 'plantuml' : null)
        const contentElement = element.querySelector('.chart-content')
        const content = contentElement?.getAttribute('data-content')
        
        if (chartType && content) {
          const decodedContent = decodeURIComponent(content)
          
          // 异步渲染，不等待完成
          this.renderChartAsync(chartType, decodedContent, element as HTMLElement)
          
          // 设置重试机制
          this.setupRetryForElement(element as HTMLElement, chartType, decodedContent)
        }
      })
    }

    // 只等待Mermaid图表完成（因为它们是同步的）
    if (renderPromises.length > 0) {
      await Promise.allSettled(renderPromises)
    }
    
    console.log('图表渲染管理器：所有图表已开始渲染')
  }

  private async renderChartAsync(type: string, content: string, element: HTMLElement): Promise<void> {
    try {
      const renderer = this.renderers.get(type)
      if (!renderer) {
        throw new Error(`找不到${type}类型的渲染器`)
      }

      if (!renderer.supports(content)) {
        throw new Error(`${type}渲染器不支持此内容`)
      }

      // 异步渲染，不阻塞主线程
      await renderer.render(content, element)
    } catch (err) {
      console.error(`异步渲染${type}图表失败:`, err)
      this.showRenderError(element, err instanceof Error ? err.message : '渲染失败')
    }
  }

  private setupRetryForElement(element: HTMLElement, type: string, content: string): void {
    // 为Kroki渲染器设置重试机制
    const renderer = this.renderers.get(type)
    if (renderer instanceof KrokiRenderer) {
      renderer.setupRetryMechanism(element, content)
    }
  }

  private showRenderError(element: HTMLElement, message: string): void {
    const errorDiv = element.querySelector('.chart-error') as HTMLElement
    const loadingDiv = element.querySelector('.chart-loading') as HTMLElement
    
    if (loadingDiv) loadingDiv.style.display = 'none'
    if (errorDiv) {
      errorDiv.innerHTML = `
        <div style="
          padding: 12px; 
          background: #fee; 
          border: 1px solid #fcc; 
          border-radius: 6px; 
          color: #c33;
          font-size: 13px;
          text-align: center;
        ">
          ⚠️ ${message}
        </div>
      `
      errorDiv.style.display = 'block'
    }
  }
}