import { logger, errorHandler } from '@/utils'
import type { ExtensionMessage, ExtensionResponse } from '@/types'

/**
 * Background Script 主类
 * 处理插件的后台逻辑、消息传递和状态管理
 */
class BackgroundScript {
  private tabStates = new Map<number, any>()
  private lastConfigUpdate = 0
  private isInitialized = false

  constructor() {
    this.init()
  }

  private init(): void {
    if (this.isInitialized) {
      logger.warn('Background Script 已经初始化，跳过重复初始化')
      return
    }

    try {
      logger.info('Background Script 初始化开始')
      
      // 设置消息监听
      this.setupMessageListener()
      
      // 设置标签页事件监听
      this.setupTabListeners()
      
      // 设置安装和更新事件
      this.setupInstallListener()
      
      // 设置存储变化监听
      this.setupStorageListener()
      
      // 设置错误处理
      this.setupErrorHandling()
      
      this.isInitialized = true
      logger.info('Background Script 初始化完成')
    } catch (error) {
      logger.error('Background Script 初始化失败:', error)
      // 延迟重试初始化
      setTimeout(() => {
        this.isInitialized = false
        this.init()
      }, 1000)
    }
  }

  private setupErrorHandling(): void {
    // 监听未捕获的错误
    self.addEventListener('error', (event) => {
      logger.error('Service Worker 未捕获错误:', event.error)
    })

    // 监听未处理的Promise拒绝
    self.addEventListener('unhandledrejection', (event) => {
      logger.error('Service Worker 未处理的Promise拒绝:', event.reason)
      event.preventDefault()
    })
  }

  private setupMessageListener(): void {
    // 移除现有监听器（如果有）
    if (chrome.runtime.onMessage.hasListeners()) {
      chrome.runtime.onMessage.removeListener(this.messageHandler)
    }

    chrome.runtime.onMessage.addListener(this.messageHandler.bind(this))
  }

  private messageHandler(
    message: ExtensionMessage, 
    sender: chrome.runtime.MessageSender, 
    sendResponse: (response: ExtensionResponse) => void
  ): boolean {
    // 检查扩展上下文是否有效
    if (!chrome.runtime?.id) {
      logger.warn('扩展上下文已失效，忽略消息')
      sendResponse({ success: false, error: '扩展上下文已失效' })
      return false
    }

    errorHandler.handleAsync(async () => {
      try {
        const response = await this.handleMessage(message, sender)
        sendResponse(response)
      } catch (error) {
        logger.error('处理消息时发生错误:', error)
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : '处理消息失败' 
        })
      }
    }, 'BackgroundScript.messageHandler')
    
    return true // 保持消息通道开放
  }

  private async handleMessage(
    message: ExtensionMessage, 
    sender: chrome.runtime.MessageSender
  ): Promise<ExtensionResponse> {
    try {
      const tabId = sender.tab?.id
      
      switch (message.type) {
        case 'GET_STATE':
          return await this.getTabState(tabId)
          
        case 'UPDATE_CONFIG':
          return await this.updateConfig(message.payload, tabId)
          
        case 'LOG_EVENT':
          this.logEvent(message.payload, tabId)
          return { success: true }

        case 'PING':
          return { success: true, data: { status: 'alive' } }
          
        default:
          logger.warn('未知消息类型:', message.type)
          return { success: false, error: '未知消息类型' }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '处理消息失败'
      logger.error('处理消息失败:', { errorMsg, message, sender })
      return { success: false, error: errorMsg }
    }
  }

  private async getTabState(tabId?: number): Promise<ExtensionResponse> {
    if (!tabId) {
      return { success: false, error: '无效的标签页ID' }
    }
    
    try {
      // 检查扩展上下文
      if (!chrome.runtime?.id) {
        throw new Error('扩展上下文已失效')
      }

      const tab = await chrome.tabs.get(tabId)
      const state = this.tabStates.get(tabId) || {}
      
      return {
        success: true,
        data: {
          ...state,
          url: tab.url,
          title: tab.title,
          isMarkdownFile: this.isMarkdownUrl(tab.url || '')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取标签页状态失败'
      }
    }
  }

  private async updateConfig(config: any, tabId?: number): Promise<ExtensionResponse> {
    try {
      // 检查扩展上下文
      if (!chrome.runtime?.id) {
        throw new Error('扩展上下文已失效')
      }

      // 使用节流机制避免频繁写入
      const now = Date.now()
      const lastUpdate = this.lastConfigUpdate || 0
      const timeDiff = now - lastUpdate
      
      // 如果距离上次更新不足1秒，延迟执行
      if (timeDiff < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - timeDiff))
      }
      
      // 保存配置到存储
      await chrome.storage.sync.set({ 'markdown-config': config })
      this.lastConfigUpdate = Date.now()
      
      // 更新标签页状态
      if (tabId) {
        const currentState = this.tabStates.get(tabId) || {}
        this.tabStates.set(tabId, { ...currentState, config })
      }
      
      // 通知所有相关标签页更新配置
      await this.broadcastConfigUpdate(config)
      
      logger.info('配置已更新:', config)
      return { success: true }
    } catch (error) {
      logger.error('更新配置失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '更新配置失败' 
      }
    }
  }

  private async broadcastConfigUpdate(config: any): Promise<void> {
    try {
      // 检查扩展上下文
      if (!chrome.runtime?.id) {
        logger.warn('扩展上下文已失效，无法广播配置更新')
        return
      }

      const tabs = await chrome.tabs.query({})
      
      for (const tab of tabs) {
        if (tab.id && this.isMarkdownUrl(tab.url || '')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'UPDATE_CONFIG',
              payload: config
            })
          } catch (error) {
            // 忽略无法发送消息的标签页（可能已关闭或未加载content script）
            logger.warn(`无法向标签页 ${tab.id} 发送配置更新:`, error)
          }
        }
      }
    } catch (error) {
      logger.error('广播配置更新失败:', error)
    }
  }

  private logEvent(event: any, tabId?: number): void {
    logger.info('标签页事件:', { event, tabId })
    
    if (tabId) {
      const currentState = this.tabStates.get(tabId) || {}
      const events = currentState.events || []
      events.push({ ...event, timestamp: Date.now() })
      
      // 限制事件数量
      if (events.length > 50) {
        events.splice(0, events.length - 25)
      }
      
      this.tabStates.set(tabId, { ...currentState, events })
    }
  }

  private setupTabListeners(): void {
    // 标签页激活事件
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId)
        await this.updateTabState(activeInfo.tabId, tab)
        await this.updateBadge(activeInfo.tabId, tab)
      } catch (error) {
        logger.error('处理标签页激活事件失败:', error)
      }
    })

    // 标签页更新事件
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        try {
          await this.updateTabState(tabId, tab)
          await this.updateBadge(tabId, tab)
        } catch (error) {
          logger.error('处理标签页更新事件失败:', error)
        }
      }
    })

    // 标签页移除事件
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabStates.delete(tabId)
      logger.info('标签页状态已清理:', tabId)
    })
  }

  private async updateTabState(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
    const isMarkdown = this.isMarkdownUrl(tab.url || '')
    const currentState = this.tabStates.get(tabId) || {}
    
    this.tabStates.set(tabId, {
      ...currentState,
      url: tab.url,
      title: tab.title,
      isMarkdownFile: isMarkdown,
      lastUpdated: Date.now()
    })
    
    logger.info('标签页状态已更新:', { tabId, isMarkdown, url: tab.url })
  }

  private async updateBadge(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
    try {
      const isMarkdown = this.isMarkdownUrl(tab.url || '')
      
      if (isMarkdown) {
        await chrome.action.setBadgeText({ text: 'MD', tabId })
        await chrome.action.setBadgeBackgroundColor({ color: '#007AFF', tabId })
        await chrome.action.setTitle({ 
          title: 'Markdown Reader Vue - 点击打开设置', 
          tabId 
        })
      } else {
        await chrome.action.setBadgeText({ text: '', tabId })
        await chrome.action.setTitle({ 
          title: 'Markdown Reader Vue - 当前页面不是Markdown文件', 
          tabId 
        })
      }
    } catch (error) {
      logger.error('更新徽章失败:', error)
    }
  }

  private isMarkdownUrl(url: string): boolean {
    if (!url) return false
    
    // 检查文件扩展名
    if (/\.(md|markdown)$/i.test(url)) {
      return true
    }
    
    // 检查常见的Markdown托管平台
    const markdownPlatforms = [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'gitee.com'
    ]
    
    return markdownPlatforms.some(platform => 
      url.includes(platform) && url.includes('.md')
    )
  }

  private setupInstallListener(): void {
    chrome.runtime.onInstalled.addListener(async (details) => {
      try {
        logger.info('插件安装/更新事件:', details)
        
        if (details.reason === 'install') {
          // 首次安装
          await this.handleFirstInstall()
        } else if (details.reason === 'update') {
          // 更新
          await this.handleUpdate(details.previousVersion)
        }
      } catch (error) {
        logger.error('处理安装事件失败:', error)
      }
    })
  }

  private async handleFirstInstall(): Promise<void> {
    logger.info('首次安装插件')
    
    // 设置默认配置
    const defaultConfig = {
      enableMermaid: true,
      enableMath: true,
      enableCharts: true,
      theme: 'auto',
      fontSize: 16,
      lineHeight: 1.6
    }
    
    await chrome.storage.sync.set({ 'markdown-config': defaultConfig })
    
    // 打开欢迎页面（可选）
    // await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') })
  }

  private async handleUpdate(previousVersion?: string): Promise<void> {
    logger.info('插件已更新:', { previousVersion, currentVersion: chrome.runtime.getManifest().version })
    
    // 处理配置迁移（如果需要）
    await this.migrateConfig(previousVersion)
  }

  private async migrateConfig(previousVersion?: string): Promise<void> {
    try {
      const result = await chrome.storage.sync.get('markdown-config')
    let config = result['markdown-config'] || {}
      
      // 根据版本进行配置迁移
      if (previousVersion && this.compareVersions(previousVersion, '2.0.0') < 0) {
        // 从1.x版本迁移到2.0.0
        config = {
          enableMermaid: config.enableMermaid ?? true,
          enableMath: config.enableMath ?? true,
          enableCharts: config.enableCharts ?? true,
          theme: config.theme || 'auto',
          fontSize: config.fontSize || 16,
          lineHeight: config.lineHeight || 1.6
        }
        
        await chrome.storage.sync.set({ 'markdown-config': config })
        logger.info('配置已迁移到2.0.0版本:', config)
      }
    } catch (error) {
      logger.error('配置迁移失败:', error)
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0
      
      if (v1Part < v2Part) return -1
      if (v1Part > v2Part) return 1
    }
    
    return 0
  }

  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes['markdown-config']) {
      logger.info('存储配置已变更:', changes['markdown-config'])
      
      // 通知所有标签页配置已变更
      errorHandler.handleAsync(async () => {
        await this.broadcastConfigUpdate(changes['markdown-config'].newValue)
      }, 'storageListener')
      }
    })
  }

  // 公共方法：获取所有标签页状态（用于调试）
  public getTabStates(): Map<number, any> {
    return new Map(this.tabStates)
  }

  // 公共方法：清理过期状态
  public cleanupExpiredStates(): void {
    const now = Date.now()
    const expireTime = 24 * 60 * 60 * 1000 // 24小时
    
    for (const [tabId, state] of this.tabStates.entries()) {
      if (state.lastUpdated && (now - state.lastUpdated) > expireTime) {
        this.tabStates.delete(tabId)
        logger.info('已清理过期标签页状态:', tabId)
      }
    }
  }
}

// 创建Background Script实例
const backgroundScript = new BackgroundScript()

// 定期清理过期状态
setInterval(() => {
  backgroundScript.cleanupExpiredStates()
}, 60 * 60 * 1000) // 每小时清理一次

// 导出实例（用于调试）
;(globalThis as any).backgroundScript = backgroundScript