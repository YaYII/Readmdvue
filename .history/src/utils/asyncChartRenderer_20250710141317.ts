import { showSuccess, showError, showWarning } from './appleNotification'

export interface ChartRenderOptions {
  type: 'mermaid' | 'plantuml' | 'kroki'
  content: string
  containerId: string
  timeout?: number
  retryCount?: number
  cacheEnabled?: boolean
}

export interface ChartRenderResult {
  success: boolean
  containerId: string
  renderTime: number
  error?: string
  cached?: boolean
}

export interface ChartRenderState {
  loading: boolean
  success: boolean
  error: string | null
  renderTime: number
  retryCount: number
}

/**
 * 异步图表渲染管理器类
 * 提供完整的异步渲染解决方案，包括加载状态、错误处理、重试机制和缓存
 */
export class AsyncChartRenderer {
  private renderCache = new Map<string, string>()
  private renderStates = new Map<string, ChartRenderState>()
  private renderPromises = new Map<string, Promise<ChartRenderResult>>()
  
  // 默认配置
  private defaultOptions = {
    timeout: 10000, // 10秒超时
    retryCount: 3,
    cacheEnabled: true
  }

  /**
   * 渲染图表
   * @param options 渲染选项
   * @returns Promise<ChartRenderResult>
   */
  async renderChart(options: ChartRenderOptions): Promise<ChartRenderResult> {
    const { containerId, content, type } = options
    const mergedOptions = { ...this.defaultOptions, ...options }
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(type, content)
    
    // 检查是否已有相同的渲染任务在进行
    if (this.renderPromises.has(containerId)) {
      return this.renderPromises.get(containerId)!
    }
    
    // 初始化渲染状态
    this.initRenderState(containerId)
    
    // 创建渲染Promise
    const renderPromise = this.performRender(options, cacheKey, mergedOptions)
    this.renderPromises.set(containerId, renderPromise)
    
    try {
      const result = await renderPromise
      return result
    } finally {
      // 清理Promise引用
      this.renderPromises.delete(containerId)
    }
  }

  /**
   * 执行实际的渲染操作
   */
  private async performRender(
    options: ChartRenderOptions,
    cacheKey: string,
    mergedOptions: ChartRenderOptions
  ): Promise<ChartRenderResult> {
    const { containerId, type, content } = options
    const startTime = performance.now()
    
    try {
      // 更新加载状态
      this.updateRenderState(containerId, { loading: true, error: null })
      this.showLoadingState(containerId, type)
      
      // 检查缓存
      if (mergedOptions.cacheEnabled && this.renderCache.has(cacheKey)) {
        const cachedResult = this.renderCache.get(cacheKey)!
        await this.simulateMinimumLoadingTime(500) // 最小加载时间，避免闪烁
        
        this.showSuccessState(containerId, cachedResult)
        const renderTime = performance.now() - startTime
        
        this.updateRenderState(containerId, {
          loading: false,
          success: true,
          renderTime
        })
        
        return {
          success: true,
          containerId,
          renderTime,
          cached: true
        }
      }
      
      // 执行渲染
      const result = await this.executeRender(type, content, mergedOptions.timeout!)
      
      // 缓存结果
      if (mergedOptions.cacheEnabled) {
        this.renderCache.set(cacheKey, result)
      }
      
      // 显示成功状态
      this.showSuccessState(containerId, result)
      const renderTime = performance.now() - startTime
      
      this.updateRenderState(containerId, {
        loading: false,
        success: true,
        renderTime
      })
      
      // 显示成功通知（仅在非缓存情况下）
      if (!result.cached) {
        showSuccess(
          '图表渲染完成',
          `${this.getTypeDisplayName(type)}图表已成功渲染 (${renderTime.toFixed(0)}ms)`,
          { 
            duration: 2000,
            liquidGlass: true
          }
        )
      }
      
      return {
        success: true,
        containerId,
        renderTime,
        cached: false
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '渲染失败'
      const renderTime = performance.now() - startTime
      
      // 检查是否需要重试
      const currentState = this.renderStates.get(containerId)!
      if (currentState.retryCount < mergedOptions.retryCount!) {
        this.updateRenderState(containerId, {
          retryCount: currentState.retryCount + 1
        })
        
        // 显示重试状态
        this.showRetryState(containerId, currentState.retryCount + 1, mergedOptions.retryCount!)
        
        // 延迟重试
        await this.delay(1000 * (currentState.retryCount + 1))
        
        // 递归重试
        return this.performRender(options, cacheKey, mergedOptions)
      }
      
      // 显示错误状态
      this.showErrorState(containerId, errorMessage)
      
      this.updateRenderState(containerId, {
        loading: false,
        success: false,
        error: errorMessage,
        renderTime
      })
      
      // 显示错误通知
      showError(
        '图表渲染失败',
        `${this.getTypeDisplayName(type)}图表渲染失败: ${errorMessage}`,
        {
          persistent: true,
          liquidGlass: true,
          actions: [
            {
              label: '重试',
              action: () => {
                this.performRender(options, cacheKey, mergedOptions)
              },
              style: 'primary'
            },
            {
              label: '查看详情',
              action: () => {
                console.error('图表渲染详情:', {
                  type,
                  content: options.content,
                  error: errorMessage,
                  renderTime,
                  retryCount: currentState.retryCount
                })
              },
              style: 'secondary'
            }
          ]
        }
      )
      
      return {
        success: false,
        containerId,
        renderTime,
        error: errorMessage
      }
    }
  }

  /**
   * 执行具体的图表渲染
   */
  private async executeRender(type: string, content: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`渲染超时 (${timeout}ms)`))
      }, timeout)
      
      // 模拟异步渲染过程
      this.simulateChartRender(type, content)
        .then(result => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * 模拟图表渲染过程
   */
  private async simulateChartRender(type: string, content: string): Promise<string> {
    // 模拟网络请求和渲染时间
    const renderTime = Math.random() * 2000 + 1000 // 1-3秒
    await this.delay(renderTime)
    
    // 模拟渲染结果
    switch (type) {
      case 'mermaid':
        return this.generateMermaidResult(content)
      case 'plantuml':
        return this.generatePlantUMLResult(content)
      case 'kroki':
        return this.generateKrokiResult(content)
      default:
        throw new Error(`不支持的图表类型: ${type}`)
    }
  }

  /**
   * 生成Mermaid渲染结果
   */
  private generateMermaidResult(content: string): string {
    return `
      <div class="mermaid-result">
        <svg viewBox="0 0 400 300" style="max-width: 100%; height: auto;">
          <rect width="400" height="300" fill="url(#mermaidGradient)" rx="8"/>
          <defs>
            <linearGradient id="mermaidGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
          </defs>
          <text x="200" y="120" text-anchor="middle" fill="white" font-size="16" font-weight="600">
            🎉 Mermaid图表渲染完成
          </text>
          <text x="200" y="150" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="14">
            异步渲染确保了流畅的用户体验
          </text>
          <text x="200" y="180" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="12">
            内容长度: ${content.length} 字符
          </text>
        </svg>
      </div>
    `
  }

  /**
   * 生成PlantUML渲染结果
   */
  private generatePlantUMLResult(content: string): string {
    return `
      <div class="plantuml-result">
        <div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
          <h3 style="margin: 0 0 16px 0;">🎉 PlantUML图表渲染完成</h3>
          <p style="margin: 0; opacity: 0.9;">
            异步渲染确保了流畅的用户体验<br>
            支持复杂的UML图表和流程图
          </p>
          <div style="margin-top: 20px; padding: 12px; background: rgba(255,255,255,0.2); border-radius: 6px; font-size: 14px;">
            ✅ 渲染完成 | 📊 图表类型: PlantUML | 🔄 内容: ${content.substring(0, 50)}...
          </div>
        </div>
      </div>
    `
  }

  /**
   * 生成Kroki渲染结果
   */
  private generateKrokiResult(content: string): string {
    return `
      <div class="kroki-result">
        <div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border-radius: 8px;">
          <h3 style="margin: 0 0 16px 0;">🎉 Kroki图表渲染完成</h3>
          <p style="margin: 0; opacity: 0.9;">
            支持多种图表格式的异步渲染<br>
            GraphViz, BlockDiag, SeqDiag 等
          </p>
          <div style="margin-top: 20px; padding: 12px; background: rgba(255,255,255,0.2); border-radius: 6px; font-size: 14px;">
            ✅ 渲染完成 | 📊 图表类型: Kroki | 📝 内容长度: ${content.length}
          </div>
        </div>
      </div>
    `
  }

  /**
   * 显示加载状态
   */
  private showLoadingState(containerId: string, type: string): void {
    const container = document.getElementById(containerId)
    if (!container) return
    
    const loadingElement = container.querySelector('.chart-loading')
    const contentElement = container.querySelector('.chart-content')
    const errorElement = container.querySelector('.chart-error')
    
    if (loadingElement) {
      loadingElement.textContent = `正在渲染${this.getTypeDisplayName(type)}图表...`
      ;(loadingElement as HTMLElement).style.display = 'flex'
    }
    if (contentElement) (contentElement as HTMLElement).style.display = 'none'
    if (errorElement) (errorElement as HTMLElement).style.display = 'none'
  }

  /**
   * 显示成功状态
   */
  private showSuccessState(containerId: string, result: string): void {
    const container = document.getElementById(containerId)
    if (!container) return
    
    const loadingElement = container.querySelector('.chart-loading')
    const contentElement = container.querySelector('.chart-content')
    const errorElement = container.querySelector('.chart-error')
    
    if (loadingElement) (loadingElement as HTMLElement).style.display = 'none'
    if (contentElement) {
      (contentElement as HTMLElement).innerHTML = result
      ;(contentElement as HTMLElement).style.display = 'block'
    }
    if (errorElement) (errorElement as HTMLElement).style.display = 'none'
  }

  /**
   * 显示错误状态
   */
  private showErrorState(containerId: string, error: string): void {
    const container = document.getElementById(containerId)
    if (!container) return
    
    const loadingElement = container.querySelector('.chart-loading')
    const contentElement = container.querySelector('.chart-content')
    const errorElement = container.querySelector('.chart-error')
    
    if (loadingElement) (loadingElement as HTMLElement).style.display = 'none'
    if (contentElement) (contentElement as HTMLElement).style.display = 'none'
    if (errorElement) {
      (errorElement as HTMLElement).innerHTML = `
        <div style="padding: 20px; text-align: center; color: #c62828;">
          <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 600; margin-bottom: 8px;">渲染失败</div>
          <div style="font-size: 14px; opacity: 0.8;">${error}</div>
          <button onclick="window.retryChartRender('${containerId}')" 
                  style="margin-top: 12px; padding: 8px 16px; background: #c62828; color: white; border: none; border-radius: 4px; cursor: pointer;">
            重试
          </button>
        </div>
      `
      ;(errorElement as HTMLElement).style.display = 'block'
    }
  }

  /**
   * 显示重试状态
   */
  private showRetryState(containerId: string, currentRetry: number, maxRetries: number): void {
    const container = document.getElementById(containerId)
    if (!container) return
    
    const loadingElement = container.querySelector('.chart-loading')
    if (loadingElement) {
      loadingElement.textContent = `重试中... (${currentRetry}/${maxRetries})`
    }
  }

  /**
   * 工具方法
   */
  private generateCacheKey(type: string, content: string): string {
    return `${type}:${this.hashCode(content)}`
  }

  private hashCode(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString()
  }

  private initRenderState(containerId: string): void {
    this.renderStates.set(containerId, {
      loading: false,
      success: false,
      error: null,
      renderTime: 0,
      retryCount: 0
    })
  }

  private updateRenderState(containerId: string, updates: Partial<ChartRenderState>): void {
    const currentState = this.renderStates.get(containerId)
    if (currentState) {
      Object.assign(currentState, updates)
    }
  }

  private getTypeDisplayName(type: string): string {
    const typeNames = {
      mermaid: 'Mermaid',
      plantuml: 'PlantUML',
      kroki: 'Kroki'
    }
    return typeNames[type as keyof typeof typeNames] || type
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async simulateMinimumLoadingTime(ms: number): Promise<void> {
    await this.delay(ms)
  }

  /**
   * 公共方法
   */
  
  /**
   * 获取渲染状态
   */
  getRenderState(containerId: string): ChartRenderState | null {
    return this.renderStates.get(containerId) || null
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.renderCache.clear()
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.renderCache.size,
      keys: Array.from(this.renderCache.keys())
    }
  }

  /**
   * 取消渲染
   */
  cancelRender(containerId: string): void {
    this.renderPromises.delete(containerId)
    this.renderStates.delete(containerId)
  }
}

// 创建全局实例
export const asyncChartRenderer = new AsyncChartRenderer()

// 全局重试函数
declare global {
  interface Window {
    retryChartRender: (containerId: string) => void
  }
}

window.retryChartRender = (containerId: string) => {
  const container = document.getElementById(containerId)
  if (container) {
    const chartType = container.getAttribute('data-chart-type') || 'mermaid'
    const chartContent = container.querySelector('.chart-content')?.getAttribute('data-content') || ''
    
    if (chartContent) {
      asyncChartRenderer.renderChart({
        type: chartType as any,
        content: decodeURIComponent(chartContent),
        containerId
      })
    }
  }
}