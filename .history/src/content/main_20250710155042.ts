// Vue imports removed as they are not used in content script
import { MarkdownRenderer } from '../utils/markdownRenderer'
import { logger, performanceMonitor, errorHandler, themeUtils, domUtils } from '../utils'
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
      
      // 检查是否为Markdown文件 - 严格限制扩展名
      if (this.isMarkdownFile()) {
        await this.setupMarkdownRenderer()
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

  /**
   * 智能检测Markdown文件 - 支持多种场景
   * 1. 文件扩展名检测：.md, .MD, .Md, .mD, .markdown
   * 2. GitHub/GitLab等平台的markdown页面
   * 3. 内容类型检测（text/markdown, text/plain等）
   * 4. 文档标题和内容检测
   */
  private isMarkdownFile(): boolean {
    const url = window.location.href
    const pathname = window.location.pathname
    
    // 1. 直接的文件扩展名检测
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
    
    console.log('未识别为Markdown文件:', { url, pathname, contentType })
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



  private extractMarkdownContent(): string {
    console.log('开始提取Markdown内容...')
    
    // 优先级顺序的选择器列表
    const selectors = [
      // GitHub原始文件内容
      '.file .blob-code-content',
      '.file .highlight pre',
      '.file pre',
      
      // GitHub已渲染的markdown
      '.markdown-body',
      '.readme .markdown-body',
      
      // GitHub文件查看器
      '.blob-wrapper .blob-code',
      '.blob-wrapper pre',
      
      // GitLab
      '.file-content pre',
      '.wiki-content .md',
      
      // 通用容器
      'article pre',
      'main pre',
      '.content pre',
      '.document pre',
      
      // 文档主体
      'article',
      'main',
      '.content',
      '.document',
      
      // 最后的备选
      'pre',
      'body'
    ]
    
    let bestContent = ''
    let bestScore = 0
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      
      for (const element of elements) {
        const text = element.textContent || ''
        
        if (text.length < 50) continue
        
        // 计算内容的Markdown特征分数
        const score = this.calculateMarkdownScore(text)
        
        console.log(`选择器 "${selector}" 内容评分: ${score}, 长度: ${text.length}`)
        
        if (score > bestScore) {
          bestScore = score
          bestContent = text
          console.log(`发现更好的内容，选择器: ${selector}, 评分: ${score}`)
        }
      }
    }
    
    // 如果找到了高质量的Markdown内容
    if (bestScore > 2) {
      console.log(`提取完成，最终评分: ${bestScore}, 内容长度: ${bestContent.length}`)
      return bestContent
    }
    
    // 如果没有找到高质量内容，使用整个文档内容
    const fallbackContent = document.body.textContent || ''
    console.log(`未找到高质量Markdown内容，使用文档内容，长度: ${fallbackContent.length}`)
    return fallbackContent
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
   * 调试日志方法
   */
  private debugLog(message: string, data?: any): void {
    console.log(`[ContentScript] ${message}`, data || '')
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
          innerHTML: result.warnings.map((warning: string) => 
            `<div class="warning-item">⚠️ ${warning}</div>`
          ).join('')
        })
        container.insertBefore(warningDiv, container.firstChild)
      }
      
      // 替换页面内容
      document.body.innerHTML = ''
      document.body.appendChild(container)
      
      // 图表渲染现在由markdownRenderer自动处理
      
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