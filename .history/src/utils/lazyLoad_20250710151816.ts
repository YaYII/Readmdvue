/**
 * 组件懒加载系统
 * 基于苹果设计理念，提供流畅的组件加载体验
 */

import { defineAsyncComponent, type AsyncComponentLoader, type Component } from 'vue'
import { liquidGlass } from './liquidGlass'
import { showWarning } from './appleNotification'

export interface LazyLoadOptions {
  loadingComponent?: Component
  errorComponent?: Component
  delay?: number
  timeout?: number
  suspensible?: boolean
  retryCount?: number
  liquidGlass?: boolean
  showNotifications?: boolean
}

export interface LazyComponentConfig {
  loader: AsyncComponentLoader
  options?: LazyLoadOptions
  name?: string
}

/**
 * 懒加载管理器
 */
export class LazyLoadManager {
  private static instance: LazyLoadManager
  private loadingComponents = new Map<string, boolean>()
  private retryCounters = new Map<string, number>()
  
  static getInstance(): LazyLoadManager {
    if (!LazyLoadManager.instance) {
      LazyLoadManager.instance = new LazyLoadManager()
    }
    return LazyLoadManager.instance
  }

  /**
   * 创建懒加载组件
   */
  createLazyComponent(config: LazyComponentConfig): Component {
    const { loader, options = {}, name = 'LazyComponent' } = config
    
    const defaultOptions: LazyLoadOptions = {
      delay: 200,
      timeout: 10000,
      retryCount: 3,
      liquidGlass: true,
      showNotifications: true,
      ...options
    }

    return defineAsyncComponent({
      loader: this.createEnhancedLoader(loader, name, defaultOptions),
      loadingComponent: options.loadingComponent || this.createLoadingComponent(defaultOptions),
      errorComponent: options.errorComponent || this.createErrorComponent(name, defaultOptions),
      delay: defaultOptions.delay,
      timeout: defaultOptions.timeout,
      suspensible: defaultOptions.suspensible
    })
  }

  /**
   * 创建增强的加载器
   */
  private createEnhancedLoader(
    originalLoader: AsyncComponentLoader,
    name: string,
    options: LazyLoadOptions
  ): AsyncComponentLoader {
    return async () => {
      const startTime = performance.now()
      this.loadingComponents.set(name, true)
      
      try {
        const component = await originalLoader()
        const loadTime = performance.now() - startTime
        
        this.loadingComponents.delete(name)
        this.retryCounters.delete(name)
        
        // 性能监控
        if (loadTime > 3000 && options.showNotifications) {
          showWarning(
            '组件加载较慢',
            `${name} 组件加载耗时 ${loadTime.toFixed(0)}ms`,
            { duration: 3000 }
          )
        }
        
        return component
        
      } catch (error) {
        this.loadingComponents.delete(name)
        
        // 重试逻辑
        const retryCount = this.retryCounters.get(name) || 0
        if (retryCount < (options.retryCount || 3)) {
          this.retryCounters.set(name, retryCount + 1)
          
          // 延迟重试
          await this.delay(1000 * (retryCount + 1))
          return this.createEnhancedLoader(originalLoader, name, options)()
        }
        
        this.retryCounters.delete(name)
        throw error
      }
    }
  }

  /**
   * 创建加载组件
   */
  private createLoadingComponent(options: LazyLoadOptions): Component {
    return {
      name: 'LazyLoadingComponent',
      setup() {
        return () => {
          const element = document.createElement('div')
          element.className = 'lazy-loading-container'
          
          if (options.liquidGlass) {
            setTimeout(() => {
              liquidGlass.applyLiquidGlass(element, {
                opacity: 0.9,
                blur: 15,
                borderRadius: 12
              })
            }, 0)
          }
          
          return element
        }
      },
      template: `
        <div class="lazy-loading-container">
          <div class="loading-content">
            <div class="loading-spinner">
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
            </div>
            <div class="loading-text">正在加载组件...</div>
          </div>
        </div>
      `,
      style: `
        .lazy-loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          padding: 40px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .loading-content {
          text-align: center;
          color: #1d1d1f;
        }
        
        .loading-spinner {
          position: relative;
          width: 40px;
          height: 40px;
          margin: 0 auto 16px;
        }
        
        .spinner-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 2px solid transparent;
          border-top: 2px solid #007AFF;
          border-radius: 50%;
          animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        
        .spinner-ring:nth-child(1) { animation-delay: -0.45s; }
        .spinner-ring:nth-child(2) { animation-delay: -0.3s; }
        .spinner-ring:nth-child(3) { animation-delay: -0.15s; }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-text {
          font-size: 14px;
          font-weight: 500;
          color: #666;
        }
        
        @media (prefers-color-scheme: dark) {
          .lazy-loading-container {
            background: rgba(28, 28, 30, 0.8);
            color: #f5f5f7;
          }
          
          .loading-text {
            color: #a1a1a6;
          }
          
          .spinner-ring {
            border-top-color: #64D2FF;
          }
        }
      `
    }
  }

  /**
   * 创建错误组件
   */
  private createErrorComponent(name: string, _options: LazyLoadOptions): Component {
    return {
      name: 'LazyErrorComponent',
      props: ['error'],
      setup(props: any) {
        const retry = () => {
          window.location.reload()
        }
        
        return { retry, props }
      },
      template: `
        <div class="lazy-error-container">
          <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-title">组件加载失败</div>
            <div class="error-message">{{ props.error?.message || '未知错误' }}</div>
            <div class="error-details">
              <div><strong>组件:</strong> ${name}</div>
              <div><strong>错误类型:</strong> {{ props.error?.name || 'Error' }}</div>
            </div>
            <div class="error-actions">
              <button @click="retry" class="retry-button">
                🔄 重新加载
              </button>
            </div>
          </div>
        </div>
      `,
      style: `
        .lazy-error-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          padding: 40px;
          border-radius: 12px;
          background: rgba(255, 245, 245, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 59, 48, 0.2);
          text-align: center;
        }
        
        .error-content {
          max-width: 300px;
        }
        
        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .error-title {
          font-size: 18px;
          font-weight: 600;
          color: #c62828;
          margin-bottom: 8px;
        }
        
        .error-message {
          font-size: 14px;
          color: #666;
          margin-bottom: 16px;
          line-height: 1.4;
        }
        
        .error-details {
          background: rgba(255, 255, 255, 0.8);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
          font-size: 12px;
          text-align: left;
        }
        
        .error-details div {
          margin-bottom: 4px;
          color: #666;
        }
        
        .retry-button {
          background: #007AFF;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .retry-button:hover {
          background: #0056CC;
          transform: translateY(-1px);
        }
        
        @media (prefers-color-scheme: dark) {
          .lazy-error-container {
            background: rgba(40, 28, 28, 0.9);
          }
          
          .error-title {
            color: #ff6b6b;
          }
          
          .error-message {
            color: #a1a1a6;
          }
          
          .error-details {
            background: rgba(255, 255, 255, 0.1);
          }
          
          .error-details div {
            color: #a1a1a6;
          }
        }
      `
    }
  }

  /**
   * 批量创建懒加载组件
   */
  createLazyComponents(configs: Record<string, LazyComponentConfig>): Record<string, Component> {
    const components: Record<string, Component> = {}
    
    Object.entries(configs).forEach(([key, config]) => {
      components[key] = this.createLazyComponent({
        ...config,
        name: config.name || key
      })
    })
    
    return components
  }

  /**
   * 预加载组件
   */
  async preloadComponent(loader: AsyncComponentLoader): Promise<Component> {
    try {
      return await loader()
    } catch (error) {
      console.warn('组件预加载失败:', error)
      throw error
    }
  }

  /**
   * 批量预加载组件
   */
  async preloadComponents(loaders: AsyncComponentLoader[]): Promise<Component[]> {
    const results = await Promise.allSettled(
      loaders.map(loader => this.preloadComponent(loader))
    )
    
    const successful = results
      .filter((result): result is PromiseFulfilledResult<Component> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value)
    
    const failed = results
      .filter((result): result is PromiseRejectedResult => 
        result.status === 'rejected'
      )
      .length
    
    if (failed > 0) {
      console.warn(`${failed} 个组件预加载失败`)
    }
    
    return successful
  }

  /**
   * 获取加载状态
   */
  getLoadingStatus(): Record<string, boolean> {
    return Object.fromEntries(this.loadingComponents)
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.loadingComponents.clear()
    this.retryCounters.clear()
  }

  /**
   * 工具方法
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 创建全局实例
export const lazyLoadManager = LazyLoadManager.getInstance()

// 便捷函数
export function createLazyComponent(config: LazyComponentConfig): Component {
  return lazyLoadManager.createLazyComponent(config)
}

export function createLazyComponents(configs: Record<string, LazyComponentConfig>): Record<string, Component> {
  return lazyLoadManager.createLazyComponents(configs)
}

// 常用的懒加载组件配置
export const commonLazyComponents = {
  // 图表组件
  ChartRenderer: {
    loader: () => import('@/components/EnhancedChartRenderer.vue'),
    options: {
      delay: 100,
      timeout: 8000,
      liquidGlass: true
    }
  },
  
  // 性能监控组件
  PerformanceMonitor: {
    loader: () => import('@/components/PerformanceMonitor.vue'),
    options: {
      delay: 300,
      timeout: 5000,
      liquidGlass: true
    }
  },
  
  // 代码编辑器
  CodeEditor: {
    loader: () => import('@/components/CodeEditor.vue'),
    options: {
      delay: 200,
      timeout: 10000,
      liquidGlass: true
    }
  }
} as const