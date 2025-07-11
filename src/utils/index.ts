import type { LogLevel, ThemeMode } from '@/types'

/**
 * 日志工具类
 */
export class Logger {
  private static instance: Logger
  private logs: Array<{ timestamp: number; level: LogLevel; message: string; data?: any }> = []
  private maxLogs = 100

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  log(level: LogLevel, message: string, data?: any): void {
    const timestamp = Date.now()
    const logEntry = { timestamp, level, message, data }
    
    this.logs.push(logEntry)
    
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs / 2)
    }

    // 控制台输出
    const timeStr = new Date(timestamp).toLocaleTimeString()
    const prefix = `[${timeStr}] [${level.toUpperCase()}]`
    
    // 只有当 data 存在且不为 undefined 时才输出
    const args = data !== undefined ? [prefix, message, data] : [prefix, message]
    
    switch (level) {
      case 'error':
        console.error(...args)
        break
      case 'warn':
        console.warn(...args)
        break
      default:
        console.log(...args)
    }
  }

  info(message: string, data?: any): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: any): void {
    this.log('error', message, data)
  }

  getLogs(): typeof this.logs {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }
}

/**
 * 性能监控工具
 */
export class PerformanceMonitor {
  private static measurements = new Map<string, number>()

  static start(name: string): void {
    this.measurements.set(name, performance.now())
  }

  static end(name: string): number {
    const startTime = this.measurements.get(name)
    if (!startTime) {
      Logger.getInstance().warn(`性能监控: 未找到开始时间 ${name}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.measurements.delete(name)
    
    // 获取内存信息（如果可用）
    const memoryInfo = (performance as any).memory ? {
      used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
    } : null
    
    Logger.getInstance().info(`性能监控: ${name} 耗时 ${duration.toFixed(2)}ms`, memoryInfo)
    return duration
  }

  static measure<T>(name: string, fn: () => T): T {
    this.start(name)
    try {
      const result = fn()
      return result
    } finally {
      this.end(name)
    }
  }

  static async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name)
    try {
      const result = await fn()
      return result
    } finally {
      this.end(name)
    }
  }
}

/**
 * 错误处理工具
 */
export class ErrorHandler {
  private static logger = Logger.getInstance()

  static handle(error: unknown, context?: string): void {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    
    this.logger.error(`${context ? `[${context}] ` : ''}${message}`, {
      error,
      stack,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  }

  static async handleAsync(fn: () => Promise<void>, context?: string): Promise<void> {
    try {
      await fn()
    } catch (error) {
      this.handle(error, context)
    }
  }

  static handleSync(fn: () => void, context?: string): void {
    try {
      fn()
    } catch (error) {
      this.handle(error, context)
    }
  }
}

/**
 * 主题工具函数
 */
export const themeUtils = {
  getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  },

  resolveTheme(theme: ThemeMode): 'light' | 'dark' | 'eyecare' {
    if (theme === 'auto') {
      return this.getSystemTheme()
    }
    return theme
  },

  applyTheme(theme: 'light' | 'dark' | 'eyecare'): void {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark-theme', theme === 'dark')
    document.documentElement.classList.toggle('eyecare-theme', theme === 'eyecare')
  },

  /**
   * 应用强调色到文档
   * 仅通过CSS类控制，不使用内联样式
   */
  applyAccentColor(accentColor: string): void {
    // 移除现有的强调色类
    const existingClasses = document.documentElement.className.split(' ')
    const filteredClasses = existingClasses.filter(cls => !cls.startsWith('accent-'))
    document.documentElement.className = filteredClasses.join(' ')
    
    // 添加新的强调色类
    document.documentElement.classList.add(`accent-${accentColor}`)
    
    // 设置data属性，供CSS选择器使用
    document.documentElement.setAttribute('data-accent-color', accentColor)
    
    Logger.getInstance().info(`强调色已应用: ${accentColor}`)
  },

  // forceApplyAccentColorVariables 函数已移除
  // 强调色现在完全通过CSS类和属性选择器控制，不再使用JavaScript设置CSS变量

  watchSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      callback(e.matches ? 'dark' : 'light')
    }
    
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }
}

/**
 * DOM工具函数
 */
export const domUtils = {
  createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes?: Partial<HTMLElementTagNameMap[K]>,
    children?: (Node | string)[]
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag)
    
    if (attributes) {
      Object.assign(element, attributes)
    }
    
    if (children) {
      children.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child))
        } else {
          element.appendChild(child)
        }
      })
    }
    
    return element
  },

  addStyles(_css: string): HTMLStyleElement {
    // 废弃样式注入功能 - 所有样式应通过CSS文件静态加载
    console.warn('addStyles方法已废弃，请使用CSS文件静态加载样式')
    return document.createElement('style')
  },

  waitForElement(selector: string, timeout = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector)
      if (element) {
        resolve(element)
        return
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (element) {
          observer.disconnect()
          resolve(element)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`元素 ${selector} 在 ${timeout}ms 内未找到`))
      }, timeout)
    })
  },

  isElementInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }
}

/**
 * 文件工具函数
 */
export const fileUtils = {
  isMarkdownFile(url: string): boolean {
    return /\.(md|markdown)$/i.test(url) || 
           (url.includes('github.com') && url.includes('.md')) ||
           (url.includes('gitlab.com') && url.includes('.md')) ||
           (url.includes('bitbucket.org') && url.includes('.md'))
  },

  getFileExtension(url: string): string {
    const match = url.match(/\.([^./?#]+)(?:[?#]|$)/)
    return match ? match[1].toLowerCase() : ''
  },

  async downloadFile(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      ErrorHandler.handle(error, 'downloadFile')
      throw error
    }
  }
}

/**
 * 防抖和节流工具
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0
  
  return (...args: Parameters<T>) => {
    const now = Date.now()
    
    if (now - lastTime >= wait) {
      lastTime = now
      func(...args)
    }
  }
}

/**
 * 异步重试工具
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxAttempts) {
        throw lastError
      }
      
      Logger.getInstance().warn(`重试 ${attempt}/${maxAttempts} 失败:`, lastError.message)
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }
  
  throw lastError!
}

// 导出单例实例
export const logger = Logger.getInstance()
export const performanceMonitor = PerformanceMonitor
export const errorHandler = ErrorHandler