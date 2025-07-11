// Vue imports removed as they are not used in content script
import { MarkdownRenderer } from '../utils/markdownRenderer'
import { logger, performanceMonitor, errorHandler, fileUtils, themeUtils, domUtils } from '../utils'
import { cssVariableManager } from '../utils/cssVariableManager'
import type { MarkdownConfig, ExtensionMessage, ExtensionResponse } from '../types'
import { defaultConfig } from '../types'
import '../styles/apple-design-system.css'
import '../styles/content.css'

/**
 * Content Script 主应用类
 * 负责在网页中注入Markdown渲染功能
 */
class ContentScriptApp {
  private renderer: MarkdownRenderer | null = null
  private config: MarkdownConfig = { ...defaultConfig }
  private isActive = false
  private lastConfigUpdate = 0
  private isExtensionValid = true
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor() {
    this.init()
  }

  private async init(): Promise<void> {
    try {
      logger.info('Content Script 初始化开始', { url: window.location.href })
      
      // 检查扩展上下文
      if (!this.checkExtensionContext()) {
        logger.warn('扩展上下文无效，尝试重连')
        await this.attemptReconnect()
        return
      }
      
      // 加载配置
      await this.loadConfig()
      
      // 检查是否为Markdown文件
      if (this.isMarkdownFile()) {
        await this.setupMarkdownRenderer()
      } else {
        // 新增：为非Markdown页面提供阅读模式选项
        await this.setupUniversalReadingMode()
      }
      
      // 设置消息监听
      this.setupMessageListener()
      
      // 设置主题监听
      this.setupThemeWatcher()
      
      // 设置扩展上下文监听
      this.setupExtensionWatcher()
      
      logger.info('Content Script 初始化完成')
    } catch (error) {
      errorHandler.handle(error, 'ContentScript.init')
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

  private isMarkdownFile(): boolean {
    const url = window.location.href
    const isMarkdown = fileUtils.isMarkdownFile(url)
    
    // 额外检查：如果页面内容看起来像Markdown
    if (!isMarkdown) {
      const bodyText = document.body.textContent || ''
      const hasMarkdownSyntax = /^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|```|\[.*\]\(.*\)/m.test(bodyText)
      return hasMarkdownSyntax && bodyText.length > 100
    }
    
    return isMarkdown
  }

  private async loadConfig(): Promise<void> {
    try {
      if (!this.checkExtensionContext()) {
        logger.warn('扩展上下文无效，无法加载配置')
        return
      }

      const result = await chrome.storage.sync.get('markdownConfig')
      if (result.markdownConfig) {
        this.config = { ...this.config, ...result.markdownConfig }
        logger.info('配置已加载', this.config)
        
        // 立即应用强调色（使用新的管理器）
        if (this.config.accentColor) {
          cssVariableManager.setAccentColor(this.config.accentColor)
        }
      }
    } catch (error) {
      logger.warn('加载配置失败，使用默认配置', error)
    }
  }

  private async setupMarkdownRenderer(): Promise<void> {
    try {
      performanceMonitor.start('setupRenderer')
      
      // 保存原始内容
      // this.originalContent = document.body.innerHTML // Removed unused property
      
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
      
      // 应用样式
      this.applyStyles()
      
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
   * 设置通用阅读模式
   * 为非Markdown页面提供阅读优化功能
   */
  private async setupUniversalReadingMode(): Promise<void> {
    try {
      // 检查用户是否启用了通用阅读模式
      if (!this.config.enableUniversalReading) {
        return
      }
      
      logger.info('设置通用阅读模式')
      
      // 创建阅读模式切换按钮
      this.createReadingModeToggle()
      
    } catch (error) {
      errorHandler.handle(error, 'setupUniversalReadingMode')
    }
  }

  /**
   * 创建阅读模式切换按钮
   */
  private createReadingModeToggle(): void {
    // 检查是否已经创建了按钮
    if (document.querySelector('.reading-mode-toggle')) {
      return
    }

    const toggleButton = domUtils.createElement('div', {
      className: 'reading-mode-toggle liquid-glass',
      innerHTML: `
        <button class="toggle-btn" title="启用阅读模式">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
        </button>
      `
    })

    // 添加点击事件
    const button = toggleButton.querySelector('.toggle-btn') as HTMLButtonElement
    button.addEventListener('click', () => this.toggleReadingMode())

    // 添加到页面
    document.body.appendChild(toggleButton)
    
    // 应用样式
    this.applyReadingToggleStyles()
  }

  /**
   * 切换阅读模式
   */
  private async toggleReadingMode(): Promise<void> {
    try {
      if (this.isActive) {
        this.deactivateReadingMode()
      } else {
        await this.activateReadingMode()
      }
    } catch (error) {
      errorHandler.handle(error, 'toggleReadingMode')
      this.showError('阅读模式', '切换阅读模式时发生错误')
    }
  }

  /**
   * 激活阅读模式
   */
  private async activateReadingMode(): Promise<void> {
    performanceMonitor.start('activateReadingMode')
    
    // 提取页面主要内容
    const articleContent = this.extractArticleContent()
    if (!articleContent) {
      this.showError('阅读模式', '未能找到页面的主要内容')
      return
    }

    // 转换为Markdown格式
    const markdownContent = this.convertToMarkdown(articleContent)
    
    // 创建渲染器
    this.renderer = new MarkdownRenderer(this.config)
    
    // 渲染内容
    await this.renderMarkdown(markdownContent)
    
    // 应用阅读模式样式
    this.applyReadingModeStyles()
    
    this.isActive = true
    logger.info('阅读模式已激活')
    
    performanceMonitor.end('activateReadingMode')
  }

  /**
   * 提取页面主要内容
   */
  private extractArticleContent(): Element | null {
    // 尝试多种选择器来找到主要内容
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.entry-content', 
      '.article-content',
      '.content',
      'main',
      '.article-body',
      '.post-body',
      '#content',
      '.main-content'
    ]

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector)
      if (element && this.isValidContentElement(element)) {
        return element
      }
    }

    // 如果没找到，尝试启发式方法
    return this.findContentByHeuristics()
  }

  /**
   * 验证内容元素是否有效
   */
  private isValidContentElement(element: Element): boolean {
    const text = element.textContent || ''
    const wordCount = text.split(/\s+/).length
    
    // 内容应该有足够的文字（至少50个词）
    if (wordCount < 50) return false
    
    // 检查是否有合理的段落结构
    const paragraphs = element.querySelectorAll('p').length
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length
    
    return paragraphs > 0 || headings > 0
  }

  /**
   * 使用启发式方法查找内容
   */
  private findContentByHeuristics(): Element | null {
    const allElements = Array.from(document.querySelectorAll('div, section, article'))
    
    let bestElement: Element | null = null
    let bestScore = 0

    for (const element of allElements) {
      const score = this.calculateContentScore(element)
      if (score > bestScore) {
        bestScore = score
        bestElement = element
      }
    }

    return bestScore > 0 ? bestElement : null
  }

  /**
   * 计算内容元素的得分
   */
  private calculateContentScore(element: Element): number {
    const text = element.textContent || ''
    let score = 0

    // 基于文字数量评分
    const wordCount = text.split(/\s+/).length
    score += Math.min(wordCount / 10, 100)

    // 基于段落数量评分
    const paragraphs = element.querySelectorAll('p').length
    score += paragraphs * 5

    // 基于标题数量评分
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length
    score += headings * 10

    // 减分：如果包含太多导航元素
    const navElements = element.querySelectorAll('nav, .nav, .navigation, .menu').length
    score -= navElements * 20

    return score
  }

  /**
   * 将HTML内容转换为Markdown
   */
  private convertToMarkdown(element: Element): string {
    // 简单的HTML到Markdown转换
    // 这里可以使用更复杂的转换库，如turndown.js
    let markdown = ''
    
    // 提取文本内容并进行基本的格式转换
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
    )

    let node: Node | null
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim()
        if (text) {
          markdown += text + ' '
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as Element
        switch (elem.tagName.toLowerCase()) {
          case 'h1':
            markdown += '\n# ' + elem.textContent + '\n\n'
            break
          case 'h2': 
            markdown += '\n## ' + elem.textContent + '\n\n'
            break
          case 'h3':
            markdown += '\n### ' + elem.textContent + '\n\n'
            break
          case 'p':
            markdown += '\n\n'
            break
          case 'br':
            markdown += '\n'
            break
          case 'strong':
          case 'b':
            markdown += '**' + elem.textContent + '**'
            break
          case 'em':
          case 'i':
            markdown += '*' + elem.textContent + '*'
            break
          case 'a':
            const href = elem.getAttribute('href')
            if (href) {
              markdown += `[${elem.textContent}](${href})`
            }
            break
        }
      }
    }

    return markdown.trim()
  }

  /**
   * 应用阅读模式样式
   */
  private applyReadingModeStyles(): void {
    // 隐藏页面的其他内容
    document.body.style.setProperty('overflow', 'hidden')
    
    // 创建阅读模式覆盖层
    const overlay = domUtils.createElement('div', {
      className: 'reading-mode-overlay'
    })
    
    // 设置样式
    overlay.style.setProperty('position', 'fixed')
    overlay.style.setProperty('top', '0')
    overlay.style.setProperty('left', '0')
    overlay.style.setProperty('width', '100%')
    overlay.style.setProperty('height', '100%')
    overlay.style.setProperty('background', 'var(--apple-background)')
    overlay.style.setProperty('z-index', '999999')
    overlay.style.setProperty('overflow-y', 'auto')
    overlay.style.setProperty('padding', 'var(--spacing-xl)')

    document.body.appendChild(overlay)
  }

  /**
   * 取消阅读模式
   */
  private deactivateReadingMode(): void {
    // 移除阅读模式覆盖层
    const overlay = document.querySelector('.reading-mode-overlay')
    if (overlay) {
      overlay.remove()
    }

    // 恢复页面滚动
    document.body.style.overflow = ''
    
    this.isActive = false
    logger.info('阅读模式已取消')
  }

  /**
   * 应用阅读切换按钮样式
   */
  private applyReadingToggleStyles(): void {
    const styles = `
      .reading-mode-toggle {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999998;
        border-radius: var(--radius-md);
        padding: var(--spacing-sm);
        transition: all var(--duration-normal) var(--ease-in-out);
      }

      .reading-mode-toggle .toggle-btn {
        background: none;
        border: none;
        color: var(--apple-label);
        cursor: pointer;
        padding: var(--spacing-sm);
        border-radius: var(--radius-sm);
        transition: all var(--duration-fast) var(--ease-in-out);
      }

      .reading-mode-toggle .toggle-btn:hover {
        background: var(--apple-accent-quaternary);
        transform: scale(1.05);
      }

      .reading-mode-overlay {
        padding: var(--spacing-xl);
      }

      .reading-mode-overlay .markdown-reader-container {
        max-width: 800px;
        margin: 0 auto;
        background: var(--apple-background);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        padding: var(--spacing-xl);
      }
    `
    
    domUtils.addStyles(styles)
  }

  private extractMarkdownContent(): string {
    // 尝试从不同的元素中提取Markdown内容
    const selectors = [
      'pre', // GitHub等平台的原始文本
      '.markdown-body', // GitHub渲染后的内容
      '.blob-wrapper', // GitHub文件查看器
      'article', // 通用文章容器
      'main', // 主内容区域
      'body' // 最后的备选
    ]
    
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) {
        const text = element.textContent || ''
        if (text.length > 50 && this.looksLikeMarkdown(text)) {
          return text
        }
      }
    }
    
    return document.body.textContent || ''
  }

  private looksLikeMarkdown(text: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s/m, // 标题
      /^\*\s|^-\s|^\+\s/m, // 列表
      /^\d+\.\s/m, // 有序列表
      /```[\s\S]*?```/m, // 代码块
      /\[.*?\]\(.*?\)/m, // 链接
      /\*\*.*?\*\*|__.*?__/m, // 粗体
      /\*.*?\*|_.*?_/m, // 斜体
      /^>\s/m // 引用
    ]
    
    return markdownPatterns.some(pattern => pattern.test(text))
  }

  private async renderMarkdown(content: string): Promise<void> {
    try {
      performanceMonitor.start('renderMarkdown')
      
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
          <div class="markdown-reader-header">
            <div class="markdown-reader-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              <span>Markdown Reader Vue</span>
            </div>
            <div class="markdown-reader-actions">
              <button class="action-btn" id="toggleTheme" title="切换主题">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              </button>
              <button class="action-btn" id="printPage" title="打印页面">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 6,2 18,2 18,9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <polyline points="6,14 6,22 18,22 18,14"></polyline>
                </svg>
              </button>
              <button class="action-btn" id="exportHtml" title="导出HTML">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="markdown-reader-content">
            ${result.content}
          </div>
        `
      })
      
      // 显示警告信息
      if (result.warnings && result.warnings.length > 0) {
        const warningDiv = domUtils.createElement('div', {
          className: 'markdown-warnings',
          innerHTML: result.warnings.map(warning => 
            `<div class="warning-item">⚠️ ${warning}</div>`
          ).join('')
        })
        container.insertBefore(warningDiv, container.firstChild)
      }
      
      // 替换页面内容
      document.body.innerHTML = ''
      document.body.appendChild(container)
      
      // 渲染图表
      await this.renderer.renderCharts()
      
      performanceMonitor.end('renderMarkdown')
      logger.info('Markdown渲染完成')
    } catch (error) {
      errorHandler.handle(error, 'renderMarkdown')
      this.showError('渲染失败', error instanceof Error ? error.message : '未知错误')
    }
  }

  private applyStyles(): void {
    // 使用新的CSS变量管理系统
    cssVariableManager.applyConfig({
      theme: this.config.theme,
      accentColor: this.config.accentColor,
      fontSize: this.config.fontSize,
      lineHeight: this.config.lineHeight
    })
    
    logger.info('样式已应用', {
      theme: this.config.theme,
      accentColor: this.config.accentColor,
      fontSize: this.config.fontSize,
      lineHeight: this.config.lineHeight
    })
  }

  private setupInteractions(): void {
    // 主题切换 - 支持四种模式循环切换
    const themeBtn = document.getElementById('toggleTheme')
    themeBtn?.addEventListener('click', () => {
      const themes: Array<'light' | 'dark' | 'eyecare' | 'auto'> = ['light', 'dark', 'eyecare', 'auto']
      const currentIndex = themes.indexOf(this.config.theme as any)
      const nextIndex = (currentIndex + 1) % themes.length
      this.updateConfig({ theme: themes[nextIndex] })
    })
    
    // 打印页面
    const printBtn = document.getElementById('printPage')
    printBtn?.addEventListener('click', () => {
      window.print()
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
    
    // 图片缩放功能
    window.toggleImageZoom = (img: HTMLImageElement) => {
      img.classList.toggle('zoomed')
    }
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
          
        case 'RENDER_MARKDOWN':
          if (this.renderer && message.payload) {
            await this.renderMarkdown(message.payload)
            return { success: true }
          }
          return { success: false, error: '渲染器未初始化或内容为空' }

        case 'PING':
          return { success: true, data: { status: 'alive' } }
          
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
      
      this.config = { ...this.config, ...newConfig }
      this.lastConfigUpdate = now
      
      // 保存到chrome.storage（使用节流）
      if (timeDiff > 1000) { // 只有超过1秒才写入存储
        try {
          await chrome.storage.sync.set({ markdownConfig: this.config })
        } catch (error) {
          logger.warn('保存配置到存储失败:', error)
        }
      }
      
      // 立即应用样式更新
      this.applyStyles()
      
      // 更新渲染器配置
      if (this.renderer) {
        this.renderer.updateConfig(this.config)
      }
      
      logger.info('配置已更新', newConfig)
    } catch (error) {
      logger.error('更新配置失败:', error)
    }
  }

  private setupThemeWatcher(): void {
    if (this.config.theme === 'auto') {
      themeUtils.watchSystemTheme((systemTheme) => {
        themeUtils.applyTheme(systemTheme)
      })
    }
  }

  private showError(title: string, message: string): void {
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
        <title>Markdown Export</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          .markdown-reader-content { max-width: 800px; margin: 0 auto; padding: 20px; }
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
}

// 全局函数声明
declare global {
  interface Window {
    toggleImageZoom: (img: HTMLImageElement) => void
  }
}

// CRXJS 导出函数
export function onExecute() {
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