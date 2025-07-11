// Vue组件集成系统
import { vueComponentManager } from './vueIntegration'
import { MarkdownRenderer } from '../utils/markdownRenderer'
import { logger, performanceMonitor, errorHandler, themeUtils, domUtils } from '../utils'
import { cssVariableManager } from '../utils/cssVariableManager'
import { smartToolbarManager } from '../utils/smartToolbarManager'
import type { MarkdownConfig, ExtensionMessage, ExtensionResponse, Theme, AccentColor } from '../types'
import { defaultConfig } from '../types'

// CSS文件已通过manifest.json直接加载，无需在此导入
// 这样可以避免Vite将CSS转换为JS注入的问题

// 图表交互功能现在通过事件委托机制实现，无需外部脚本文件

/**
 * Content Script 主应用类
 * 负责在网页中注入Markdown渲染功能
 * 
 * @class ContentScriptApp
 * @description 基于Vue.js 3.0和苹果设计系统的Markdown渲染器
 * @version 2.1.0
 * @author Vue.js 3.0 研发高手
 */
class ContentScriptApp {
  private renderer: MarkdownRenderer | null = null
  private config: MarkdownConfig = { ...defaultConfig }
  private isActive = false
  private lastConfigUpdate = 0
  private isExtensionValid = true
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  // 事件监听器管理 - 防止内存泄漏
  private eventListeners: Map<string, { element: EventTarget; event: string; handler: EventListener; options?: AddEventListenerOptions }> = new Map()
  private abortController: AbortController = new AbortController()
  
  // 主题状态存储 - 用于打印前后的主题恢复
  private savedThemeState: {
    theme?: string
    accentColor?: string
    dataTheme?: string
    dataActualTheme?: string
    liquidGlassTheme?: string
  } = {}
  
  // 性能监控
  private performanceMetrics: {
    initTime: number
    renderTime: number
    configLoadTime: number
    lastUpdate: number
    memory?: {
      used: number
      total: number
      limit: number
    }
  } = {
    initTime: 0,
    renderTime: 0,
    configLoadTime: 0,
    lastUpdate: Date.now()
  }

  constructor() {
    this.init()
  }

  /**
   * 等待页面完全加载完成
   */
  private async waitForPageReady(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        // 页面已完全加载，额外等待一小段时间确保所有资源都已加载
        setTimeout(resolve, 100)
      } else if (document.readyState === 'interactive') {
        // DOM已加载，等待所有资源加载完成
        window.addEventListener('load', () => {
          setTimeout(resolve, 100)
        }, { once: true })
      } else {
        // 页面还在加载中，等待DOM和所有资源都加载完成
        document.addEventListener('DOMContentLoaded', () => {
          window.addEventListener('load', () => {
            setTimeout(resolve, 100)
          }, { once: true })
        }, { once: true })
      }
    })
  }

  /**
   * 确保样式表按优先级顺序加载 - 后加载优先权最高
   */
  private async ensureStylesLoaded(): Promise<void> {
    const extensionId = chrome.runtime.id

    // 样式表按优先级排序：基础样式 -> 组件样式 -> 内容样式（后加载优先权最高）
    const stylesheets = [
      {
        href: `chrome-extension://${extensionId}/src/styles/apple-design-system.css`,
        priority: 1,
        name: 'apple-design-system'
      },
      {
        href: `chrome-extension://${extensionId}/src/styles/content-variables.css`,
        priority: 2,
        name: 'content-variables'
      },
      {
        href: `chrome-extension://${extensionId}/src/styles/enhanced-components.css`,
        priority: 3,
        name: 'enhanced-components'
      },
      {
        href: `chrome-extension://${extensionId}/src/styles/content.css`,
        priority: 4,
        name: 'content'
      }
    ]

    // 移除已存在的样式表，确保重新加载时优先级正确
    stylesheets.forEach(({ href, name }) => {
      const existingLink = document.querySelector(`link[href="${href}"]`) ||
        document.querySelector(`link[data-style-name="${name}"]`)
      if (existingLink) {
        existingLink.remove()
      }
    })

    // 按优先级顺序加载样式表
    for (const { href, name } of stylesheets) {
      await this.loadStylesheet(href, name)
    }

    // 等待样式表完全应用
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  /**
   * 加载单个样式表
   */
  private async loadStylesheet(href: string, name: string): Promise<void> {
    return new Promise((resolve, _reject) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.setAttribute('data-style-name', name)
      link.setAttribute('data-markdown-reader', 'true')

      link.onload = () => {
        this.debugLog(`样式表加载成功: ${name}`)
        resolve()
      }

      link.onerror = () => {
        this.debugLog(`样式表加载失败: ${name}`, href)
        // 即使加载失败也继续，不阻塞渲染流程
        resolve()
      }

      // 添加到head末尾，确保后加载的样式优先级更高
      document.head.appendChild(link)

      // 设置超时，防止无限等待
      setTimeout(() => {
        this.debugLog(`样式表加载超时: ${name}`)
        resolve()
      }, 3000)
    })
  }

  private async init(): Promise<void> {
    try {
      this.debugLog('Content Script 初始化开始', { url: window.location.href })

      // 检查扩展上下文
      if (!this.checkExtensionContext()) {
        this.debugLog('扩展上下文无效，尝试重连')
        await this.attemptReconnect()
        return
      }

      // 加载配置
      await this.loadConfig()

      // 检查是否为Markdown文件 - 智能检测
      if (this.isMarkdownFile()) {
        this.debugLog('检测到Markdown文件，开始设置渲染器')
        await this.setupMarkdownRenderer()
      } else {
        this.debugLog('未检测到Markdown文件，Content Script 不激活')
      }

      // 设置消息监听
      this.setupMessageListener()

      // 设置主题监听
      this.setupThemeWatcher()

      // 设置扩展上下文监听
      this.setupExtensionWatcher()

      // 设置打印事件监听
      this.setupPrintEventListeners()

      // 设置图片事件委托
      this.setupImageEventDelegation()

      // 设置页面卸载清理机制
      this.setupPageUnloadCleanup()

      this.debugLog('Content Script 初始化完成')
    } catch (error) {
      this.debugLog('Content Script 初始化失败', error, 'error')
      errorHandler.handle(error, 'ContentScript.init')
    }
  }

  /**
   * 设置页面卸载时的清理机制
   * 确保在页面关闭或导航时正确释放资源
   */
  private setupPageUnloadCleanup(): void {
    // 页面卸载前清理
    this.addEventListenerManaged('beforeunload', window, 'beforeunload', () => {
      this.debugLog('页面即将卸载，开始清理资源', undefined, 'info')
      this.cleanup()
    })

    // 页面隐藏时清理（适用于单页应用）
    this.addEventListenerManaged('pagehide', window, 'pagehide', () => {
      this.debugLog('页面隐藏，执行清理', undefined, 'info')
      this.cleanup()
    })

    // 监听页面可见性变化
    this.addEventListenerManaged('visibilitychange', document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.debugLog('页面变为隐藏状态，执行部分清理', undefined, 'info')
        // 执行轻量级清理，不完全销毁
        this.partialCleanup()
      } else if (document.visibilityState === 'visible') {
        this.debugLog('页面变为可见状态', undefined, 'info')
        // 页面重新可见时，可以执行一些恢复操作
        this.onPageVisible()
      }
    })

    this.debugLog('页面卸载清理机制已设置')
  }

  /**
   * 部分清理 - 页面隐藏时执行
   * 不完全销毁，保留核心功能
   */
  private partialCleanup(): void {
    try {
      // 清理日志条目（保留最近的50条）
      if (this.logEntries.length > 50) {
        this.logEntries.splice(0, this.logEntries.length - 50)
      }

      // 更新性能指标
      this.performanceMetrics.lastUpdate = Date.now()

      this.debugLog('部分清理完成', this.getPerformanceMetrics())

    } catch (error) {
      this.debugLog('部分清理失败', error, 'error')
    }
  }

  /**
   * 页面重新可见时的恢复操作
   */
  private onPageVisible(): void {
    try {
      // 检查扩展上下文是否仍然有效
      if (!this.checkExtensionContext()) {
        this.debugLog('页面可见时发现扩展上下文无效，尝试重连', undefined, 'warn')
        this.attemptReconnect()
        return
      }

      // 更新性能指标
      this.performanceMetrics.lastUpdate = Date.now()

      this.debugLog('页面重新可见，状态正常')

    } catch (error) {
      this.debugLog('页面可见恢复操作失败', error, 'error')
    }
  }

  private setupThemeWatcher(): void {
    if (this.config.theme === 'auto') {
      themeUtils.watchSystemTheme((systemTheme) => {
        themeUtils.applyTheme(systemTheme)
      })
    }
  }

  private checkExtensionContext(): boolean {
    try {
      // 检查chrome API是否可用
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        return false
      }

      // 检查扩展ID是否存在
      if (!chrome.runtime.id) {
        return false
      }

      return true
    } catch (error) {
      logger.warn('检查扩展上下文失败:', error)
      return false
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('达到最大重连次数，停止重连')
      this.isExtensionValid = false
      return
    }

    this.reconnectAttempts++
    logger.info(`尝试重连扩展上下文 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    // 等待一段时间后重试
    await new Promise(resolve => setTimeout(resolve, 1000 * this.reconnectAttempts))

    if (this.checkExtensionContext()) {
      logger.info('扩展上下文重连成功')
      this.isExtensionValid = true
      this.reconnectAttempts = 0
      await this.init()
    } else {
      await this.attemptReconnect()
    }
  }

  private setupExtensionWatcher(): void {
    // 定期检查扩展上下文
    setInterval(() => {
      if (!this.checkExtensionContext() && this.isExtensionValid) {
        logger.warn('检测到扩展上下文失效')
        this.isExtensionValid = false
        this.attemptReconnect()
      }
    }, 5000) // 每5秒检查一次
  }

  /**
   * 统一的事件监听器管理方法
   * 防止内存泄漏，提供自动清理机制
   * 
   * @param id 监听器唯一标识
   * @param element 目标元素
   * @param event 事件类型
   * @param handler 事件处理函数
   * @param options 事件选项
   */
  private addEventListenerManaged(
    id: string, 
    element: EventTarget, 
    event: string, 
    handler: EventListener, 
    options?: AddEventListenerOptions
  ): void {
    // 如果已存在同ID的监听器，先移除
    this.removeEventListenerManaged(id)
    
    // 添加新的监听器
    const managedOptions = { 
      ...options, 
      signal: this.abortController.signal 
    }
    
    element.addEventListener(event, handler, managedOptions)
    
    // 记录监听器信息
    this.eventListeners.set(id, {
      element,
      event,
      handler,
      options: managedOptions
    })
    
    this.debugLog(`事件监听器已添加: ${id}`, { event, element: element.constructor.name })
  }

  /**
   * 移除指定的事件监听器
   * 
   * @param id 监听器唯一标识
   */
  private removeEventListenerManaged(id: string): void {
    const listener = this.eventListeners.get(id)
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options)
      this.eventListeners.delete(id)
      this.debugLog(`事件监听器已移除: ${id}`)
    }
  }

  /**
   * 清理所有事件监听器
   * 防止内存泄漏
   */
  private cleanupEventListeners(): void {
    // 使用AbortController一次性取消所有监听器
    this.abortController.abort()
    
    // 清空记录
    this.eventListeners.clear()
    
    // 重新创建AbortController以备后用
    this.abortController = new AbortController()
    
    this.debugLog('所有事件监听器已清理')
  }

  /**
   * 设置图片事件委托
   * 使用事件委托替代内联事件处理器，确保打印时不受JavaScript限制影响
   */
  private setupImageEventDelegation(): void {
    // 使用事件委托处理图片点击
    this.addEventListenerManaged('imageClick', document, 'click', (event: Event) => {
      const target = event.target as HTMLElement
      
      // 检查是否是可点击的图片
      if (target.tagName === 'IMG' && target.hasAttribute('data-clickable')) {
        event.preventDefault()
        this.openImageModal(target as HTMLImageElement)
      }
    })

    // 处理图片加载完成
    this.addEventListenerManaged('imageLoad', document, 'load', (event: Event) => {
      const target = event.target as HTMLElement
      
      if (target.tagName === 'IMG' && target.hasAttribute('data-image-id')) {
        const imageId = target.getAttribute('data-image-id')
        if (imageId) {
          this.handleImageLoadComplete(imageId)
        }
      }
    }, { capture: true }) // 使用捕获阶段

    // 处理图片加载错误
    this.addEventListenerManaged('imageError', document, 'error', (event: Event) => {
      const target = event.target as HTMLElement
      
      if (target.tagName === 'IMG' && target.hasAttribute('data-image-id')) {
        const imageId = target.getAttribute('data-image-id')
        if (imageId) {
          this.handleImageLoadError(imageId)
        }
      }
    }, { capture: true }) // 使用捕获阶段

    this.debugLog('图片事件委托已设置')
  }

  /**
   * 处理图片加载完成
   */
  private handleImageLoadComplete(imageId: string): void {
    const container = document.querySelector(`[data-image-container="${imageId}"]`)
    if (container) {
      const loading = container.querySelector('.image-loading')
      if (loading) {
        loading.remove()
      }
      // 确保图片在打印时可见
      const img = container.querySelector('img')
      if (img) {
        img.style.opacity = '1'
        img.style.visibility = 'visible'
      }
    }
  }

  /**
   * 处理图片加载错误
   */
  private handleImageLoadError(imageId: string): void {
    const container = document.querySelector(`[data-image-container="${imageId}"]`)
    if (container) {
      const loading = container.querySelector('.image-loading')
      const img = container.querySelector('img')
      
      if (loading) loading.remove()
      
      if (img) {
        img.style.display = 'none'
        const errorDiv = document.createElement('div')
        errorDiv.className = 'image-error'
        errorDiv.textContent = '图片加载失败'
        errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #666; background: #f5f5f5; border-radius: 4px;'
        container.appendChild(errorDiv)
      }
    }
  }

  /**
   * 设置打印事件监听器
   * 只处理打印页眉页脚信息，不干预样式
   * 使用统一的事件管理机制
   */
  private setupPrintEventListeners(): void {
    // 打印前事件 - 设置打印信息
    this.addEventListenerManaged('beforeprint', window, 'beforeprint', () => {
      this.debugLog('打印前事件触发，设置打印信息')
      
      // 保存当前主题状态
      this.saveCurrentThemeState()
      
      // 强制显示所有图片，确保打印时图片可见
      this.ensureImagesVisibleForPrint()
      
      // 设置打印页眉页脚信息
      this.setPrintHeaderFooterInfo()
      this.debugLog('打印信息已设置')
    })

    // 打印后事件 - 清理打印信息并恢复主题
    this.addEventListenerManaged('afterprint', window, 'afterprint', async () => {
      this.debugLog('打印后事件触发，清理打印信息并恢复主题')
      // 清理打印时添加的临时属性
      document.documentElement.removeAttribute('data-document-title')
      document.documentElement.removeAttribute('data-file-name')
      
      // 恢复主题设置，防止打印样式影响页面主题
      // 重新加载持久化配置确保完全恢复用户设置
      await this.restoreThemeAfterPrint()
      
      this.debugLog('打印信息已清理，主题已恢复')
    })

    this.debugLog('打印事件监听器已设置')
  }

  /**
   * 确保图片在打印时可见
   * 强制显示所有图片，移除可能影响打印的样式
   */
  private ensureImagesVisibleForPrint(): void {
    try {
      // 获取所有图片元素
      const images = document.querySelectorAll('img.markdown-image, .image-container img')
      
      images.forEach((img: Element) => {
        const imageElement = img as HTMLImageElement
        
        // 强制显示图片
        imageElement.style.opacity = '1'
        imageElement.style.visibility = 'visible'
        imageElement.style.display = 'block'
        
        // 确保图片尺寸适合打印
        imageElement.style.maxWidth = '100%'
        imageElement.style.height = 'auto'
        
        // 移除可能影响打印的变换
        imageElement.style.transform = 'none'
        imageElement.style.transition = 'none'
        
        // 如果图片还没有加载完成，设置一个默认的最小高度
        if (!imageElement.complete) {
          imageElement.style.minHeight = '100px'
          imageElement.style.background = '#f5f5f5'
        }
      })
      
      // 移除所有图片加载状态元素
      const loadingElements = document.querySelectorAll('.image-loading')
      loadingElements.forEach(loading => {
        (loading as HTMLElement).style.display = 'none'
      })
      
      // 确保图片容器可见
      const imageContainers = document.querySelectorAll('.image-container')
      imageContainers.forEach((container: Element) => {
        const containerElement = container as HTMLElement
        containerElement.style.opacity = '1'
        containerElement.style.visibility = 'visible'
        containerElement.style.pageBreakInside = 'avoid'
      })
      
      this.debugLog(`已强制显示 ${images.length} 个图片用于打印`)
      
    } catch (error) {
      this.debugLog('强制显示图片失败', error, 'error')
    }
  }

  /**
   * 设置打印页眉页脚信息
   * 增强错误处理和性能监控
   * 
   * @returns {boolean} 是否成功设置
   */
  private setPrintHeaderFooterInfo(): boolean {
    const startTime = performance.now()
    
    try {
      // 性能监控：记录开始时间
      this.debugLog('开始设置打印页眉页脚信息')
      
      // 获取文档标题 - 增强容错性
      const documentTitle = this.getDocumentTitle()
      
      // 获取文件名 - 优化提取逻辑
      const fileName = this.extractFileName()
      
      // 验证数据有效性
      if (!documentTitle || !fileName) {
        throw new Error('打印信息数据无效')
      }
      
      // 设置data属性 - 增强错误处理
      this.setDocumentAttributes({
        'data-document-title': documentTitle,
        'data-file-name': fileName
      })
      
      // 性能监控：记录完成时间
      const endTime = performance.now()
      this.performanceMetrics.lastUpdate = Date.now()
      
      this.debugLog('打印页眉页脚信息设置成功', {
        documentTitle,
        fileName,
        duration: `${(endTime - startTime).toFixed(2)}ms`
      })
      
      return true
      
    } catch (error) {
      const endTime = performance.now()
      this.debugLog('设置打印页眉页脚信息失败', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${(endTime - startTime).toFixed(2)}ms`,
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // 设置默认值以确保打印功能不完全失败
      this.setFallbackPrintInfo()
      return false
    }
  }

  /**
   * 获取文档标题 - 增强容错性
   * 
   * @returns {string} 文档标题
   */
  private getDocumentTitle(): string {
    try {
      // 优先使用document.title
      if (document.title && document.title.trim()) {
        return document.title.trim()
      }
      
      // 尝试从meta标签获取
      const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
      if (metaTitle && metaTitle.trim()) {
        return metaTitle.trim()
      }
      
      // 尝试从h1标签获取
      const h1Element = document.querySelector('h1')
      if (h1Element && h1Element.textContent && h1Element.textContent.trim()) {
        return h1Element.textContent.trim()
      }
      
      // 最后使用URL作为标题
      return window.location.href
      
    } catch (error) {
      this.debugLog('获取文档标题失败', error)
      return '无标题文档'
    }
  }

  /**
   * 提取文件名 - 优化提取逻辑
   * 
   * @returns {string} 文件名
   */
  private extractFileName(): string {
    try {
      const pathname = window.location.pathname
      
      // 处理根路径
      if (!pathname || pathname === '/') {
        return window.location.hostname || '本地文件'
      }
      
      // 分割路径并过滤空值
      const pathParts = pathname.split('/').filter(part => part.trim() !== '')
      
      if (pathParts.length === 0) {
        return window.location.hostname || '本地文件'
      }
      
      // 获取最后一个路径部分
      let fileName = pathParts[pathParts.length - 1]
      
      try {
        // 尝试URL解码
        fileName = decodeURIComponent(fileName)
      } catch (decodeError) {
        // 解码失败时使用原始值
        this.debugLog('URL解码失败，使用原始文件名', decodeError)
      }
      
      // 如果文件名为空或只包含特殊字符，使用域名
      if (!fileName || !/[a-zA-Z0-9\u4e00-\u9fa5]/.test(fileName)) {
        return window.location.hostname || '本地文件'
      }
      
      return fileName
      
    } catch (error) {
      this.debugLog('提取文件名失败', error)
      return window.location.hostname || '未知文件'
    }
  }

  /**
   * 设置文档属性 - 增强错误处理
   * 
   * @param attributes 要设置的属性对象
   */
  private setDocumentAttributes(attributes: Record<string, string>): void {
    try {
      if (!document.documentElement) {
        throw new Error('document.documentElement 不可用')
      }
      
      Object.entries(attributes).forEach(([key, value]) => {
        if (!key || value === undefined || value === null) {
          this.debugLog(`跳过无效属性: ${key} = ${value}`)
          return
        }
        
        document.documentElement.setAttribute(key, String(value))
      })
      
    } catch (error) {
      this.debugLog('设置文档属性失败', error)
      throw error
    }
  }

  /**
   * 设置备用打印信息
   * 当主要设置失败时使用
   */
  private setFallbackPrintInfo(): void {
    try {
      const fallbackInfo = {
        'data-document-title': '文档',
        'data-file-name': window.location.hostname || '本地文件'
      }
      
      this.setDocumentAttributes(fallbackInfo)
      this.debugLog('已设置备用打印信息', fallbackInfo)
      
    } catch (error) {
      this.debugLog('设置备用打印信息也失败', error)
    }
  }

  /**
   * 打印后恢复主题设置
   * 防止打印样式中的强制颜色设置影响页面主题
   * 重新加载持久化配置确保完全恢复用户设置
   */
  private async restoreThemeAfterPrint(): Promise<void> {
    try {
      this.debugLog('开始恢复打印后的主题设置')
      
      // 重新加载持久化配置，确保使用最新的用户设置
      await this.reloadPersistedConfig()
      
      // 重新应用当前配置的主题
      if (this.config.theme) {
        cssVariableManager.setTheme(this.config.theme)
        this.debugLog('已恢复主题设置', { theme: this.config.theme })
      }
      
      // 重新应用强调色
      if (this.config.accentColor) {
        cssVariableManager.setAccentColor(this.config.accentColor)
        this.debugLog('已恢复强调色设置', { accentColor: this.config.accentColor })
      }
      
      // 恢复保存的DOM属性（作为备用机制）
      if (this.savedThemeState.dataTheme) {
        document.documentElement.setAttribute('data-theme', this.savedThemeState.dataTheme)
      }
      if (this.savedThemeState.dataActualTheme) {
        document.documentElement.setAttribute('data-actual-theme', this.savedThemeState.dataActualTheme)
      }
      if (this.savedThemeState.liquidGlassTheme) {
        document.documentElement.setAttribute('data-liquid-glass-theme', this.savedThemeState.liquidGlassTheme)
      }
      
      // 确保主题相关的CSS变量正确设置
      this.applyConfigToStyles()
      
      this.debugLog('主题状态已完全恢复', { 
        config: this.config, 
        savedState: this.savedThemeState 
      })
      
    } catch (error) {
      this.debugLog('恢复主题设置失败', error)
      // 如果重新加载配置失败，使用保存的状态作为备用方案
      this.fallbackRestoreTheme()
    }
  }

  /**
   * 重新加载持久化配置
   * 专门用于打印后恢复，确保获取最新的用户设置
   */
  private async reloadPersistedConfig(): Promise<void> {
    try {
      if (!this.checkExtensionContext()) {
        throw new Error('扩展上下文无效，无法重新加载配置')
      }

      // 使用与markdown.ts相同的存储键名
      const result = await chrome.storage.sync.get('markdown-config')
      if (result['markdown-config']) {
        // 合并配置，确保不丢失任何设置
        this.config = { ...this.config, ...result['markdown-config'] }
        this.debugLog('配置已从chrome.storage.sync重新加载', this.config)
        console.log('配置已从chrome.storage.sync加载')
      } else {
        this.debugLog('未找到存储的配置，保持当前配置')
      }
    } catch (error) {
      this.debugLog('重新加载持久化配置失败', error)
      throw error
    }
  }

  /**
   * 备用主题恢复方案
   * 当重新加载配置失败时使用保存的状态
   */
  private fallbackRestoreTheme(): void {
    try {
      this.debugLog('使用备用方案恢复主题')
      
      // 使用保存的状态恢复主题
      if (this.savedThemeState.theme) {
        cssVariableManager.setTheme(this.savedThemeState.theme as Theme)
      }
      if (this.savedThemeState.accentColor) {
        cssVariableManager.setAccentColor(this.savedThemeState.accentColor as AccentColor)
      }
      
      // 恢复DOM属性
      if (this.savedThemeState.dataTheme) {
        document.documentElement.setAttribute('data-theme', this.savedThemeState.dataTheme)
      }
      if (this.savedThemeState.dataActualTheme) {
        document.documentElement.setAttribute('data-actual-theme', this.savedThemeState.dataActualTheme)
      }
      if (this.savedThemeState.liquidGlassTheme) {
        document.documentElement.setAttribute('data-liquid-glass-theme', this.savedThemeState.liquidGlassTheme)
      }
      
      this.debugLog('备用主题恢复完成')
      
    } catch (error) {
      this.debugLog('备用主题恢复也失败', error)
    }
  }

  /**
   * 保存当前主题状态
   * 在打印前调用，用于打印后恢复
   */
  private saveCurrentThemeState(): void {
    try {
      // 保存配置中的主题设置
      this.savedThemeState.theme = this.config.theme
      this.savedThemeState.accentColor = this.config.accentColor
      
      // 保存DOM元素上的主题属性
      this.savedThemeState.dataTheme = document.documentElement.getAttribute('data-theme') || undefined
      this.savedThemeState.dataActualTheme = document.documentElement.getAttribute('data-actual-theme') || undefined
      this.savedThemeState.liquidGlassTheme = document.documentElement.getAttribute('data-liquid-glass-theme') || undefined
      
      this.debugLog('当前主题状态已保存', this.savedThemeState)
      
    } catch (error) {
      this.debugLog('保存主题状态失败', error)
    }
  }

  /**
   * 智能检测Markdown文件 - 支持多种场景
   * 现在支持所有页面，不再限制只对.md文件生效
   * 1. 文件扩展名检测：.md, .MD, .Md, .mD, .markdown
   * 2. GitHub/GitLab等平台的markdown页面
   * 3. 内容类型检测（text/markdown, text/plain等）
   * 4. 文档标题和内容检测
   * 5. 所有其他页面（新增）
   */
  private isMarkdownFile(): boolean {
    const url = window.location.href
    const pathname = window.location.pathname

    // 排除一些明显不需要处理的页面类型
    const excludePatterns = [
      /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico)$/i,  // 图片文件
      /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i,       // 视频文件
      /\.(mp3|wav|flac|aac|ogg|wma)$/i,           // 音频文件
      /\.(zip|rar|7z|tar|gz|bz2)$/i,              // 压缩文件
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,     // 办公文档
      /\.(exe|dmg|pkg|deb|rpm|msi)$/i,            // 可执行文件
      /\/api\//i,                                  // API接口
      /\.(css|js|json|xml)$/i                     // 静态资源文件
    ]

    // 如果是明确需要排除的文件类型，直接返回false
    if (excludePatterns.some(pattern => pattern.test(url) || pattern.test(pathname))) {
      console.log('排除的文件类型，不启用插件:', { url, pathname })
      return false
    }

    // 1. 直接的文件扩展名检测（优先级最高）
    if (/\.(md|markdown)$/i.test(url) || /\.(md|markdown)$/i.test(pathname)) {
      console.log('通过文件扩展名识别为Markdown文件')
      return true
    }

    // 2. GitHub/GitLab等平台特殊路径检测
    if (this.isKnownMarkdownPlatform(url)) {
      console.log('通过平台特征识别为Markdown文件')
      return true
    }

    // 3. Content-Type检测
    const contentType = document.contentType || ''
    if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
      console.log('通过Content-Type识别为Markdown文件')
      return true
    }

    // 4. 页面内容特征检测
    if (this.detectMarkdownContent()) {
      console.log('通过内容特征识别为Markdown文件')
      return true
    }

    // 5. 新增：对所有其他页面也启用插件（除了排除列表中的文件）
    // 这样用户可以在任何页面使用Markdown渲染功能
    console.log('启用插件用于通用页面:', { url, pathname, contentType })
    return true
  }

  /**
   * 检测已知的Markdown托管平台
   */
  private isKnownMarkdownPlatform(url: string): boolean {
    const platforms = [
      // GitHub
      {
        domain: 'github.com',
        patterns: [
          /\/blob\/[^/]+\/.*\.md$/i,
          /\/blob\/[^/]+\/.*\.markdown$/i,
          /\/readme$/i,
          /\/README$/,
          /\/wiki\//i
        ]
      },
      // GitLab
      {
        domain: 'gitlab.com',
        patterns: [
          /\/-\/blob\/[^/]+\/.*\.md$/i,
          /\/-\/blob\/[^/]+\/.*\.markdown$/i,
          /\/-\/wikis\//i
        ]
      },
      // Bitbucket
      {
        domain: 'bitbucket.org',
        patterns: [
          /\/src\/[^/]+\/.*\.md$/i,
          /\/src\/[^/]+\/.*\.markdown$/i
        ]
      },
      // Gitee
      {
        domain: 'gitee.com',
        patterns: [
          /\/blob\/[^/]+\/.*\.md$/i,
          /\/blob\/[^/]+\/.*\.markdown$/i
        ]
      }
    ]

    return platforms.some(platform => {
      if (!url.includes(platform.domain)) return false
      return platform.patterns.some(pattern => pattern.test(url))
    })
  }

  /**
   * 检测页面内容是否具有Markdown特征
   */
  private detectMarkdownContent(): boolean {
    // 检查页面标题
    const title = document.title.toLowerCase()
    if (title.includes('readme') || title.includes('markdown') || title.includes('.md')) {
      return true
    }

    // 检查页面内容的Markdown特征
    const bodyText = document.body.textContent || ''
    const markdownIndicators = [
      /^#{1,6}\s+/m,  // 标题
      /\*\*.*?\*\*/,   // 粗体
      /\*.*?\*/,       // 斜体
      /```[\s\S]*?```/, // 代码块
      /`.*?`/,         // 内联代码
      /^\s*\|\s*.*\s*\|/m, // 表格
      /^\s*[\*\-\+]\s+/m,  // 列表
      /^\s*\d+\.\s+/m,     // 数字列表
      /\[.*?\]\(.*?\)/     // 链接
    ]

    const matchCount = markdownIndicators.filter(regex => regex.test(bodyText)).length
    return matchCount >= 2  // 至少匹配2个特征才认为是Markdown
  }

  private async loadConfig(): Promise<void> {
    try {
      if (!this.checkExtensionContext()) {
        logger.warn('扩展上下文无效，无法加载配置')
        return
      }

      // 使用与markdown.ts相同的存储键名
      const result = await chrome.storage.sync.get('markdown-config')
      if (result['markdown-config']) {
        this.config = { ...this.config, ...result['markdown-config'] }
        logger.info('配置已加载', this.config)
        console.log('配置已从chrome.storage.sync加载')

        // 立即应用所有配置到CSS变量
        this.applyConfigToStyles()
      } else {
        console.log('未找到存储的配置，使用默认配置')
        // 即使使用默认配置，也要应用到样式
        this.applyConfigToStyles()
      }
    } catch (error) {
      logger.warn('加载配置失败，使用默认配置', error)
      console.error('配置加载错误:', error)
      // 即使加载失败，也要应用默认配置到样式
      this.applyConfigToStyles()
    }
  }

  private async setupMarkdownRenderer(): Promise<void> {
    try {
      performanceMonitor.start('setupRenderer')

      // 重新加载最新的持久化配置，确保渲染时使用最新设置
      await this.loadConfig()

      // 立即应用所有配置到CSS变量
      this.applyConfigToStyles()

      // 获取Markdown内容
      const markdownContent = this.extractMarkdownContent()
      if (!markdownContent) {
        logger.warn('未找到Markdown内容')
        return
      }

      // 创建渲染器
      this.renderer = new MarkdownRenderer(this.config)

      // 渲染内容
      await this.renderMarkdown(markdownContent)

      // 设置交互功能
      this.setupInteractions()

      this.isActive = true
      logger.info('Markdown渲染器设置完成')

      performanceMonitor.end('setupRenderer')
    } catch (error) {
      errorHandler.handle(error, 'setupMarkdownRenderer')
    }
  }

  /**
   * 应用配置到CSS变量和样式
   */
  private applyConfigToStyles(): void {
    console.log('应用配置到样式:', this.config)

    // 应用强调色
    if (this.config.accentColor) {
      cssVariableManager.setAccentColor(this.config.accentColor)
      console.log('已应用强调色:', this.config.accentColor)
    }

    // 应用主题
    if (this.config.theme) {
      cssVariableManager.setTheme(this.config.theme)
      console.log('已应用主题:', this.config.theme)
    }

    // 应用字体设置
    if (this.config.fontSize || this.config.lineHeight) {
      cssVariableManager.setTypography(
        this.config.fontSize,
        this.config.lineHeight
      )
      console.log('已应用字体设置:', {
        fontSize: this.config.fontSize,
        lineHeight: this.config.lineHeight
      })
    }

    // 应用最大宽度
    if (this.config.maxWidth) {
      cssVariableManager.setMaxWidth(this.config.maxWidth)
      console.log('已应用最大宽度:', this.config.maxWidth)
    }
  }



  private extractMarkdownContent(): string {
    console.log('开始提取Markdown内容...')

    // 优先级顺序的选择器列表
    const selectors = [
      // GitHub原始文件内容 - 最高优先级
      '.file .blob-code-content',
      '.file .highlight pre',
      '.file pre',

      // GitHub文件查看器
      '.blob-wrapper .blob-code',
      '.blob-wrapper pre',

      // GitLab原始内容
      '.file-content pre',
      '.file-content .code',

      // 已经渲染的Markdown（但我们需要原始内容）
      '.markdown-body',
      '.readme .markdown-body',

      // 通用代码容器
      'pre code',
      'pre',

      // 通用内容容器 - 较低优先级
      'article',
      'main',
      '.content',
      '.document'
    ]

    let bestContent = ''
    let bestScore = 0
    let bestSelector = ''

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)

      for (const element of elements) {
        let text = ''

        // 对于代码容器，优先使用textContent
        if (selector.includes('pre') || selector.includes('code') || selector.includes('blob-code')) {
          text = element.textContent || ''
        } else {
          // 对于其他容器，尝试获取更好的内容
          text = this.extractTextFromElement(element)
        }

        if (text.length < 50) continue

        // 计算内容的Markdown特征分数
        const score = this.calculateMarkdownScore(text)

        console.log(`选择器 "${selector}" 内容评分: ${score}, 长度: ${text.length}`)

        if (score > bestScore) {
          bestScore = score
          bestContent = text
          bestSelector = selector
          console.log(`发现更好的内容，选择器: ${selector}, 评分: ${score}`)
        }
      }
    }

    // 如果找到了高质量的Markdown内容
    if (bestScore > 3) { // 提高阈值，确保质量
      console.log(`提取完成，最终评分: ${bestScore}, 选择器: ${bestSelector}, 内容长度: ${bestContent.length}`)
      return bestContent
    }

    // 如果没有找到高质量内容，尝试更智能的提取
    console.log('未找到高质量Markdown内容，尝试智能提取...')
    const intelligentContent = this.intelligentContentExtraction()

    if (intelligentContent && intelligentContent.length > 100) {
      console.log(`智能提取成功，内容长度: ${intelligentContent.length}`)
      return intelligentContent
    }

    // 最后的备选方案
    const fallbackContent = document.body.textContent || ''
    console.log(`使用备选方案，内容长度: ${fallbackContent.length}`)
    return fallbackContent
  }

  /**
   * 从元素中提取文本，保留一些结构信息
   */
  private extractTextFromElement(element: Element): string {
    // 如果是已经渲染的Markdown，尝试获取原始内容
    if (element.classList.contains('markdown-body')) {
      // 查找是否有原始内容的引用
      const rawLink = document.querySelector('a[href*="raw"]') as HTMLAnchorElement
      if (rawLink) {
        // 这里可以考虑异步获取原始内容，但为了简化，先使用现有内容
        return this.convertHtmlToMarkdown(element.innerHTML)
      }
    }

    return element.textContent || ''
  }

  /**
   * 智能内容提取 - 尝试识别主要内容区域
   */
  private intelligentContentExtraction(): string {
    // 尝试识别主要内容区域
    const contentIndicators = [
      // 查找包含大量文本的元素
      { selector: 'div', minLength: 500, maxElements: 3 },
      { selector: 'section', minLength: 300, maxElements: 2 },
      { selector: 'article', minLength: 200, maxElements: 1 }
    ]

    for (const indicator of contentIndicators) {
      const elements = Array.from(document.querySelectorAll(indicator.selector))
        .filter(el => {
          const text = el.textContent || ''
          return text.length >= indicator.minLength && this.calculateMarkdownScore(text) > 1
        })
        .sort((a, b) => {
          const scoreA = this.calculateMarkdownScore(a.textContent || '')
          const scoreB = this.calculateMarkdownScore(b.textContent || '')
          return scoreB - scoreA
        })
        .slice(0, indicator.maxElements)

      if (elements.length > 0) {
        const combinedText = elements.map(el => el.textContent || '').join('\n\n')
        if (this.calculateMarkdownScore(combinedText) > 2) {
          return combinedText
        }
      }
    }

    return ''
  }

  /**
   * 简单的HTML到Markdown转换（用于已渲染的内容）
   */
  private convertHtmlToMarkdown(html: string): string {
    // 这是一个简化的转换，主要处理常见的HTML标签
    return html
      .replace(/<h([1-6]).*?>(.*?)<\/h[1-6]>/gi, (_, level, text) => '#'.repeat(parseInt(level)) + ' ' + text + '\n')
      .replace(/<strong.*?>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em.*?>(.*?)<\/em>/gi, '*$1*')
      .replace(/<code.*?>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre.*?><code.*?>(.*?)<\/code><\/pre>/gis, '```\n$1\n```')
      .replace(/<a.*?href="(.*?)".*?>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img.*?src="(.*?)".*?alt="(.*?)".*?>/gi, '![$2]($1)')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p.*?>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<li.*?>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<ul.*?>(.*?)<\/ul>/gis, '$1\n')
      .replace(/<ol.*?>(.*?)<\/ol>/gis, '$1\n')
      .replace(/<blockquote.*?>(.*?)<\/blockquote>/gis, '> $1\n')
      .replace(/<[^>]*>/g, '') // 移除剩余的HTML标签
      .replace(/\n{3,}/g, '\n\n') // 清理多余的换行
      .trim()
  }

  /**
   * 计算文本的Markdown特征分数
   */
  private calculateMarkdownScore(text: string): number {
    let score = 0

    // Markdown特征检测
    const indicators = [
      { pattern: /^#{1,6}\s+.+$/m, weight: 2 },        // 标题
      { pattern: /\*\*[^*]+\*\*/g, weight: 1 },        // 粗体
      { pattern: /\*[^*]+\*/g, weight: 0.5 },          // 斜体
      { pattern: /```[\s\S]*?```/g, weight: 3 },       // 代码块
      { pattern: /`[^`]+`/g, weight: 1 },              // 内联代码
      { pattern: /^\s*\|\s*.+\s*\|/m, weight: 2 },     // 表格
      { pattern: /^\s*[\*\-\+]\s+/m, weight: 1 },      // 无序列表
      { pattern: /^\s*\d+\.\s+/m, weight: 1 },         // 有序列表
      { pattern: /\[.+?\]\(.+?\)/g, weight: 1 },       // 链接
      { pattern: /!\[.*?\]\(.+?\)/g, weight: 1 },      // 图片
      { pattern: /^>\s+/m, weight: 1 },                // 引用
      { pattern: /^---+$/m, weight: 1 },               // 分隔线
      { pattern: /```(mermaid|plantuml|graphviz)/gi, weight: 3 } // 图表
    ]

    indicators.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern)
      if (matches) {
        score += matches.length * weight
      }
    })

    // 长度加分（但有上限）
    const lengthBonus = Math.min(text.length / 1000, 2)
    score += lengthBonus

    return score
  }

  /**
   * 动态渲染容器中的所有图表
   */
  private async renderChartsInContainer(container: HTMLElement): Promise<void> {
    try {
      // 导入异步图表渲染器
      const { asyncChartRenderer } = await import('../utils/asyncChartRenderer')

      // 查找所有图表容器
      const chartContainers = container.querySelectorAll('.chart-container[data-chart-type][data-chart-id]')

      this.debugLog(`查找图表容器结果: 找到 ${chartContainers.length} 个`)

      // 如果没有找到，尝试查找所有.chart-container
      if (chartContainers.length === 0) {
        const allChartContainers = container.querySelectorAll('.chart-container')
        this.debugLog(`所有.chart-container元素: ${allChartContainers.length} 个`)

        allChartContainers.forEach((element, index) => {
          const chartType = element.getAttribute('data-chart-type')
          const chartId = element.getAttribute('data-chart-id')
          this.debugLog(`图表容器 ${index}: type=${chartType}, id=${chartId}`)
        })

        this.debugLog('未找到需要渲染的图表')
        return
      }

      this.debugLog(`找到 ${chartContainers.length} 个图表需要渲染`)

      // 并行渲染所有图表
      const renderPromises = Array.from(chartContainers).map(async (chartContainer, index) => {
        const chartElement = chartContainer as HTMLElement
        const chartType = chartElement.getAttribute('data-chart-type')
        const chartId = chartElement.getAttribute('data-chart-id')

        this.debugLog(`处理图表 ${index}: type=${chartType}, id=${chartId}`)

        if (!chartType || !chartId) {
          this.debugLog('图表容器缺少必要属性', { chartType, chartId })
          return
        }

        // 从data-content属性获取图表内容
        const contentElement = chartElement.querySelector('.chart-content[data-content]') as HTMLElement
        if (!contentElement) {
          this.debugLog('未找到图表内容元素', chartId)
          // 尝试查找所有.chart-content元素
          const allContentElements = chartElement.querySelectorAll('.chart-content')
          this.debugLog(`图表 ${chartId} 中的.chart-content元素: ${allContentElements.length} 个`)
          return
        }

        const encodedContent = contentElement.getAttribute('data-content')
        if (!encodedContent) {
          this.debugLog('图表内容为空', chartId)
          return
        }

        try {
          const chartContent = decodeURIComponent(encodedContent)
          this.debugLog(`开始渲染图表: ${chartType} (${chartId})`, chartContent.substring(0, 100) + '...')

          // 使用异步图表渲染器渲染图表
          const result = await asyncChartRenderer.renderChart({
            type: chartType as any,
            content: chartContent,
            containerId: chartId,
            timeout: 15000,
            retryCount: 3,
            cacheEnabled: true
          })

          if (result.success) {
            this.debugLog(`图表渲染成功: ${chartType} (${chartId})`)
          } else {
            this.debugLog(`图表渲染失败: ${chartType} (${chartId})`, result.error)
          }
        } catch (error) {
          this.debugLog(`图表渲染失败: ${chartType} (${chartId})`, error)

          // 显示错误信息
          const errorElement = chartElement.querySelector('.chart-error') as HTMLElement
          if (errorElement) {
            errorElement.style.display = 'block'
            errorElement.innerHTML = `
              <div class="error-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
                  <path d="M16 16l16 16M32 16l-16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="error-title">图表渲染失败</div>
              <div class="error-message">${error instanceof Error ? error.message : '未知错误'}</div>
              <div class="error-message">请检查图表语法是否正确或网络连接</div>
              <button class="retry-btn" onclick="window.retryChartRender('${chartId}', '${chartType}', '${encodedContent}')">
                重试渲染
              </button>
            `
          }
        }
      })

      // 等待所有图表渲染完成
      await Promise.allSettled(renderPromises)
      this.debugLog('所有图表渲染任务完成')

    } catch (error) {
      this.debugLog('图表渲染过程出错', error)
      errorHandler.handle(error, 'renderChartsInContainer')
    }
  }

  // 调试系统配置
  private debugConfig = {
    enabled: true,
    level: 'info' as 'debug' | 'info' | 'warn' | 'error',
    maxLogEntries: 1000,
    enablePerformanceTracking: true,
    enableMemoryTracking: true
  }
  
  // 日志存储
  private logEntries: Array<{
    timestamp: number
    level: string
    message: string
    data?: any
    performance?: {
      memory?: number
      timing?: number
    }
  }> = []

  /**
   * 增强的调试日志系统
   * 支持日志级别、性能监控和内存跟踪
   * 
   * @param message 日志消息
   * @param data 附加数据
   * @param level 日志级别
   */
  private debugLog(message: string, data?: any, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.debugConfig.enabled) return

    const timestamp = Date.now()
    const logEntry: any = {
      timestamp,
      level,
      message,
      data
    }

    // 性能监控
    if (this.debugConfig.enablePerformanceTracking) {
      logEntry.performance = {
        timing: performance.now()
      }
    }

    // 内存监控（如果支持）
    if (this.debugConfig.enableMemoryTracking && 'memory' in performance) {
      logEntry.performance = {
        ...logEntry.performance,
        memory: (performance as any).memory?.usedJSHeapSize || 0
      }
    }

    // 存储日志条目
    this.logEntries.push(logEntry)

    // 限制日志条目数量，防止内存泄漏
    if (this.logEntries.length > this.debugConfig.maxLogEntries) {
      this.logEntries.splice(0, this.logEntries.length - this.debugConfig.maxLogEntries)
    }

    // 控制台输出
    const prefix = `[ContentScript:${level.toUpperCase()}]`
    const timeStr = new Date(timestamp).toISOString().substring(11, 23)
    const fullMessage = `${prefix} ${timeStr} ${message}`

    switch (level) {
      case 'debug':
        console.debug(fullMessage, data || '')
        break
      case 'info':
        console.log(fullMessage, data || '')
        break
      case 'warn':
        console.warn(fullMessage, data || '')
        break
      case 'error':
        console.error(fullMessage, data || '')
        break
    }
  }

  /**
   * 获取性能指标
   * 
   * @returns 性能指标对象
   */
  private getPerformanceMetrics(): Record<string, any> {
    const now = Date.now()
    const metrics = {
      ...this.performanceMetrics,
      uptime: now - this.performanceMetrics.lastUpdate,
      logEntries: this.logEntries.length,
      eventListeners: this.eventListeners.size
    }

    // 添加内存信息（如果支持）
    if ('memory' in performance) {
      const memory = (performance as any).memory
      metrics.memory = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      }
    }

    return metrics
  }

  /**
   * 清理资源和事件监听器
   * 防止内存泄漏
   */
  private cleanup(): void {
    try {
      this.debugLog('开始清理资源', undefined, 'info')

      // 清理事件监听器
      this.cleanupEventListeners()

      // 清理渲染器
      if (this.renderer) {
        // 如果渲染器有清理方法，调用它
        if (typeof (this.renderer as any).cleanup === 'function') {
          (this.renderer as any).cleanup()
        }
        this.renderer = null
      }

      // 清理日志条目（保留最近的100条）
      if (this.logEntries.length > 100) {
        this.logEntries.splice(0, this.logEntries.length - 100)
      }

      // 重置状态
      this.isActive = false
      this.isExtensionValid = true
      this.reconnectAttempts = 0

      this.debugLog('资源清理完成', this.getPerformanceMetrics(), 'info')

    } catch (error) {
      this.debugLog('资源清理失败', error, 'error')
    }
  }

  /**
   * 导出调试信息
   * 用于问题诊断和性能分析
   * 
   * @returns 调试信息对象
   */
  private exportDebugInfo(): Record<string, any> {
    return {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      config: this.config,
      performance: this.getPerformanceMetrics(),
      recentLogs: this.logEntries.slice(-50), // 最近50条日志
      eventListeners: Array.from(this.eventListeners.keys()),
      isActive: this.isActive,
      isExtensionValid: this.isExtensionValid,
      reconnectAttempts: this.reconnectAttempts
    }
  }

  /**
   * 公开方法：获取调试信息
   * 可通过控制台调用进行问题诊断
   */
  public getDebugInfo(): Record<string, any> {
    this.debugLog('导出调试信息', undefined, 'info')
    return this.exportDebugInfo()
  }

  /**
   * 公开方法：导出调试信息到文件
   * 便于问题报告和分析
   */
  public exportDebugInfoToFile(): void {
    try {
      const debugInfo = this.exportDebugInfo()
      const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `markdown-reader-debug-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
      
      this.debugLog('调试信息已导出到文件', undefined, 'info')
    } catch (error) {
      this.debugLog('导出调试信息到文件失败', error, 'error')
    }
  }

  private async renderMarkdown(content: string): Promise<void> {
    try {
      performanceMonitor.start('renderMarkdown')

      // 等待页面完全加载完成
      await this.waitForPageReady()

      // 确保样式表按优先级顺序加载 - 后加载优先权最高
      await this.ensureStylesLoaded()

      // 首先确保head中有必要的meta标签
      if (!document.querySelector('meta[name="color-scheme"]')) {
        const colorSchemeMeta = document.createElement('meta')
        colorSchemeMeta.name = 'color-scheme'
        colorSchemeMeta.content = 'light dark'
        document.head.appendChild(colorSchemeMeta)
      }

      if (!this.renderer) {
        throw new Error('渲染器未初始化')
      }

      const result = await this.renderer.render(content)

      if (!result.success) {
        throw new Error(result.error || '渲染失败')
      }

      // 创建新的容器
      const container = domUtils.createElement('div', {
        className: 'markdown-reader-container',
        innerHTML: `
          <div class="markdown-reader-content">
            ${result.content}
          </div>
        `
      })

      // 显示警告信息
      if (result.warnings && result.warnings.length > 0) {
        const warningDiv = domUtils.createElement('div', {
          className: 'markdown-warnings',
          innerHTML: result.warnings.map((warning: string) =>
            `<div class="warning-item">⚠️ ${warning}</div>`
          ).join('')
        })
        container.insertBefore(warningDiv, container.firstChild)
      }

      // 智能替换页面内容
      this.replaceContentIntelligently(container)

      // 动态渲染图表 - 这是关键的修复
      await this.renderChartsInContainer(container)

      performanceMonitor.end('renderMarkdown')
      logger.info('Markdown渲染完成')
    } catch (error) {
      errorHandler.handle(error, 'renderMarkdown')
      await this.showError('渲染失败', error instanceof Error ? error.message : '未知错误')
    }
  }

  // applyStyles方法已废弃，样式现在通过CSS文件和CSS变量自动应用

  private setupInteractions(): void {
    // 初始化Vue组件工具栏
    this.setupVueToolbar()

    // 主题切换 - 支持四种模式循环切换
    const themeBtn = document.getElementById('toggleTheme')
    themeBtn?.addEventListener('click', () => {
      const themes: Array<'light' | 'dark' | 'eyecare' | 'auto'> = ['light', 'dark', 'eyecare', 'auto']
      const currentIndex = themes.indexOf(this.config.theme as any)
      const nextIndex = (currentIndex + 1) % themes.length
      this.updateConfig({ theme: themes[nextIndex] })
    })

    // 导出HTML
    const exportBtn = document.getElementById('exportHtml')
    exportBtn?.addEventListener('click', () => {
      this.exportAsHtml()
    })

    // 代码复制功能
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('code-copy-btn')) {
        const code = decodeURIComponent(target.getAttribute('data-code') || '')
        navigator.clipboard.writeText(code).then(() => {
          target.textContent = '已复制!'
          setTimeout(() => {
            target.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            `
          }, 2000)
        })
      }
    })

    // 图片双击放大功能
    document.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG' && target.closest('.markdown-reader-container')) {
        e.preventDefault()
        this.openImageModal(target as HTMLImageElement)
      }
    })

    // 图片缩放功能（保留原有的toggleImageZoom）
    window.toggleImageZoom = (img: HTMLImageElement) => {
      img.classList.toggle('zoomed')
    }

    // 图片模态框功能
    window.openImageModal = (img: HTMLImageElement) => {
      this.openImageModal(img)
    }

    window.closeImageModal = () => {
      this.closeImageModal()
    }
  }

  /**
   * 设置Vue组件工具栏
   */
  private setupVueToolbar(): void {
    try {
      // 创建工具栏容器
      const toolbar = domUtils.createElement('div', {
        id: 'markdown-vue-toolbar',
        className: 'markdown-vue-toolbar',
        innerHTML: `
          <div class="toolbar-section">
            <button id="vue-settings-btn" class="toolbar-btn" title="设置">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            <button id="vue-export-btn" class="toolbar-btn" title="导出">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button id="vue-search-btn" class="toolbar-btn" title="搜索">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M21 21l-4.35-4.35"></path>
              </svg>
            </button>
            <button id="vue-performance-btn" class="toolbar-btn" title="性能监控">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
              </svg>
            </button>
          </div>
        `
      })

      // 添加工具栏到页面
      document.body.appendChild(toolbar)

      // 初始化智能工具栏管理器
      smartToolbarManager.initialize(toolbar)

      // 绑定事件处理器
      this.bindVueToolbarEvents()

      logger.info('Vue工具栏初始化完成')
    } catch (error) {
      logger.error('Vue工具栏初始化失败:', error)
    }
  }

  /**
   * 绑定Vue工具栏事件
   */
  private bindVueToolbarEvents(): void {
    // 设置按钮
    document.getElementById('vue-settings-btn')?.addEventListener('click', () => {
      // 通知智能工具栏管理器设置面板即将打开
      smartToolbarManager.setSettingsPanelOpen(true)

      vueComponentManager.showSettingsPanel(this.config, (newConfig) => {
        this.updateConfig(newConfig)
      }, () => {
        // 设置面板关闭回调
        smartToolbarManager.setSettingsPanelOpen(false)
      })
    })

    // 导出按钮
    document.getElementById('vue-export-btn')?.addEventListener('click', () => {
      const content = document.querySelector('.markdown-content')?.innerHTML || ''
      vueComponentManager.showExportDialog(content, this.config, (format, options) => {
        this.handleExport(format, options)
      })
    })

    // 搜索按钮
    document.getElementById('vue-search-btn')?.addEventListener('click', () => {
      vueComponentManager.showSearchPanel((query, options) => {
        this.handleSearch(query, options)
      })
    })

    // 性能监控按钮
    document.getElementById('vue-performance-btn')?.addEventListener('click', () => {
      // 获取基本性能信息
      const metrics = {
        timing: performance.timing,
        memory: (performance as any).memory || null,
        navigation: performance.navigation,
        timestamp: Date.now()
      }
      vueComponentManager.showPerformanceMonitor(metrics)
    })
  }

  /**
   * 处理导出操作
   */
  private handleExport(format: string, _options?: any): void {
    try {
      switch (format) {
        case 'html':
          this.exportAsHtml()
          break
        case 'pdf':
          window.print()
          break
        default:
          logger.warn('不支持的导出格式:', format)
      }
    } catch (error) {
      logger.error('导出失败:', error)
    }
  }

  /**
   * 处理搜索操作
   */
  private handleSearch(query: string, options?: any): void {
    try {
      if (!query.trim()) {
        logger.warn('搜索查询为空')
        return
      }

      // 获取渲染后的内容容器
      const contentContainer = document.querySelector('.markdown-content') || document.body

      // 清除之前的搜索高亮
      this.clearSearchHighlights(contentContainer)

      if (query.trim()) {
        // 执行搜索并高亮结果
        const results = this.searchInContent(contentContainer, query, options)
        logger.info(`搜索完成，找到 ${results} 个结果`)

        // 滚动到第一个结果
        const firstHighlight = document.querySelector('.search-highlight')
        if (firstHighlight) {
          firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    } catch (error) {
      logger.error('搜索失败:', error)
    }
  }

  /**
   * 在内容中搜索并高亮
   */
  private searchInContent(container: Element, query: string, _options?: any): number {
    let resultCount = 0
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    )

    const textNodes: Text[] = []
    let node: Node | null

    // 收集所有文本节点
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        textNodes.push(node as Text)
      }
    }

    // 在文本节点中搜索并高亮
    textNodes.forEach(textNode => {
      const text = textNode.textContent || ''
      if (regex.test(text)) {
        const highlightedText = text.replace(regex, '<span class="search-highlight">$&</span>')
        const wrapper = document.createElement('span')
        wrapper.innerHTML = highlightedText

        // 计算匹配数量
        const matches = text.match(regex)
        if (matches) {
          resultCount += matches.length
        }

        // 替换原文本节点
        textNode.parentNode?.replaceChild(wrapper, textNode)
      }
    })

    return resultCount
  }

  /**
   * 清除搜索高亮
   */
  private clearSearchHighlights(container: Element): void {
    const highlights = container.querySelectorAll('.search-highlight')
    highlights.forEach(highlight => {
      const parent = highlight.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight)
        parent.normalize() // 合并相邻的文本节点
      }
    })
  }

  private setupMessageListener(): void {
    if (!this.checkExtensionContext()) {
      logger.warn('扩展上下文无效，无法设置消息监听')
      return
    }

    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, _sender, sendResponse) => {
        // 检查扩展上下文
        if (!this.checkExtensionContext()) {
          logger.warn('扩展上下文无效，忽略消息')
          sendResponse({ success: false, error: '扩展上下文无效' })
          return false
        }

        errorHandler.handleAsync(async () => {
          const response = await this.handleMessage(message)
          sendResponse(response)
        }, 'messageListener')

        return true // 保持消息通道开放
      }
    )
  }

  private async handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
    try {
      // 检查扩展上下文
      if (!this.checkExtensionContext()) {
        return { success: false, error: '扩展上下文无效' }
      }

      switch (message.type) {
        case 'GET_STATE':
          return {
            success: true,
            data: {
              isActive: this.isActive,
              isMarkdownFile: this.isMarkdownFile(),
              config: this.config,
              url: window.location.href
            }
          }

        case 'UPDATE_CONFIG':
          await this.updateConfig(message.payload)
          return { success: true }

        case 'UPDATE_STYLE_CONFIG':
          if (message.config) {
            await this.updateStyleConfig(message.config as MarkdownConfig)
            return { success: true }
          }
          return { success: false, error: '缺少配置参数' }

        case 'RENDER_MARKDOWN':
          if (this.renderer && message.payload) {
            await this.renderMarkdown(message.payload)
            return { success: true }
          }
          return { success: false, error: '渲染器未初始化或内容为空' }

        case 'PING':
          return { success: true, data: { status: 'alive' } }

        case 'PRINT_PAGE':
          window.print()
          return { success: true }

        case 'EXPORT_HTML':
          this.exportAsHtml()
          return { success: true }

        default:
          return { success: false, error: '未知消息类型' }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '处理消息失败'
      }
    }
  }

  private async updateStyleConfig(config: MarkdownConfig): Promise<void> {
    try {
      console.log('更新样式配置:', config)

      // 应用强调色
      if (config.accentColor) {
        cssVariableManager.setAccentColor(config.accentColor)
      }

      // 应用主题
      if (config.theme) {
        cssVariableManager.setTheme(config.theme)
      }

      // 应用字体设置
      if (config.fontSize || config.lineHeight) {
        cssVariableManager.setTypography(config.fontSize, config.lineHeight)
      }

      // 应用最大宽度
      if (config.maxWidth) {
        cssVariableManager.setMaxWidth(config.maxWidth)
      }

      // 应用字体家族
      if (config.fontFamily) {
        cssVariableManager.setFontFamily(config.fontFamily)
      }

      // 更新本地配置
      this.config = { ...this.config, ...config }

      // 如果有渲染器，更新渲染器配置（但不重新渲染）
      if (this.renderer) {
        this.renderer.updateConfig(this.config)
      }

      // 注意：不再重新渲染页面，避免影响UI组件
      // 样式更改会通过CSS变量自动应用到现有内容

      console.log('样式配置更新完成')
    } catch (error) {
      console.error('更新样式配置失败:', error)
    }
  }

  private async updateConfig(newConfig: Partial<MarkdownConfig>): Promise<void> {
    try {
      // 检查扩展上下文
      if (!this.checkExtensionContext()) {
        logger.warn('扩展上下文无效，无法更新配置')
        return
      }

      // 使用节流机制避免频繁更新
      const now = Date.now()
      const timeDiff = now - (this.lastConfigUpdate || 0)

      if (timeDiff < 500) { // 500ms内不重复更新
        return
      }

      console.log('更新配置:', newConfig)
      this.config = { ...this.config, ...newConfig }
      this.lastConfigUpdate = now

      // 立即应用样式更新，但不重新渲染页面
      if (newConfig.accentColor) {
        console.log('应用强调色:', newConfig.accentColor)
        cssVariableManager.setAccentColor(newConfig.accentColor)
      }

      if (newConfig.theme) {
        console.log('应用主题:', newConfig.theme)
        cssVariableManager.setTheme(newConfig.theme)
      }

      if (newConfig.fontSize || newConfig.lineHeight) {
        console.log('应用字体设置:', { fontSize: newConfig.fontSize, lineHeight: newConfig.lineHeight })
        cssVariableManager.setTypography(
          newConfig.fontSize || this.config.fontSize,
          newConfig.lineHeight || this.config.lineHeight
        )
      }

      if (newConfig.maxWidth) {
        console.log('应用最大宽度:', newConfig.maxWidth)
        cssVariableManager.setMaxWidth(newConfig.maxWidth)
      }

      if (newConfig.fontFamily) {
        console.log('应用字体家族:', newConfig.fontFamily)
        cssVariableManager.setFontFamily(newConfig.fontFamily)
      }

      // 保存到chrome.storage（使用节流）
      if (timeDiff > 1000) { // 只有超过1秒才写入存储
        try {
          await chrome.storage.sync.set({ 'markdown-config': this.config })
          console.log('配置已保存到存储')
        } catch (error) {
          logger.warn('保存配置到存储失败:', error)
        }
      }

      // 更新渲染器配置（但不重新渲染）
      if (this.renderer) {
        this.renderer.updateConfig(this.config)
        console.log('渲染器配置已更新')
      }

      // 注意：移除重新渲染逻辑，避免影响UI组件
      // 样式更改会通过CSS变量自动应用到现有内容

      logger.info('配置已更新', newConfig)
    } catch (error) {
      logger.error('更新配置失败:', error)
    }
  }

  /**
   * 智能替换页面内容，保留重要的页面元素
   */
  private replaceContentIntelligently(container: HTMLElement): void {
    // 保存原始内容的引用
    const originalBody = document.body.cloneNode(true) as HTMLElement

    // 尝试找到主要内容区域进行替换
    const contentSelectors = [
      // GitHub特定
      '.file',
      '.blob-wrapper',
      '.markdown-body',
      '.readme',

      // GitLab特定
      '.file-content',
      '.wiki-content',

      // 通用内容区域
      'main',
      'article',
      '.content',
      '.document',
      '#content',
      '.main-content',

      // 最后的备选
      'body'
    ]

    let targetElement: Element | null = null

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector)
      if (element && element !== document.body) {
        targetElement = element
        console.log(`找到内容容器: ${selector}`)
        break
      }
    }

    if (targetElement) {
      // 保存原始内容
      const originalContent = targetElement.innerHTML
      const originalElement = targetElement as HTMLElement

      // 创建一个包装器来保存原始内容
      const originalWrapper = document.createElement('div')
      originalWrapper.className = 'md-original-content-wrapper md-original-content-hidden'
      originalWrapper.innerHTML = originalContent

      // 清空目标元素并添加原始内容包装器和新容器
      originalElement.innerHTML = ''
      originalElement.appendChild(originalWrapper)
      originalElement.appendChild(container)

      console.log('已保存原始内容并替换为Markdown渲染')
    } else {
      // 如果没有找到特定容器，创建一个覆盖层
      console.log('创建覆盖层模式')
      this.createOverlayMode(container, originalBody)
    }

    // 添加一个恢复按钮，允许用户查看原始内容
    this.addRestoreButton(originalBody)
  }

  /**
   * 创建覆盖层模式，保留原始页面但显示渲染内容
   */
  private createOverlayMode(container: HTMLElement, _originalBody: HTMLElement): void {
    // 隐藏原始内容但不删除
    const originalContent = document.body.children
    for (let i = 0; i < originalContent.length; i++) {
      const element = originalContent[i] as HTMLElement
      if (element) {
        // 使用CSS类而非内联样式
        element.classList.add('md-original-content-hidden')
        element.setAttribute('data-original-display', getComputedStyle(element).display || 'block')
      }
    }

    // 添加渲染容器
    document.body.appendChild(container)

    // 通过CSS类设置覆盖层样式，避免内联样式注入
    container.classList.add('markdown-overlay-mode')
  }

  /**
   * 添加恢复原始内容的按钮
   */
  private addRestoreButton(_originalBody: HTMLElement): void {
    // 检查是否已经存在恢复按钮，避免重复创建
    const existingBtn = document.querySelector('.md-restore-button')
    if (existingBtn) {
      console.log('恢复按钮已存在，跳过创建')
      return
    }

    const restoreBtn = domUtils.createElement('button', {
      className: 'restore-original-btn',
      innerHTML: `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2-2z"></path>
          <polyline points="8,1 16,1 16,7 8,7 8,1"></polyline>
        </svg>
        查看原始页面
      `
    })

    // 使用CSS类设置按钮样式，避免内联样式注入
    restoreBtn.classList.add('md-restore-button')

    restoreBtn.addEventListener('click', () => {
      this.toggleOriginalContent()
    })

    // 悬停效果现在通过CSS处理，无需JavaScript设置内联样式

    document.body.appendChild(restoreBtn)
    console.log('恢复按钮创建成功')
  }

  /**
   * 切换显示原始内容和渲染内容
   */
  private toggleOriginalContent(): void {
    const markdownContainer = document.querySelector('.markdown-reader-container') as HTMLElement
    const restoreBtn = document.querySelector('.md-restore-button') as HTMLElement

    if (!markdownContainer || !restoreBtn) return

    const isShowingMarkdown = !markdownContainer.classList.contains('md-content-hidden')

    if (isShowingMarkdown) {
      // 显示原始内容，隐藏Markdown渲染
      markdownContainer.classList.add('md-content-hidden')

      // 检查是否有原始内容包装器（容器替换模式）
      const originalWrapper = document.querySelector('.md-original-content-wrapper') as HTMLElement
      if (originalWrapper) {
        // 容器替换模式：显示原始内容包装器
        originalWrapper.classList.remove('md-original-content-hidden')
        originalWrapper.classList.add('md-content-restored')
      } else {
        // 覆盖层模式：恢复原始元素的显示
        const hiddenElements = document.querySelectorAll('.md-original-content-hidden')
        hiddenElements.forEach(element => {
          element.classList.remove('md-original-content-hidden')
          element.classList.add('md-content-restored')
        })
      }

      restoreBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        查看Markdown渲染
      `
    } else {
      // 显示Markdown渲染，隐藏原始内容
      markdownContainer.classList.remove('md-content-hidden')

      // 检查是否有原始内容包装器（容器替换模式）
      const originalWrapper = document.querySelector('.md-original-content-wrapper') as HTMLElement
      if (originalWrapper) {
        // 容器替换模式：隐藏原始内容包装器
        originalWrapper.classList.remove('md-content-restored')
        originalWrapper.classList.add('md-original-content-hidden')
      } else {
        // 覆盖层模式：隐藏原始元素
        const visibleElements = document.querySelectorAll('.md-content-restored')
        visibleElements.forEach(element => {
          element.classList.remove('md-content-restored')
          element.classList.add('md-original-content-hidden')
        })
      }

      restoreBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2-2z"></path>
          <polyline points="8,1 16,1 16,7 8,7 8,1"></polyline>
        </svg>
        查看原始页面
      `
    }
  }

  private async showError(title: string, message: string): Promise<void> {
    // 等待页面加载完成
    await this.waitForPageReady()

    // 确保样式表已加载
    await this.ensureStylesLoaded()

    // 首先确保head中有必要的meta标签
    if (!document.querySelector('meta[name="color-scheme"]')) {
      const colorSchemeMeta = document.createElement('meta')
      colorSchemeMeta.name = 'color-scheme'
      colorSchemeMeta.content = 'light dark'
      document.head.appendChild(colorSchemeMeta)
    }

    const errorContainer = domUtils.createElement('div', {
      className: 'markdown-error-container',
      innerHTML: `
        <div class="error-content">
          <div class="error-icon">❌</div>
          <h2 class="error-title">${title}</h2>
          <p class="error-message">${message}</p>
          <button class="error-retry" onclick="location.reload()">重新加载</button>
        </div>
      `
    })

    document.body.innerHTML = ''
    document.body.appendChild(errorContainer)
  }

  private exportAsHtml(): void {
    const content = document.querySelector('.markdown-reader-content')?.innerHTML || ''
    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <title>Markdown Export</title>
        <link rel="stylesheet" href="chrome-extension://${chrome.runtime.id}/src/styles/apple-design-system.css">
        <link rel="stylesheet" href="chrome-extension://${chrome.runtime.id}/src/styles/content-variables.css">
        <link rel="stylesheet" href="chrome-extension://${chrome.runtime.id}/src/styles/enhanced-components.css">
        <link rel="stylesheet" href="chrome-extension://${chrome.runtime.id}/src/styles/content.css">
        <style>
          /* 基础样式 */
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei UI', sans-serif;
            margin: 0;
            padding: 0;
            background-color: var(--md-bg-color, #ffffff);
            color: var(--md-text-color, #1d1d1f);
          }
          .markdown-reader-content { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
            line-height: 1.6;
          }
          
          /* 暗色模式支持 */
          @media (prefers-color-scheme: dark) {
            body {
              background-color: var(--md-bg-color-dark, #1d1d1f);
              color: var(--md-text-color-dark, #f5f5f7);
            }
          }
        </style>
      </head>
      <body>
        <div class="markdown-reader-content">${content}</div>
      </body>
      </html>
    `

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'markdown-export.html'
    link.click()
    URL.revokeObjectURL(url)
  }

  /**
   * 打开图片模态框
   */
  private openImageModal(img: HTMLImageElement): void {
    // 检查是否已存在模态框
    const existingModal = document.getElementById('image-modal')
    if (existingModal) {
      this.closeImageModal()
      return
    }

    // 创建模态框
    const modal = document.createElement('div')
    modal.className = 'image-modal'
    modal.id = 'image-modal'

    const modalContent = document.createElement('div')
    modalContent.className = 'image-modal-content'



    // 克隆图片
    const clonedImg = img.cloneNode(true) as HTMLImageElement
    clonedImg.style.maxWidth = '90vw'
    clonedImg.style.maxHeight = '90vh'
    clonedImg.style.width = 'auto'
    clonedImg.style.height = 'auto'
    clonedImg.style.objectFit = 'contain'

    modalContent.appendChild(clonedImg)
    modal.appendChild(modalContent)
    document.body.appendChild(modal)

    // 显示模态框
    setTimeout(() => {
      modal.classList.add('show')
    }, 10)

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeImageModal()
      }
    })

    // ESC键关闭
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeImageModal()
        document.removeEventListener('keydown', handleEscape)
      }
    }
    document.addEventListener('keydown', handleEscape)
  }

  /**
   * 关闭图片模态框
   */
  private closeImageModal(): void {
    const modal = document.getElementById('image-modal')
    if (modal) {
      modal.classList.remove('show')
      setTimeout(() => {
        modal.remove()
      }, 300)
    }
  }
}

// 全局函数声明
declare global {
  interface Window {
    toggleImageZoom: (img: HTMLImageElement) => void
    openImageModal: (img: HTMLImageElement) => void
    closeImageModal: () => void
    toggleChartSource: (chartId: string) => void
    openChartModal: (chartId: string) => void
    closeChartModal: () => void
    retryChartRender: (chartId: string, chartType: string, encodedContent: string) => Promise<void>
    __markdownReaderInitialized?: boolean
  }
}

// CRXJS 导出函数
export function onExecute() {
  // 防止重复初始化
  if (window.__markdownReaderInitialized) {
    console.log('Markdown Reader 已经初始化，跳过重复初始化')
    return
  }

  // 标记为已初始化
  window.__markdownReaderInitialized = true

  // 添加全局切换图表源码显示函数
  window.toggleChartSource = (chartId: string) => {
    const sourceElement = document.getElementById(`${chartId}-source`)
    const button = document.querySelector(`[data-chart-id="${chartId}"][data-action="toggle-source"]`) as HTMLButtonElement

    if (sourceElement && button) {
      const isVisible = sourceElement.style.display !== 'none'
      sourceElement.style.display = isVisible ? 'none' : 'block'
      button.textContent = isVisible ? '查看源码' : '隐藏源码'
      
      // 应用苹果风格的按钮状态切换
      if (isVisible) {
        // 隐藏状态 - 恢复默认样式
        button.classList.remove('active')
        button.removeAttribute('data-active')
        button.style.background = ''
        button.style.color = ''
        button.style.borderColor = ''
        button.style.boxShadow = ''
      } else {
        // 显示状态 - 激活样式
        button.classList.add('active')
        button.setAttribute('data-active', 'true')
      }
    }
  }

  // 添加事件委托来处理图表按钮点击
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    
    // 处理查看源码按钮点击
    if (target.classList.contains('view-source-btn') && target.hasAttribute('data-action') && target.hasAttribute('data-chart-id')) {
      const action = target.getAttribute('data-action')
      const chartId = target.getAttribute('data-chart-id')
      
      if (action === 'toggle-source' && chartId) {
        event.preventDefault()
        event.stopPropagation()
        window.toggleChartSource(chartId)
      }
    }
  })

  // 添加全局图片模态框功能
  window.openImageModal = (img: HTMLImageElement) => {
    // 检查是否已存在模态框
    const existingModal = document.getElementById('image-modal')
    if (existingModal) {
      window.closeImageModal()
      return
    }

    // 创建模态框
    const modal = document.createElement('div')
    modal.className = 'image-modal'
    modal.id = 'image-modal'

    const modalContent = document.createElement('div')
    modalContent.className = 'image-modal-content'



    // 克隆图片
    const clonedImg = img.cloneNode(true) as HTMLImageElement
    clonedImg.style.maxWidth = '90vw'
    clonedImg.style.maxHeight = '90vh'
    clonedImg.style.width = 'auto'
    clonedImg.style.height = 'auto'
    clonedImg.style.objectFit = 'contain'

    modalContent.appendChild(clonedImg)
    modal.appendChild(modalContent)
    document.body.appendChild(modal)

    // 显示模态框
    setTimeout(() => {
      modal.classList.add('show')
    }, 10)

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        window.closeImageModal()
      }
    })

    // ESC键关闭
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.closeImageModal()
        document.removeEventListener('keydown', handleEscape)
      }
    }
    document.addEventListener('keydown', handleEscape)
  }

  // 添加全局关闭图片模态框功能
  window.closeImageModal = () => {
    const modal = document.getElementById('image-modal')
    if (modal) {
      modal.classList.remove('show')
      setTimeout(() => {
        modal.remove()
      }, 300)
    }
  }

  // 添加全局重试图表渲染函数
  window.retryChartRender = async (chartId: string, chartType: string, encodedContent: string) => {
    try {
      const { asyncChartRenderer } = await import('../utils/asyncChartRenderer')
      const chartContent = decodeURIComponent(encodedContent)

      console.log(`重试渲染图表: ${chartType} (${chartId})`)

      // 清除错误状态
      const chartContainer = document.getElementById(chartId)
      if (chartContainer) {
        const errorElement = chartContainer.querySelector('.chart-error') as HTMLElement
        const loadingElement = chartContainer.querySelector('.chart-loading') as HTMLElement

        if (errorElement) errorElement.style.display = 'none'
        if (loadingElement) {
          loadingElement.style.display = 'block'
          loadingElement.innerHTML = `
            <div class="loading-spinner">
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
            </div>
            <div class="loading-text">重新渲染 ${chartType.toUpperCase()} 图表 (Kroki)...</div>
          `
        }
      }

      // 重新渲染图表
      await asyncChartRenderer.renderChart({
        type: chartType as any,
        content: chartContent,
        containerId: chartId,
        timeout: 15000,
        retryCount: 3,
        cacheEnabled: false // 重试时不使用缓存
      })

      console.log(`图表重试渲染成功: ${chartType} (${chartId})`)
    } catch (error) {
      console.error(`图表重试渲染失败: ${chartType} (${chartId})`, error)

      // 显示重试失败的错误信息
      const chartContainer = document.getElementById(chartId)
      if (chartContainer) {
        const errorElement = chartContainer.querySelector('.chart-error') as HTMLElement
        const loadingElement = chartContainer.querySelector('.chart-loading') as HTMLElement

        if (loadingElement) loadingElement.style.display = 'none'
        if (errorElement) {
          errorElement.style.display = 'block'
          errorElement.innerHTML = `
            <div class="error-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
                <path d="M16 16l16 16M32 16l-16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="error-title">图表重试失败</div>
            <div class="error-message">${error instanceof Error ? error.message : '未知错误'}</div>
            <div class="error-message">请检查图表语法是否正确或网络连接</div>
            <button class="retry-btn" onclick="window.retryChartRender('${chartId}', '${chartType}', '${encodedContent}')">
              再次重试
            </button>
          `
        }
      }
    }
  }

  // 初始化Content Script
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new ContentScriptApp()
    })
  } else {
    new ContentScriptApp()
  }
}

// 兼容性：直接执行（用于开发模式）
if (typeof window !== 'undefined') {
  onExecute()
}