import type { MarkdownConfig } from '../types'
import { defaultConfig } from '../types'
import { logger } from './index'

/**
 * 统一配置管理器
 * 负责所有配置的持久化、同步和管理
 */
export class ConfigManager {
  private static instance: ConfigManager
  private config: MarkdownConfig = { ...defaultConfig }
  private listeners: Set<(config: MarkdownConfig) => void> = new Set()
  private isInitialized = false
  private saveTimer: NodeJS.Timeout | null = null

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<MarkdownConfig> {
    if (this.isInitialized) {
      return this.config
    }

    try {
      await this.loadFromStorage()
      this.setupStorageListener()
      this.isInitialized = true
      logger.info('配置管理器初始化完成', this.config)
    } catch (error) {
      logger.error('配置管理器初始化失败:', error)
      this.config = { ...defaultConfig }
    }

    return this.config
  }

  /**
   * 获取当前配置
   */
  getConfig(): MarkdownConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  async updateConfig(updates: Partial<MarkdownConfig>): Promise<void> {
    try {
      // 合并配置
      const newConfig = { ...this.config, ...updates }
      
      // 验证配置
      this.validateConfig(newConfig)
      
      // 更新本地配置
      this.config = newConfig
      
      // 通知监听器
      this.notifyListeners()
      
      // 延迟保存到存储（防抖）
      this.debouncedSave()
      
      logger.info('配置已更新:', updates)
    } catch (error) {
      logger.error('更新配置失败:', error)
      throw error
    }
  }

  /**
   * 重置配置为默认值
   */
  async resetToDefaults(): Promise<void> {
    await this.updateConfig(defaultConfig)
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: (config: MarkdownConfig) => void): void {
    this.listeners.add(listener)
  }

  /**
   * 移除配置变更监听器
   */
  removeListener(listener: (config: MarkdownConfig) => void): void {
    this.listeners.delete(listener)
  }

  /**
   * 从存储加载配置
   */
  private async loadFromStorage(): Promise<void> {
    try {
      // 优先从 chrome.storage.sync 加载
      if (this.isExtensionContext()) {
        const result = await chrome.storage.sync.get('markdown-config')
        if (result['markdown-config']) {
          this.config = this.mergeWithDefaults(result['markdown-config'])
          logger.info('配置已从 chrome.storage.sync 加载')
          return
        }
      }

      // 备选：从 localStorage 加载
      const saved = localStorage.getItem('markdown-config')
      if (saved) {
        const savedConfig = JSON.parse(saved)
        this.config = this.mergeWithDefaults(savedConfig)
        logger.info('配置已从 localStorage 加载')
        
        // 如果扩展上下文可用，同步到 chrome.storage
        if (this.isExtensionContext()) {
          await chrome.storage.sync.set({ 'markdown-config': this.config })
        }
      }
    } catch (error) {
      logger.warn('加载配置失败，使用默认配置:', error)
      this.config = { ...defaultConfig }
    }
  }

  /**
   * 保存配置到存储
   */
  private async saveToStorage(): Promise<void> {
    try {
      // 优先保存到 chrome.storage.sync
      if (this.isExtensionContext()) {
        await chrome.storage.sync.set({ 'markdown-config': this.config })
        logger.info('配置已保存到 chrome.storage.sync')
      }

      // 同时保存到 localStorage 作为备份
      localStorage.setItem('markdown-config', JSON.stringify(this.config))
      logger.info('配置已保存到 localStorage')
    } catch (error) {
      logger.error('保存配置失败:', error)
      
      // 如果 chrome.storage 失败，至少保存到 localStorage
      try {
        localStorage.setItem('markdown-config', JSON.stringify(this.config))
        logger.info('配置已保存到 localStorage（备选方案）')
      } catch (localError) {
        logger.error('所有存储方案都失败:', localError)
        throw new Error('无法保存配置')
      }
    }
  }

  /**
   * 防抖保存
   */
  private debouncedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }

    this.saveTimer = setTimeout(async () => {
      try {
        await this.saveToStorage()
      } catch (error) {
        logger.error('延迟保存配置失败:', error)
      }
    }, 500) // 500ms 防抖
  }

  /**
   * 设置存储监听器
   */
  private setupStorageListener(): void {
    if (!this.isExtensionContext()) {
      return
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes['markdown-config']) {
        const newConfig = changes['markdown-config'].newValue
        if (newConfig && JSON.stringify(newConfig) !== JSON.stringify(this.config)) {
          this.config = this.mergeWithDefaults(newConfig)
          this.notifyListeners()
          logger.info('配置已从存储同步更新')
        }
      }
    })
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getConfig())
      } catch (error) {
        logger.error('配置监听器执行失败:', error)
      }
    })
  }

  /**
   * 合并配置与默认值
   */
  private mergeWithDefaults(config: any): MarkdownConfig {
    return {
      ...defaultConfig,
      ...config,
      // 确保所有必需字段都存在
      accentColor: config.accentColor || defaultConfig.accentColor,
      theme: config.theme || defaultConfig.theme,
      fontSize: config.fontSize || defaultConfig.fontSize,
      lineHeight: config.lineHeight || defaultConfig.lineHeight,
      maxWidth: config.maxWidth || defaultConfig.maxWidth,
      fontFamily: config.fontFamily || defaultConfig.fontFamily,
      // 确保favoriteColors是数组
      favoriteColors: Array.isArray(config.favoriteColors) ? config.favoriteColors : defaultConfig.favoriteColors,
      // 确保customAccentColor存在
      customAccentColor: config.customAccentColor || defaultConfig.customAccentColor
    }
  }

  /**
   * 验证配置
   */
  private validateConfig(config: MarkdownConfig): void {
    // 验证字体大小
    if (config.fontSize < 12 || config.fontSize > 24) {
      throw new Error('字体大小必须在 12-24px 之间')
    }

    // 验证行高
    if (config.lineHeight < 1.2 || config.lineHeight > 2.0) {
      throw new Error('行高必须在 1.2-2.0 之间')
    }

    // 验证最大宽度
    if (config.maxWidth < 600 || config.maxWidth > 1200) {
      throw new Error('最大宽度必须在 600-1200px 之间')
    }

    // 验证主题
    const validThemes = ['auto', 'light', 'dark', 'eyecare']
    if (!validThemes.includes(config.theme)) {
      throw new Error('无效的主题设置')
    }

    // 验证强调色
    const validAccentColors = ['blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'graphite']
    if (!validAccentColors.includes(config.accentColor)) {
      throw new Error('无效的强调色设置')
    }
  }

  /**
   * 检查是否在扩展上下文中
   */
  private isExtensionContext(): boolean {
    try {
      return !!(chrome?.runtime?.id && chrome?.storage?.sync)
    } catch {
      return false
    }
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance()