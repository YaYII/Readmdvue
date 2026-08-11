// Vue组件集成系统
import { vueComponentManager } from './vueIntegration'
import { MarkdownRenderer } from '../utils/markdownRenderer'
import { logger, performanceMonitor, errorHandler, themeUtils, domUtils } from '../utils'
import { cssVariableManager } from '../utils/cssVariableManager'
import { smartToolbarManager } from '../utils/smartToolbarManager'
import type { MarkdownConfig, ExtensionMessage, ExtensionResponse, Theme, AccentColor } from '../types'
import { defaultConfig } from '../types'

// KaTeX 样式静态引入（vite 会合并进 content CSS；字体由 @font-face 按需加载）
import 'katex/dist/katex.min.css'
// KaTeX 静态引入（此前动态 import 在 file:// 页面产生相对路径 CORS 问题，改静态 100% 可靠）
import katex from 'katex'

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
  /** 当前渲染的 markdown 内容（配置变更后用于立即重渲染） */
  private currentMarkdownContent: string | null = null
  /** 重渲染防抖定时器 */
  private reRenderTimer: number | null = null
  /** 重渲染前保存的滚动位置 */
  private reRenderScrollY = 0
  private config: MarkdownConfig = { ...defaultConfig }
  private isActive = false
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
   * 显示通知消息
   */
  private showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    // 创建通知元素
    const notification = document.createElement('div')
    notification.className = `markdown-reader-notification notification-${type}`
    notification.textContent = message

    // 添加样式
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '8px',
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '10000',
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transition: 'all 0.3s ease',
      opacity: '0',
      transform: 'translateX(100%)'
    })

    // 根据类型设置背景色
    const colors = {
      info: '#007AFF',
      success: '#30D158',
      warning: '#FF9500',
      error: '#FF3B30'
    }
    notification.style.backgroundColor = colors[type]

    // 添加到页面
    document.body.appendChild(notification)

    // 显示动画
    requestAnimationFrame(() => {
      notification.style.opacity = '1'
      notification.style.transform = 'translateX(0)'
    })

    // 自动移除
    setTimeout(() => {
      notification.style.opacity = '0'
      notification.style.transform = 'translateX(100%)'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 3000)
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

      // 兜底注入 Inter 字体（绝对扩展 URL）：
      // manifest content_scripts CSS 中的相对 url 在 file:// 等协议页面可能被浏览器按页面 URL 解析而 404，
      // 动态注入同名 @font-face 覆盖，保证任意页面协议下字体都从扩展根加载
      this.injectInterFontFace()

      // 强制约束所有 file:// 链接：无论当前页面协议（http/https/file），
      // 凡目标是 file:// 的链接点击一律拦截——file:// 被视为独立安全源，
      // 任何跨源导航/加载都会触发 "Unsafe attempt to load URL" 报错
      this.interceptFileProtocolLinks()

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
      } else {
        // 非Markdown文档：静默退出，不渲染、不弹通知、不打扰用户
        this.debugLog('非Markdown文档，静默退出')
        this.isActive = false
        return
      }

    } catch (error) {
      this.debugLog('Content Script 初始化失败', error, 'error')
      errorHandler.handle(error, 'ContentScript.init')
    }
  }

  private interceptFileProtocolLinks(): void {
    try {
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null
        if (!target) return
        const anchor = target.closest('a[href]') as HTMLAnchorElement | null
        if (!anchor) return
        const rawHref = anchor.getAttribute('href') || ''
        // 锚点跳转与网络协议链接放行
        if (
          rawHref.startsWith('#') ||
          rawHref.startsWith('http://') ||
          rawHref.startsWith('https://') ||
          rawHref.startsWith('mailto:') ||
          rawHref.startsWith('tel:')
        ) return
        // 解析后为 file: 协议 → 强制拦截（file:// 独立安全源，导航必报错）
        if (!anchor.href.startsWith('file:')) return
        e.preventDefault()
        this.showError(
          '无法打开本地链接',
          '本地文件链接（file://）受浏览器安全策略限制，无法直接打开。\n请在浏览器地址栏手动打开该文件。'
        )
        this.debugLog('已拦截 file:// 本地链接点击', rawHref)
      }, true)
    } catch (error) {
      this.debugLog('本地链接拦截器安装失败', error)
    }
  }

  /**
   * 动态注入 Inter 字体的 @font-face（使用 chrome.runtime.getURL 绝对路径），
   * 覆盖 CSS 相对路径在特殊协议（file://）页面解析失败的问题
   */
  private injectInterFontFace(): void {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) return
      const fontUrl = chrome.runtime.getURL('fonts/inter-latin-wght-normal.woff2')
      if (document.getElementById('inter-font-face')) return
      const style = document.createElement('style')
      style.id = 'inter-font-face'
      style.textContent = `@font-face{font-family:'Inter';src:url('${fontUrl}') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}`
      ;(document.head || document.documentElement).appendChild(style)
      this.debugLog('Inter 字体兜底注入完成', fontUrl)
    } catch (error) {
      this.debugLog('Inter 字体兜底注入失败', error)
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
        // 在开发环境中显示详细信息，生产环境中静默处理
        if (import.meta.env.DEV) {
          this.debugLog('页面可见时发现扩展上下文无效，尝试重连', undefined, 'warn')
        } else {
          this.debugLog('扩展上下文检查中，尝试重连', undefined, 'info')
        }
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
      // 在开发环境中显示详细错误，生产环境中静默处理
      if (import.meta.env.DEV) {
        logger.warn('检查扩展上下文失败:', error)
      }
      return false
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // 在生产环境中使用更友好的日志级别
      if (import.meta.env.DEV) {
        logger.error('达到最大重连次数，停止重连')
      } else {
        logger.info('扩展连接已停止')
      }
      this.isExtensionValid = false
      return
    }

    this.reconnectAttempts++

    // 在开发环境中显示详细的重连信息
    if (import.meta.env.DEV) {
      logger.info(`尝试重连扩展上下文 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    }

    // 等待一段时间后重试
    await new Promise(resolve => setTimeout(resolve, 1000 * this.reconnectAttempts))

    if (this.checkExtensionContext()) {
      if (import.meta.env.DEV) {
        logger.info('扩展上下文重连成功')
      }
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
        // 在开发环境中显示详细警告，生产环境中静默处理
        if (import.meta.env.DEV) {
          logger.warn('检测到扩展上下文失效')
        }
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
    } else {
      console.log('未通过文件扩展名识别为Markdown文件')
      //return false
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
    // if (this.detectMarkdownContent()) {
    //   console.log('通过内容特征识别为Markdown文件')
    //   return true
    // }

    // 如果以上检测都不匹配，则不是Markdown文件
    console.log('未识别为Markdown文件，程序将停止运行:', { url, pathname, contentType })
    return false
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

  private async loadConfig(): Promise<void> {
    try {
      if (!this.checkExtensionContext()) {
        logger.warn('扩展上下文无效，无法加载配置')
        return
      }

      // 使用与markdown.ts相同的存储键名
      const result = await chrome.storage.sync.get('markdown-config')
      if (result['markdown-config']) {
        const stored = result['markdown-config'] as Partial<MarkdownConfig>
        // 强制默认深色：未设置主题或仍为旧的 auto 默认 → 初始化为 dark 并持久化
        // （用户多数不设置主题，开箱即深色护眼，更纯粹）
        if (!stored.theme || stored.theme === 'auto') {
          stored.theme = 'dark'
          this.config = { ...this.config, ...stored }
          chrome.storage.sync.set({ 'markdown-config': this.config }).catch(() => {})
        } else {
          this.config = { ...this.config, ...stored }
        }
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

    // 应用渲染皮肤（gov=政府公文 / free=自由现代），通过 data-skin 属性切换 CSS 覆盖
    const markdownContainer = document.querySelector('.markdown-reader-container') as HTMLElement | null
    if (markdownContainer) {
      markdownContainer.setAttribute('data-skin', this.config.skin || 'gov')
    }

    // 应用强调色
    if (this.config.accentColor) {
      const customColor = this.config.accentColor === 'custom' ? this.config.customAccentColor : undefined
      cssVariableManager.setAccentColor(this.config.accentColor, customColor)
      console.log('已应用强调色:', this.config.accentColor, customColor)
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

    // 应用最大宽度（0 = 自适应，必须显式判断 !== undefined，否则 0 会被忽略）
    if (this.config.maxWidth !== undefined) {
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

  /**
   * 渲染数学公式：将 markdownRenderer 产出的 .math-inline/.math-block 中的
   * LaTeX 源码交给 KaTeX 真正排版（此前只有 CSS 包裹、从未调用 KaTeX）。
   * KaTeX 按需懒加载：仅当页面存在公式时才加载 JS/CSS/字体。
   */
  private async renderMathInContainer(container: HTMLElement): Promise<void> {
    try {
      if (!this.config.enableMath || this.config.mathRenderer !== 'katex') return

      const mathElements = container.querySelectorAll<HTMLElement>('.math-inline, .math-block')
      if (mathElements.length === 0) return

      // 懒加载 KaTeX（JS + CSS，vite 会将其拆分为独立 chunk，仅含公式页面才加载）
      mathElements.forEach((el) => {
        const displayMode = el.classList.contains('math-block')
        const tex = (el.textContent || '').trim()
        try {
          katex.render(tex, el, {
            displayMode,
            throwOnError: false,
            output: 'html',
            strict: false
          })
        } catch (err) {
          // 渲染失败时显示红色错误样式并保留源码
          el.classList.add('math-error')
          el.textContent = tex
          this.debugLog('KaTeX 公式渲染失败', { tex, error: err })
        }
      })
    } catch (error) {
      this.debugLog('KaTeX 加载失败，公式将以源码显示', error)
    }
  }

  /**
   * 表格字体自适应：以用户设置字号为基准，若单元格内容单行放不下（会大量换行），
   * 逐档缩小表格字号（每次 -1px）直到内容可容纳或达到最小 9px。
   * 测量法（性能优化）：整表批量 nowrap → 单次读取 table.scrollWidth 与 clientWidth
   * 对比（每轮仅 2 次强制布局，替代逐单元格循环测量——大文档 220+ 表格时避免 layout thrashing）。
   */
  private autoFitTableFont(container: HTMLElement): void {
    try {
      const MIN_FONT = 9
      const MAX_ROUNDS = 4
      const tables = container.querySelectorAll<HTMLTableElement>('table')
      if (tables.length === 0) return

      tables.forEach((table) => {
        const cells = Array.from(table.querySelectorAll<HTMLElement>('th, td'))
        if (cells.length === 0) return

        // 当前生效字号（继承用户设置）
        let current = parseFloat(window.getComputedStyle(table).fontSize) || 16

        let guard = 0
        while (guard < MAX_ROUNDS) {
          // 批量 nowrap 测量（单次布局）：整表单行宽度 vs 容器宽度
          const originals = cells.map((cell) => cell.style.whiteSpace)
          cells.forEach((cell) => { cell.style.whiteSpace = 'nowrap' })
          const overflow = table.scrollWidth > table.clientWidth + 1
          cells.forEach((cell, index) => { cell.style.whiteSpace = originals[index] })

          if (!overflow || current <= MIN_FONT) break
          current = Math.max(MIN_FONT, current - 1)
          table.style.fontSize = `${current}px`
          guard++
        }
        this.debugLog('表格字体自适应完成', {
          table: table.className || 'table',
          fontSize: current,
          adjusted: guard > 0
        })
      })
    } catch (error) {
      this.debugLog('表格字体自适应失败', error)
    }
  }

  // 调试系统配置
  private debugConfig = {
    enabled: true,
    // 生产环境只显示错误，开发环境显示所有信息
    level: (import.meta.env.PROD ? 'error' : 'info') as 'debug' | 'info' | 'warn' | 'error',
    maxLogEntries: import.meta.env.PROD ? 100 : 1000, // 生产环境减少日志存储
    enablePerformanceTracking: !import.meta.env.PROD, // 生产环境关闭性能跟踪
    enableMemoryTracking: !import.meta.env.PROD // 生产环境关闭内存跟踪
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

    // 日志级别过滤
    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 }
    if (levelPriority[level] < levelPriority[this.debugConfig.level]) {
      return // 跳过低于配置级别的日志
    }

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
   * 停止插件运行
   * 完全停止插件在当前页面的所有功能
   */
  async stopExtension(reason: string = 'user_requested'): Promise<void> {
    try {
      this.debugLog(`停止插件运行，原因: ${reason}`, undefined, 'info')

      // 显示停止通知
      this.showNotification('🛑 Markdown Reader Vue 已停止运行', 'info')

      // 执行完整清理
      this.cleanup()

      // 清理Vue组件
      if (vueComponentManager) {
        vueComponentManager.destroy()
      }

      // 清理智能工具栏
      if (smartToolbarManager) {
        smartToolbarManager.destroy()
      }

      // 移除所有插件添加的DOM元素
      this.removeAllPluginElements()

      // 恢复原始页面内容
      this.restoreOriginalContent()

      // 清理CSS变量
      cssVariableManager.reset()

      // 移除样式表
      this.removePluginStylesheets()

      // 标记为非活跃状态
      this.isActive = false

      // 清理全局变量
      this.cleanupGlobalVariables()

      this.debugLog('插件已完全停止运行', undefined, 'info')

    } catch (error) {
      this.debugLog('停止插件运行失败', error, 'error')
      throw error
    }
  }

  /**
   * 禁用插件功能
   * 保留基本结构但禁用所有交互功能
   */
  async disableExtension(reason: string = 'user_disabled'): Promise<void> {
    try {
      this.debugLog(`禁用插件功能，原因: ${reason}`, undefined, 'info')

      // 显示禁用通知
      this.showNotification('⏸️ Markdown Reader Vue 已禁用', 'warning')

      // 禁用所有交互功能
      this.disableInteractions()

      // 隐藏工具栏和组件
      if (smartToolbarManager) {
        try {
          smartToolbarManager.destroy()
        } catch (error) {
          this.debugLog('隐藏工具栏失败', error, 'error')
        }
      }

      // 隐藏Vue组件
      if (vueComponentManager) {
        try {
          vueComponentManager.destroy()
        } catch (error) {
          this.debugLog('隐藏Vue组件失败', error, 'error')
        }
      }

      // 添加禁用样式
      this.addDisabledStyles()

      // 标记为非活跃状态
      this.isActive = false

      this.debugLog('插件功能已禁用', undefined, 'info')

    } catch (error) {
      this.debugLog('禁用插件功能失败', error, 'error')
      throw error
    }
  }

  /**
   * 清理插件资源
   * 清理缓存、临时文件等资源
   */
  async cleanupExtension(reason: string = 'user_cleanup'): Promise<void> {
    try {
      this.debugLog(`清理插件资源，原因: ${reason}`, undefined, 'info')

      // 显示清理通知
      this.showNotification('🧹 正在清理 Markdown Reader Vue 资源...', 'info')

      // 执行基本清理
      this.cleanup()

      // 清理缓存
      this.clearCache()

      // 清理临时DOM元素
      this.cleanupTemporaryElements()

      // 清理性能监控数据
      // PerformanceMonitor是静态类，不需要清理实例

      // 清理日志
      this.logEntries = []

      // 重置配置到默认值
      this.config = { ...defaultConfig }

      this.showNotification('✅ Markdown Reader Vue 资源清理完成', 'success')
      this.debugLog('插件资源清理完成', undefined, 'info')

    } catch (error) {
      this.debugLog('清理插件资源失败', error, 'error')
      throw error
    }
  }

  /**
   * 移除所有插件添加的DOM元素
   */
  private removeAllPluginElements(): void {
    try {
      // 移除插件容器
      const containers = document.querySelectorAll('.markdown-reader-container, .vue-component-container, .smart-toolbar')
      containers.forEach(container => container.remove())

      // 移除通知元素
      const notifications = document.querySelectorAll('.apple-notification')
      notifications.forEach(notification => notification.remove())

      // 移除模态框
      const modals = document.querySelectorAll('.modal-overlay, .image-modal, .donation-modal')
      modals.forEach(modal => modal.remove())

      this.debugLog('所有插件DOM元素已移除')
    } catch (error) {
      this.debugLog('移除插件DOM元素失败', error, 'error')
    }
  }

  /**
   * 恢复原始页面内容
   */
  private restoreOriginalContent(): void {
    try {
      // 如果有备份的原始内容，恢复它
      const originalContent = document.querySelector('[data-original-content]')
      if (originalContent) {
        document.body.innerHTML = originalContent.innerHTML
        originalContent.removeAttribute('data-original-content')
      }

      this.debugLog('原始页面内容已恢复')
    } catch (error) {
      this.debugLog('恢复原始页面内容失败', error, 'error')
    }
  }

  /**
   * 移除插件样式表
   */
  private removePluginStylesheets(): void {
    try {
      const stylesheets = document.querySelectorAll('link[data-markdown-reader="true"], style[data-markdown-reader="true"]')
      stylesheets.forEach(stylesheet => stylesheet.remove())

      this.debugLog('插件样式表已移除')
    } catch (error) {
      this.debugLog('移除插件样式表失败', error, 'error')
    }
  }

  /**
   * 禁用所有交互功能
   */
  private disableInteractions(): void {
    try {
      // 禁用所有按钮
      const buttons = document.querySelectorAll('.markdown-reader-container button, .smart-toolbar button')
      buttons.forEach(button => {
        (button as HTMLButtonElement).disabled = true
      })

      // 移除点击事件监听器
      this.cleanupEventListeners()

      this.debugLog('所有交互功能已禁用')
    } catch (error) {
      this.debugLog('禁用交互功能失败', error, 'error')
    }
  }

  /**
   * 添加禁用样式
   */
  private addDisabledStyles(): void {
    try {
      const style = document.createElement('style')
      style.setAttribute('data-markdown-reader', 'true')
      style.setAttribute('data-disabled', 'true')
      style.textContent = `
        .markdown-reader-container {
          opacity: 0.6;
          pointer-events: none;
          filter: grayscale(50%);
        }
        .smart-toolbar {
          opacity: 0.3;
          pointer-events: none;
        }
      `
      document.head.appendChild(style)

      this.debugLog('禁用样式已添加')
    } catch (error) {
      this.debugLog('添加禁用样式失败', error, 'error')
    }
  }

  /**
   * 清理缓存
   */
  private clearCache(): void {
    try {
      // 清理图表渲染缓存
      if ((window as any).mermaidCache) {
        (window as any).mermaidCache.clear()
      }

      // 清理其他缓存
      if ((window as any).markdownCache) {
        (window as any).markdownCache.clear()
      }

      this.debugLog('缓存已清理')
    } catch (error) {
      this.debugLog('清理缓存失败', error, 'error')
    }
  }

  /**
   * 清理临时DOM元素
   */
  private cleanupTemporaryElements(): void {
    try {
      // 清理临时创建的元素
      const tempElements = document.querySelectorAll('[data-temp="true"], .temp-element')
      tempElements.forEach(element => element.remove())

      this.debugLog('临时DOM元素已清理')
    } catch (error) {
      this.debugLog('清理临时DOM元素失败', error, 'error')
    }
  }

  /**
   * 清理全局变量
   */
  private cleanupGlobalVariables(): void {
    try {
      // 清理调试变量
      delete (window as any).__MARKDOWN_READER_DEBUG__
      delete (window as any).__MARKDOWN_READER_PERFORMANCE__
      delete (window as any).__MARKDOWN_READER_APP__

      this.debugLog('全局变量已清理')
    } catch (error) {
      this.debugLog('清理全局变量失败', error, 'error')
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

      // 保存当前内容，供配置变更后立即重新渲染
      this.currentMarkdownContent = content

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
      // 渲染皮肤（gov=政府公文 / free=自由现代）
      container.setAttribute('data-skin', this.config.skin || 'gov')

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

      // 渲染数学公式（KaTeX 懒加载）
      await this.renderMathInContainer(container)

      // 表格字体自适应：内容放不下时自动缩小字号（最小 9px），减少大量换行
      this.autoFitTableFont(container)

      // 创建目录组件
      this.setupTableOfContents()

      performanceMonitor.end('renderMarkdown')
      logger.info('Markdown渲染完成')
    } catch (error) {
      errorHandler.handle(error, 'renderMarkdown')
      await this.showError('渲染失败', error instanceof Error ? error.message : '未知错误')
    }
  }

  // applyStyles方法已废弃，样式现在通过CSS文件和CSS变量自动应用

  private setupInteractions(): void {
    // 禁用Vue组件工具栏初始化，因为目录工具栏已提供相同功能
    // this.setupVueToolbar()

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
      } else {
        // 图表（mermaid/kroki SVG）双击 → VS Code 风格查看器（缩放/平移/全屏）
        const chartContainer = target.closest('[data-action="open-modal"]') as HTMLElement | null
        if (chartContainer && chartContainer.querySelector('.chart-content svg, .chart-content img')) {
          e.preventDefault()
          this.openChartModal(chartContainer.id)
        }
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
   * 设置目录组件
   */
  private setupTableOfContents(): void {
    try {
      // 检查是否有渲染器和目录数据
      if (!this.renderer) {
        logger.warn('渲染器不存在，无法创建目录')
        return
      }

      const tocItems = this.renderer.getTocItems()
      if (!tocItems || tocItems.length === 0) {
        logger.info('没有找到标题，跳过目录创建')
        return
      }

      logger.info(`找到 ${tocItems.length} 个标题，创建目录组件`)

      // 移除旧的目录容器（如果存在）
      const oldTocContainer = document.getElementById('vue-table-of-contents')
      if (oldTocContainer) {
        oldTocContainer.remove()
      }

      // 使用 Vue 组件管理器创建目录组件（新版本不需要容器参数）
      vueComponentManager.createTableOfContents(tocItems)

      // 设置目录工具栏事件监听器
      this.setupTocToolbarListeners()

      logger.info('目录组件创建成功')
    } catch (error) {
      logger.error('创建目录组件失败:', error)
    }
  }

  /**
   * 设置目录工具栏事件监听器
   */
  private setupTocToolbarListeners(): void {
    // 设置面板显示事件
    this.addEventListenerManaged('showSettingsPanel', window, 'showSettingsPanel', () => {
      this.showSettingsPanel()
    })

    // 设置面板配置变更（temp）：实时同步到本实例配置，避免点击设置/重渲染时恢复旧值
    this.addEventListenerManaged('settingsConfigChange', window, 'settingsConfigChange', (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail && detail.config) {
        const newConfig = detail.config as MarkdownConfig
        // 仅同步与渲染相关字段（temp：不持久化，保存时由 store 写入 storage）
        const renderAffecting: Partial<MarkdownConfig> = {}
        ;(['theme', 'skin', 'accentColor', 'customAccentColor', 'fontSize', 'lineHeight', 'maxWidth', 'fontFamily', 'tableStyle'] as const).forEach((key) => {
          if (newConfig[key] !== undefined && newConfig[key] !== this.config[key]) {
            ;(renderAffecting as Record<string, unknown>)[key] = newConfig[key]
          }
        })
        if (Object.keys(renderAffecting).length > 0) {
          this.config = { ...this.config, ...renderAffecting }
          this.applyConfigToStyles()
          this.scheduleReRenderIfNeeded(renderAffecting)
        }
      }
    })

    // 导出对话框显示事件
    this.addEventListenerManaged('showExportDialog', window, 'showExportDialog', () => {
      this.showExportDialog()
    })

    // 打赏组件显示事件
    this.addEventListenerManaged('toggleDonation', window, 'toggle-donation', () => {
      this.showDonationModal()
    })

    // 切换原始内容事件
    this.addEventListenerManaged('toggleOriginalContent', window, 'toggleOriginalContent', () => {
      this.toggleOriginalContent()
    })
  }

  /**
   * 切换设置面板显示状态
   */
  private showSettingsPanel(): void {
    // 通知智能工具栏管理器设置面板即将打开
    smartToolbarManager.setSettingsPanelOpen(true)

    vueComponentManager.toggleSettingsPanel(this.config, (newConfig) => {
      this.updateConfig(newConfig)
    }, () => {
      // 设置面板关闭回调
      smartToolbarManager.setSettingsPanelOpen(false)
      // 通知目录：设置已关闭，两个一起关闭（层级联动）
      window.dispatchEvent(new CustomEvent('closeSettingsPanel'))
    })
  }

  /**
   * 切换导出对话框显示状态
   */
  private showExportDialog(): void {
    const content = document.querySelector('.markdown-content')?.innerHTML || ''
    vueComponentManager.toggleExportDialog(content, this.config, (format, options) => {
      this.handleExport(format, options)
    })
  }

  /**
   * 显示打赏组件
   */
  private showDonationModal(): void {
    vueComponentManager.toggleDonationModal()
  }



  /**
   * 处理导出操作
   */
  private async handleExport(format: string, options?: any): Promise<void> {
    try {
      // 动态导入导出工具
      const { exportDocument, getCurrentPageContent } = await import('../utils/exportUtils')

      // 获取当前页面内容
      const content = getCurrentPageContent()

      // 构建导出选项
      const exportOptions = {
        format: format as 'html' | 'pdf' | 'markdown' | 'png' | 'jpeg',
        filename: `document.${format}`,
        includeStyles: true,
        includeImages: true,
        includeCharts: true,
        includeMath: true,
        pageSize: 'A4',
        orientation: 'portrait' as const,
        quality: 0.9,
        ...options
      }

      // 执行导出
      await exportDocument(content, exportOptions)

      logger.info(`导出完成: ${format}`)
    } catch (error) {
      logger.error('导出失败:', error)

      // 降级处理
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
    }
  }





  private setupMessageListener(): void {
    if (!this.checkExtensionContext()) {
      logger.warn('扩展上下文无效，无法设置消息监听')
      return
    }

    // 方案1: Chrome runtime消息监听（主要方案）
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

    // 方案2: 监听localStorage变化（备选方案）
    this.addEventListenerManaged('storage-change', window, 'storage', (event: Event) => {
      const storageEvent = event as StorageEvent
      if (storageEvent.key === 'markdown-style-config-update' && storageEvent.newValue) {
        try {
          const configData = JSON.parse(storageEvent.newValue)
          if (configData._source === 'settings-panel' && configData._timestamp) {
            console.log('通过localStorage接收到样式配置更新:', configData)
            this.updateStyleConfig(configData as MarkdownConfig)
          }
        } catch (error) {
          console.error('解析localStorage配置失败:', error)
        }
      }
    })

    // 方案3: 监听自定义事件（备选方案）
    this.addEventListenerManaged('custom-config-change', window, 'markdown-style-config-changed', (event: Event) => {
      const customEvent = event as CustomEvent
      try {
        const configData = customEvent.detail
        if (configData._source === 'settings-panel' && configData._timestamp) {
          console.log('通过自定义事件接收到样式配置更新:', configData)
          this.updateStyleConfig(configData as MarkdownConfig)
        }
      } catch (error) {
        console.error('处理自定义事件配置失败:', error)
      }
    })

    // 方案4: 定期检查localStorage中的配置更新（最后备选）
    let lastCheckTimestamp = 0
    const checkConfigUpdates = () => {
      try {
        const configUpdateStr = localStorage.getItem('markdown-style-config-update')
        if (configUpdateStr) {
          const configData = JSON.parse(configUpdateStr)
          if (configData._timestamp && configData._timestamp > lastCheckTimestamp) {
            lastCheckTimestamp = configData._timestamp
            if (configData._source === 'settings-panel') {
              console.log('通过定期检查接收到样式配置更新:', configData)
              this.updateStyleConfig(configData as MarkdownConfig)
            }
          }
        }
      } catch (error) {
        // 静默处理错误，避免日志污染
      }
    }

    // 每2秒检查一次配置更新（仅在其他方案都失败时使用）
    setInterval(checkConfigUpdates, 2000)

    this.debugLog('多重消息监听机制已设置', {
      runtime: 'chrome.runtime.onMessage',
      storage: 'window.storage',
      custom: 'markdown-style-config-changed',
      polling: '2s interval'
    })
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

        case 'STOP_EXTENSION':
          await this.stopExtension(message.payload?.reason || 'user_requested')
          return { success: true, data: { message: '插件已停止运行' } }

        case 'DISABLE_EXTENSION':
          await this.disableExtension(message.payload?.reason || 'user_disabled')
          return { success: true, data: { message: '插件已禁用' } }

        case 'CLEANUP_EXTENSION':
          await this.cleanupExtension(message.payload?.reason || 'user_cleanup')
          return { success: true, data: { message: '插件资源已清理' } }

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
        const customColor = config.accentColor === 'custom' ? config.customAccentColor : undefined
        cssVariableManager.setAccentColor(config.accentColor, customColor)
        
        // 立即验证强调色是否生效
        this.verifyAccentColorApplication(config.accentColor, customColor)
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

      // 强制触发样式重新计算
      this.forceStyleRecalculation()

      console.log('样式配置更新完成')
    } catch (error) {
      console.error('更新样式配置失败:', error)
    }
  }

  /**
   * 验证强调色应用是否成功
   */
  private verifyAccentColorApplication(accentColor: string, customColor?: string): void {
    setTimeout(() => {
      const expectedColor = accentColor === 'custom' ? customColor : this.getAccentColorValue(accentColor)
      const actualColor = getComputedStyle(document.documentElement).getPropertyValue('--apple-accent-primary').trim()
      
      console.log('强调色验证:', {
        accentColor,
        expectedColor,
        actualColor,
        isMatch: actualColor === expectedColor
      })
      
      if (actualColor !== expectedColor) {
        console.warn('强调色未正确应用，执行强制修复')
        this.forceAccentColorApplication(accentColor, expectedColor)
      }
    }, 200)
  }

  /**
   * 获取强调色对应的颜色值
   */
  private getAccentColorValue(accentColor: string): string {
    const colors: Record<string, string> = {
      blue: '#007AFF',
      purple: '#AF52DE',
      pink: '#FF2D92',
      red: '#FF3B30',
      orange: '#FF9500',
      yellow: '#FFCC00',
      green: '#30D158',
      graphite: '#8E8E93'
    }
    return colors[accentColor] || '#007AFF'
  }

  /**
   * 强制应用强调色
   */
  private forceAccentColorApplication(accentColor: string, color?: string): void {
    const targetColor = color || this.getAccentColorValue(accentColor)
    
    // 在多个层级强制设置
    const targets = [
      document.documentElement,
      document.body,
      ...Array.from(document.querySelectorAll('.markdown-body, .md-content, [data-md-rendered]'))
    ]
    
    targets.forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.setProperty('--apple-accent-primary', targetColor, 'important')
        element.style.setProperty('--accent-color', targetColor, 'important')
        element.style.setProperty('--md-accent-primary', targetColor, 'important')
      }
    })
    
    // 强制刷新所有链接颜色
    const links = document.querySelectorAll('a')
    links.forEach(link => {
      if (link instanceof HTMLElement) {
        link.style.setProperty('color', targetColor, 'important')
      }
    })
    
    console.log('强制强调色应用完成:', targetColor)
  }

  /**
   * 强制触发样式重新计算
   */
  private forceStyleRecalculation(): void {
    // 方法1: 触发重排
    document.documentElement.offsetHeight
    
    // 方法2: 临时修改display属性
    const originalDisplay = document.body.style.display
    document.body.style.display = 'none'
    document.body.offsetHeight // 触发重排
    document.body.style.display = originalDisplay
    
    // 方法3: 触发自定义事件通知页面样式已更新
    window.dispatchEvent(new CustomEvent('md-style-updated', {
      detail: { config: this.config }
    }))
    
    console.log('样式重新计算已触发')
  }

  private async updateConfig(newConfig: Partial<MarkdownConfig>): Promise<void> {
    try {
      // 检查扩展上下文
      if (!this.checkExtensionContext()) {
        logger.warn('扩展上下文无效，无法更新配置')
        return
      }

      this.config = { ...this.config, ...newConfig }
      console.log('更新配置:', newConfig)

      // 立即应用样式更新，但不重新渲染页面
      if (newConfig.accentColor) {
        console.log('应用强调色:', newConfig.accentColor)
        const customColor = newConfig.accentColor === 'custom' ? newConfig.customAccentColor : undefined
        cssVariableManager.setAccentColor(newConfig.accentColor, customColor)
      }

      if (newConfig.theme) {
        console.log('应用主题:', newConfig.theme)
        cssVariableManager.setTheme(newConfig.theme)
      }

      if (newConfig.skin) {
        console.log('应用渲染皮肤:', newConfig.skin)
        const container = document.querySelector('.markdown-reader-container') as HTMLElement | null
        container?.setAttribute('data-skin', newConfig.skin)
      }

      if (newConfig.fontSize || newConfig.lineHeight) {
        console.log('应用字体设置:', { fontSize: newConfig.fontSize, lineHeight: newConfig.lineHeight })
        cssVariableManager.setTypography(
          newConfig.fontSize || this.config.fontSize,
          newConfig.lineHeight || this.config.lineHeight
        )
      }

      if (newConfig.maxWidth !== undefined) {
        console.log('应用最大宽度:', newConfig.maxWidth)
        cssVariableManager.setMaxWidth(newConfig.maxWidth)
      }

      if (newConfig.fontFamily) {
        console.log('应用字体家族:', newConfig.fontFamily)
        cssVariableManager.setFontFamily(newConfig.fontFamily)
      }

      // 保存到chrome.storage（配置变更必须持久化，保证下次打开同样生效）
      try {
        await chrome.storage.sync.set({ 'markdown-config': this.config })
        console.log('配置已保存到存储')
      } catch (error) {
        logger.warn('保存配置到存储失败:', error)
      }

      // 更新渲染器配置
      if (this.renderer) {
        this.renderer.updateConfig(this.config)
        console.log('渲染器配置已更新')
      }

      // 渲染相关配置变更 → 防抖重新渲染内容，立即生效（此前需刷新页面才生效）
      this.scheduleReRenderIfNeeded(newConfig)

      logger.info('配置已更新', newConfig)
    } catch (error) {
      logger.error('更新配置失败:', error)
    }
  }

  /**
   * 渲染相关配置变更后，防抖重新渲染内容使其立即生效。
   * 涉及：皮肤/字体家族/字号/行高/行宽/表格样式/数学/图表/高亮等渲染类配置；
   * 重渲染前保存滚动位置，渲染后恢复。
   */
  private scheduleReRenderIfNeeded(newConfig: Partial<MarkdownConfig>): void {
    // 注：skin/fontFamily/fontSize/lineHeight/maxWidth 由 CSS 变量 / data-* 属性即时驱动，
    // 无需重渲染（重渲染大文档慢，且会连带触发内容替换导致设置面板被隐藏）。
    // 仅保留真正改变 HTML 结构的渲染开关类配置。
    const renderAffectingKeys: Array<keyof MarkdownConfig> = [
      'tableStyle', 'enableMath', 'enableMermaid', 'enableCharts',
      'enableTables', 'enableHighlight', 'enableTaskLists',
      'mathRenderer', 'codeTheme', 'enableLineNumbers', 'enableWordWrap'
    ]
    const affectsRender = renderAffectingKeys.some((key) => newConfig[key] !== undefined)
    if (!affectsRender || !this.currentMarkdownContent) return

    this.reRenderScrollY = window.scrollY
    if (this.reRenderTimer !== null) return
    this.reRenderTimer = window.setTimeout(() => {
      this.reRenderTimer = null
      const content = this.currentMarkdownContent
      if (!content) return
      this.renderMarkdown(content).then(() => {
        window.scrollTo(0, this.reRenderScrollY)
      }).catch(() => {
        this.debugLog('配置变更重渲染失败', undefined, 'error')
      })
    }, 0)
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
    // 注释：右上角的原始页面按钮已被目录工具栏替代，避免功能重复
    // this.addRestoreButton(originalBody)
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
        // 跳过扩展自身的容器（设置面板/目录/遮罩等），否则重渲染时会把这些 UI 一并隐藏，
        // 导致设置面板"因渲染问题直接退出"、用户修改的设置无法继续保存
        if (
          element.id?.startsWith('vue-component-') ||
          element.id?.startsWith('vue-overlay-') ||
          element.id === 'vue-table-of-contents' ||
          element.classList?.contains('vue-component-container') ||
          element.classList?.contains('vue-component-overlay') ||
          element.classList?.contains('markdown-reader-container') ||
          element.classList?.contains('markdown-overlay-mode')
        ) {
          continue
        }
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
   * 切换显示原始内容和渲染内容
   */
  private toggleOriginalContent(): void {
    const markdownContainer = document.querySelector('.markdown-reader-container') as HTMLElement

    if (!markdownContainer) return

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
    /**：双击图表打开模态框，
   * 支持滚轮缩放（围绕鼠标位置）、拖拽平移、按钮放大/缩小/复位、全屏、Esc/背景关闭。
   */
  private openChartModal(chartId: string): void {
    try {
      const container = document.getElementById(chartId)
      const chartEl = container?.querySelector('.chart-content svg, .chart-content img') as HTMLElement | null
      if (!chartEl) return

      // 已有模态框先移除
      document.getElementById('chart-modal')?.remove()

      const modal = document.createElement('div')
      modal.className = 'chart-modal'
      modal.id = 'chart-modal'

      const content = document.createElement('div')
      content.className = 'chart-modal-content'

      // 克隆图表元素（SVG/图片）
      const clone = chartEl.cloneNode(true) as HTMLElement
      clone.removeAttribute('style')
      content.appendChild(clone)

      // 缩放/平移状态
      let scale = 1
      let tx = 0
      let ty = 0

      const applyTransform = () => {
        content.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
      }

      const zoomBy = (factor: number) => {
        scale = Math.min(8, Math.max(0.2, scale * factor))
        applyTransform()
      }

      const resetView = () => {
        scale = 1
        tx = 0
        ty = 0
        applyTransform()
      }

      // 工具栏
      const toolbar = document.createElement('div')
      toolbar.className = 'chart-modal-toolbar'
      const mkBtn = (label: string, title: string, action: () => void) => {
        const btn = document.createElement('button')
        btn.className = 'chart-modal-btn'
        btn.innerHTML = label
        btn.title = title
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          action()
        })
        return btn
      }
      toolbar.appendChild(mkBtn('＋', '放大', () => zoomBy(1.25)))
      toolbar.appendChild(mkBtn('－', '缩小', () => zoomBy(0.8)))
      toolbar.appendChild(mkBtn('⤾', '复位', resetView))
      toolbar.appendChild(mkBtn('⛶', '全屏', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        } else {
          modal.requestFullscreen?.().catch(() => {})
        }
      }))
      toolbar.appendChild(mkBtn('×', '关闭', () => window.closeChartModal()))

      modal.appendChild(toolbar)
      modal.appendChild(content)

      // 点击背景关闭
      modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeChartModal()
      })
      // Esc 关闭
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.closeChartModal()
      }, { once: true })

      // 拖拽平移
      let isDragging = false
      let startX = 0
      let startY = 0
      content.addEventListener('mousedown', (e) => {
        isDragging = true
        startX = e.clientX
        startY = e.clientY
        content.style.cursor = 'grabbing'
        content.style.transition = 'none'
        e.preventDefault()
      })
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return
        tx += e.clientX - startX
        ty += e.clientY - startY
        startX = e.clientX
        startY = e.clientY
        applyTransform()
      })
      document.addEventListener('mouseup', () => {
        isDragging = false
        content.style.cursor = 'grab'
        content.style.transition = ''
      })

      // 滚轮缩放（围绕鼠标位置）
      content.addEventListener('wheel', (e) => {
        e.preventDefault()
        const rect = content.getBoundingClientRect()
        // 鼠标相对内容中心的偏移（缩放后换算）
        const mx = e.clientX - rect.left - rect.width / 2
        const my = e.clientY - rect.top - rect.height / 2
        const factor = e.deltaY < 0 ? 1.15 : 0.87
        const newScale = Math.min(8, Math.max(0.2, scale * factor))
        const ratio = newScale / scale
        // 保持鼠标下的点不动
        tx = tx - mx * (ratio - 1)
        ty = ty - my * (ratio - 1)
        scale = newScale
        applyTransform()
      }, { passive: false })

      document.body.appendChild(modal)
      requestAnimationFrame(() => modal.classList.add('show'))
      this.debugLog('图表查看器已打开', { chartId })
    } catch (error) {
      this.debugLog('打开图表查看器失败', error)
    }
  }

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

  // 初始化Content Script并保存实例引用
  let appInstance: ContentScriptApp
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      appInstance = new ContentScriptApp()
        // 导出到全局作用域
        ; (window as any).__MARKDOWN_READER_APP__ = appInstance
    })
  } else {
    appInstance = new ContentScriptApp()
      // 导出到全局作用域
      ; (window as any).__MARKDOWN_READER_APP__ = appInstance
  }

  // 导出停止插件运行的全局方法
  ; (window as any).stopMarkdownReader = async () => {
    try {
      const app = (window as any).__MARKDOWN_READER_APP__ || appInstance
      if (app) {
        await app.stopExtension('user_global_stop')
        console.log('✅ Markdown Reader Vue 已在当前页面停止运行')
        return true
      } else {
        console.warn('⚠️ 插件实例未找到，可能已经停止')
        return false
      }
    } catch (error) {
      console.error('❌ 停止插件失败:', error)
      return false
    }
  }

    // 导出禁用插件的全局方法
    ; (window as any).disableMarkdownReader = async () => {
      try {
        const app = (window as any).__MARKDOWN_READER_APP__ || appInstance
        if (app) {
          await app.disableExtension('user_global_disable')
          console.log('✅ Markdown Reader Vue 已在当前页面禁用')
          return true
        } else {
          console.warn('⚠️ 插件实例未找到，可能已经禁用')
          return false
        }
      } catch (error) {
        console.error('❌ 禁用插件失败:', error)
        return false
      }
    }

    // 导出清理插件资源的全局方法
    ; (window as any).cleanupMarkdownReader = async () => {
      try {
        const app = (window as any).__MARKDOWN_READER_APP__ || appInstance
        if (app) {
          await app.cleanupExtension('user_global_cleanup')
          console.log('✅ Markdown Reader Vue 资源已清理')
          return true
        } else {
          console.warn('⚠️ 插件实例未找到，可能已经清理')
          return false
        }
      } catch (error) {
        console.error('❌ 清理插件资源失败:', error)
        return false
      }
    }

    // 导出通过消息系统停止插件的方法
    ; (window as any).stopMarkdownReaderViaMessage = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'STOP_EXTENSION',
          payload: { reason: 'user_console_stop' }
        })
        if (response.success) {
          console.log('✅ 通过消息系统停止插件成功')
          return true
        } else {
          console.error('❌ 通过消息系统停止插件失败:', response.error)
          return false
        }
      } catch (error) {
        console.error('❌ 发送停止消息失败:', error)
        return false
      }
    }
}

// 兼容性：直接执行（用于开发模式）
if (typeof window !== 'undefined') {
  onExecute()
}
