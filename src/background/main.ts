// 后台脚本主文件
import { logger, errorHandler } from '../utils/index'
import type { ExtensionMessage, ExtensionResponse } from '../types'

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

        case 'UPDATE_STYLE_CONFIG':
          return await this.broadcastStyleConfig(message.config, tabId)
          
        case 'LOG_EVENT':
          this.logEvent(message.payload, tabId)
          return { success: true }

        case 'PING':
          return { success: true, data: { status: 'alive' } }

        case 'STOP_EXTENSION':
          return await this.stopExtension(tabId)

        case 'DISABLE_EXTENSION':
          return await this.disableExtension(tabId)

        case 'CLEANUP_EXTENSION':
          return await this.cleanupExtension(tabId)
          
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

  /**
   * 广播样式配置到所有相关标签页
   */
  private async broadcastStyleConfig(config: any, senderTabId?: number): Promise<ExtensionResponse> {
    try {
      // 检查扩展上下文
      if (!chrome.runtime?.id) {
        throw new Error('扩展上下文已失效')
      }

      logger.info('广播样式配置到所有标签页:', config)
      
      // 获取所有标签页
      const tabs = await chrome.tabs.query({})
      const results: Array<{ tabId: number; success: boolean; error?: string }> = []
      
      // 向每个标签页发送样式配置
      for (const tab of tabs) {
        if (!tab.id || tab.id === senderTabId) {
          continue // 跳过发送者标签页和无效标签页
        }
        
        try {
          // 检查是否是Markdown文件或可能需要样式配置的页面
          if (this.isMarkdownUrl(tab.url || '') || this.shouldReceiveStyleConfig(tab.url || '')) {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'UPDATE_STYLE_CONFIG',
              config: config
            })
            
            results.push({ tabId: tab.id, success: true })
            logger.info(`样式配置已发送到标签页 ${tab.id}`)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '发送失败'
          results.push({ 
            tabId: tab.id, 
            success: false, 
            error: errorMsg 
          })
          logger.warn(`向标签页 ${tab.id} 发送样式配置失败:`, errorMsg)
        }
      }
      
      const successCount = results.filter(r => r.success).length
      const totalCount = results.length
      
      return {
        success: true,
        data: {
          message: `样式配置已广播到 ${successCount}/${totalCount} 个标签页`,
          results: results,
          config: config
        }
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '广播样式配置失败'
      logger.error('广播样式配置失败:', error)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 判断URL是否应该接收样式配置
   */
  private shouldReceiveStyleConfig(url: string): boolean {
    if (!url) return false
    
    // Markdown文件
    if (this.isMarkdownUrl(url)) return true
    
    // GitHub页面
    if (url.includes('github.com')) return true
    
    // GitLab页面
    if (url.includes('gitlab.com')) return true
    
    // 其他可能包含Markdown内容的页面
    const markdownSites = [
      'readme',
      'docs',
      'wiki',
      'documentation',
      'guide',
      'tutorial'
    ]
    
    return markdownSites.some(site => url.toLowerCase().includes(site))
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

  /**
   * 停止指定标签页的插件运行
   */
  private async stopExtension(tabId?: number): Promise<ExtensionResponse> {
    try {
      if (!tabId) {
        return { success: false, error: '无效的标签页ID' }
      }

      // 向content script发送停止消息
      await chrome.tabs.sendMessage(tabId, {
        type: 'STOP_EXTENSION',
        payload: { reason: 'user_requested' }
      })

      // 清理标签页状态
      this.tabStates.delete(tabId)

      // 清除徽章
      await chrome.action.setBadgeText({ text: '', tabId })
      await chrome.action.setTitle({ 
        title: 'Markdown Reader Vue - 已停止', 
        tabId 
      })

      logger.info('插件已在标签页停止运行:', tabId)
      return { success: true, data: { message: '插件已停止运行' } }
    } catch (error) {
      logger.error('停止插件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '停止插件失败' 
      }
    }
  }

  /**
   * 禁用指定标签页的插件功能
   */
  private async disableExtension(tabId?: number): Promise<ExtensionResponse> {
    try {
      if (!tabId) {
        return { success: false, error: '无效的标签页ID' }
      }

      // 向content script发送禁用消息
      await chrome.tabs.sendMessage(tabId, {
        type: 'DISABLE_EXTENSION',
        payload: { reason: 'user_disabled' }
      })

      // 更新标签页状态为禁用
      const currentState = this.tabStates.get(tabId) || {}
      this.tabStates.set(tabId, { 
        ...currentState, 
        disabled: true, 
        disabledAt: Date.now() 
      })

      // 更新徽章显示禁用状态
      await chrome.action.setBadgeText({ text: 'OFF', tabId })
      await chrome.action.setBadgeBackgroundColor({ color: '#FF3B30', tabId })
      await chrome.action.setTitle({ 
        title: 'Markdown Reader Vue - 已禁用', 
        tabId 
      })

      logger.info('插件已在标签页禁用:', tabId)
      return { success: true, data: { message: '插件已禁用' } }
    } catch (error) {
      logger.error('禁用插件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '禁用插件失败' 
      }
    }
  }

  /**
   * 清理指定标签页的插件资源
   */
  private async cleanupExtension(tabId?: number): Promise<ExtensionResponse> {
    try {
      if (!tabId) {
        // 如果没有指定标签页，清理所有资源
        await this.cleanupAllResources()
        return { success: true, data: { message: '所有资源已清理' } }
      }

      // 向content script发送清理消息
      await chrome.tabs.sendMessage(tabId, {
        type: 'CLEANUP_EXTENSION',
        payload: { reason: 'user_cleanup' }
      })

      // 清理标签页状态
      this.tabStates.delete(tabId)

      // 清除徽章
      await chrome.action.setBadgeText({ text: '', tabId })
      await chrome.action.setTitle({ 
        title: 'Markdown Reader Vue', 
        tabId 
      })

      logger.info('插件资源已在标签页清理:', tabId)
      return { success: true, data: { message: '资源已清理' } }
    } catch (error) {
      logger.error('清理插件资源失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '清理资源失败' 
      }
    }
  }

  /**
   * 清理所有插件资源
   */
  private async cleanupAllResources(): Promise<void> {
    try {
      // 获取所有标签页
      const tabs = await chrome.tabs.query({})
      
      // 向所有标签页发送清理消息
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'CLEANUP_EXTENSION',
              payload: { reason: 'global_cleanup' }
            })
          } catch (error) {
            // 忽略无法发送消息的标签页
            logger.warn(`无法向标签页 ${tab.id} 发送清理消息:`, error)
          }
        }
      }

      // 清理所有标签页状态
      this.tabStates.clear()

      // 清理存储的配置（可选）
      // await chrome.storage.sync.clear()

      logger.info('所有插件资源已清理')
    } catch (error) {
      logger.error('清理所有资源失败:', error)
      throw error
    }
  }

  /**
   * 完全停止插件运行（全局）
   */
  public async stopExtensionGlobally(): Promise<void> {
    try {
      logger.info('开始全局停止插件运行')
      
      // 清理所有资源
      await this.cleanupAllResources()
      
      // 移除所有事件监听器
      chrome.runtime.onMessage.removeListener(this.messageHandler)
      chrome.tabs.onActivated.removeListener(this.setupTabListeners)
      chrome.tabs.onUpdated.removeListener(this.setupTabListeners)
      chrome.tabs.onRemoved.removeListener(this.setupTabListeners)
      chrome.runtime.onInstalled.removeListener(this.setupInstallListener)
      chrome.storage.onChanged.removeListener(this.setupStorageListener)
      
      // 标记为未初始化
      this.isInitialized = false
      
      logger.info('插件已全局停止运行')
    } catch (error) {
      logger.error('全局停止插件失败:', error)
      throw error
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

// 导出全局停止方法，可在任何地方调用
;(globalThis as any).stopMarkdownReaderExtension = async () => {
  try {
    await backgroundScript.stopExtensionGlobally()
    console.log('✅ Markdown Reader Vue 插件已完全停止运行')
    return true
  } catch (error) {
    console.error('❌ 停止插件失败:', error)
    return false
  }
}

// 导出单个标签页停止方法
;(globalThis as any).stopMarkdownReaderInCurrentTab = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_EXTENSION'
      })
      if (response.success) {
        console.log('✅ 当前标签页的 Markdown Reader Vue 已停止运行')
        return true
      } else {
        console.error('❌ 停止当前标签页插件失败:', response.error)
        return false
      }
    }
    return false
  } catch (error) {
    console.error('❌ 停止当前标签页插件失败:', error)
    return false
  }
}