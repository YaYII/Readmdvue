/**
 * 常用颜色管理器
 * 提供可靠的常用颜色持久化存储和同步机制
 * 基于苹果设计哲学的用户体验优化
 */

export interface FavoriteColorsConfig {
  colors: string[]
  maxSlots: number
  lastUpdated: number
  version: string
}

export class FavoriteColorsManager {
  private static instance: FavoriteColorsManager
  private readonly STORAGE_KEY = 'markdown-favorite-colors'
  private readonly BACKUP_KEY = 'markdown-favorite-colors-backup'
  private readonly MAX_SLOTS = 5
  private readonly VERSION = '1.0.0'
  
  private config: FavoriteColorsConfig = {
    colors: [],
    maxSlots: this.MAX_SLOTS,
    lastUpdated: Date.now(),
    version: this.VERSION
  }
  
  private listeners: Array<(colors: string[]) => void> = []
  private isInitialized = false
  
  static getInstance(): FavoriteColorsManager {
    if (!FavoriteColorsManager.instance) {
      FavoriteColorsManager.instance = new FavoriteColorsManager()
    }
    return FavoriteColorsManager.instance
  }
  
  /**
   * 初始化常用颜色管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }
    
    try {
      await this.loadFromStorage()
      this.isInitialized = true
      console.log('常用颜色管理器初始化成功:', this.config)
    } catch (error) {
      console.error('常用颜色管理器初始化失败:', error)
      // 使用默认配置
      this.config = {
        colors: [],
        maxSlots: this.MAX_SLOTS,
        lastUpdated: Date.now(),
        version: this.VERSION
      }
      this.isInitialized = true
    }
  }
  
  /**
   * 获取常用颜色列表
   */
  getFavoriteColors(): string[] {
    return [...this.config.colors]
  }
  
  /**
   * 添加颜色到常用颜色
   */
  async addColor(color: string): Promise<boolean> {
    if (!color || !this.isValidColor(color)) {
      console.warn('无效的颜色值:', color)
      return false
    }
    
    const normalizedColor = this.normalizeColor(color)
    
    // 如果颜色已存在，移动到最前面
    const existingIndex = this.config.colors.indexOf(normalizedColor)
    if (existingIndex !== -1) {
      this.config.colors.splice(existingIndex, 1)
    }
    
    // 添加到开头
    this.config.colors.unshift(normalizedColor)
    
    // 限制最大数量
    if (this.config.colors.length > this.config.maxSlots) {
      this.config.colors = this.config.colors.slice(0, this.config.maxSlots)
    }
    
    this.config.lastUpdated = Date.now()
    
    try {
      await this.saveToStorage()
      this.notifyListeners()
      console.log('颜色已添加到常用颜色:', normalizedColor)
      return true
    } catch (error) {
      console.error('保存常用颜色失败:', error)
      return false
    }
  }
  
  /**
   * 从常用颜色中移除颜色
   */
  async removeColor(color: string): Promise<boolean> {
    const normalizedColor = this.normalizeColor(color)
    const index = this.config.colors.indexOf(normalizedColor)
    
    if (index === -1) {
      console.warn('颜色不在常用颜色列表中:', normalizedColor)
      return false
    }
    
    this.config.colors.splice(index, 1)
    this.config.lastUpdated = Date.now()
    
    try {
      await this.saveToStorage()
      this.notifyListeners()
      console.log('颜色已从常用颜色中移除:', normalizedColor)
      return true
    } catch (error) {
      console.error('保存常用颜色失败:', error)
      return false
    }
  }
  
  /**
   * 清空所有常用颜色
   */
  async clearColors(): Promise<boolean> {
    this.config.colors = []
    this.config.lastUpdated = Date.now()
    
    try {
      await this.saveToStorage()
      this.notifyListeners()
      console.log('常用颜色已清空')
      return true
    } catch (error) {
      console.error('清空常用颜色失败:', error)
      return false
    }
  }
  
  /**
   * 检查颜色是否在常用颜色中
   */
  hasColor(color: string): boolean {
    const normalizedColor = this.normalizeColor(color)
    return this.config.colors.includes(normalizedColor)
  }
  
  /**
   * 获取常用颜色的数量
   */
  getColorCount(): number {
    return this.config.colors.length
  }
  
  /**
   * 获取最大插槽数量
   */
  getMaxSlots(): number {
    return this.config.maxSlots
  }
  
  /**
   * 添加变化监听器
   */
  addListener(listener: (colors: string[]) => void): void {
    this.listeners.push(listener)
  }
  
  /**
   * 移除变化监听器
   */
  removeListener(listener: (colors: string[]) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }
  
  /**
   * 导出常用颜色配置
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }
  
  /**
   * 导入常用颜色配置
   */
  async importConfig(configJson: string): Promise<boolean> {
    try {
      const importedConfig = JSON.parse(configJson) as FavoriteColorsConfig
      
      // 验证配置格式
      if (!this.isValidConfig(importedConfig)) {
        console.error('无效的常用颜色配置格式')
        return false
      }
      
      // 验证所有颜色
      const validColors = importedConfig.colors.filter(color => this.isValidColor(color))
      
      this.config = {
        colors: validColors.slice(0, this.config.maxSlots),
        maxSlots: this.config.maxSlots,
        lastUpdated: Date.now(),
        version: this.VERSION
      }
      
      await this.saveToStorage()
      this.notifyListeners()
      console.log('常用颜色配置导入成功')
      return true
    } catch (error) {
      console.error('导入常用颜色配置失败:', error)
      return false
    }
  }
  
  /**
   * 从存储加载配置
   */
  private async loadFromStorage(): Promise<void> {
    try {
      let loadedConfig: FavoriteColorsConfig | null = null
      
      // 优先从 chrome.storage.sync 加载
      if (this.isChromeExtension()) {
        try {
          const result = await chrome.storage.sync.get(this.STORAGE_KEY)
          if (result[this.STORAGE_KEY]) {
            loadedConfig = result[this.STORAGE_KEY]
            console.log('从 chrome.storage.sync 加载常用颜色配置')
          }
        } catch (error) {
          console.warn('从 chrome.storage.sync 加载失败:', error)
        }
      }
      
      // 如果 chrome.storage 不可用或没有数据，从 localStorage 加载
      if (!loadedConfig) {
        const saved = localStorage.getItem(this.STORAGE_KEY)
        if (saved) {
          loadedConfig = JSON.parse(saved)
          console.log('从 localStorage 加载常用颜色配置')
        }
      }
      
      // 如果有加载的配置，验证并应用
      if (loadedConfig && this.isValidConfig(loadedConfig)) {
        // 验证所有颜色
        const validColors = loadedConfig.colors.filter(color => this.isValidColor(color))
        
        this.config = {
          colors: validColors.slice(0, this.MAX_SLOTS),
          maxSlots: this.MAX_SLOTS,
          lastUpdated: loadedConfig.lastUpdated || Date.now(),
          version: this.VERSION
        }
        
        // 如果从 localStorage 加载，尝试同步到 chrome.storage
        if (this.isChromeExtension() && localStorage.getItem(this.STORAGE_KEY)) {
          try {
            await chrome.storage.sync.set({ [this.STORAGE_KEY]: this.config })
            console.log('常用颜色配置已同步到 chrome.storage.sync')
          } catch (error) {
            console.warn('同步到 chrome.storage.sync 失败:', error)
          }
        }
      }
    } catch (error) {
      console.error('加载常用颜色配置失败:', error)
      throw error
    }
  }
  
  /**
   * 保存配置到存储
   */
  private async saveToStorage(): Promise<void> {
    try {
      // 创建备份
      await this.createBackup()
      
      // 保存到 chrome.storage.sync
      if (this.isChromeExtension()) {
        try {
          await chrome.storage.sync.set({ [this.STORAGE_KEY]: this.config })
          console.log('常用颜色配置已保存到 chrome.storage.sync')
        } catch (error) {
          console.warn('保存到 chrome.storage.sync 失败:', error)
        }
      }
      
      // 同时保存到 localStorage 作为备份
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config))
      console.log('常用颜色配置已保存到 localStorage')
      
    } catch (error) {
      console.error('保存常用颜色配置失败:', error)
      throw error
    }
  }
  
  /**
   * 创建配置备份
   */
  private async createBackup(): Promise<void> {
    try {
      const backup = {
        ...this.config,
        backupTime: Date.now()
      }
      
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify(backup))
    } catch (error) {
      console.warn('创建常用颜色配置备份失败:', error)
    }
  }
  
  /**
   * 从备份恢复配置
   */
  async restoreFromBackup(): Promise<boolean> {
    try {
      const backup = localStorage.getItem(this.BACKUP_KEY)
      if (!backup) {
        console.warn('没有找到常用颜色配置备份')
        return false
      }
      
      const backupConfig = JSON.parse(backup)
      if (this.isValidConfig(backupConfig)) {
        this.config = {
          colors: backupConfig.colors.filter((color: string) => this.isValidColor(color)),
          maxSlots: this.MAX_SLOTS,
          lastUpdated: Date.now(),
          version: this.VERSION
        }
        
        await this.saveToStorage()
        this.notifyListeners()
        console.log('常用颜色配置已从备份恢复')
        return true
      }
      
      return false
    } catch (error) {
      console.error('从备份恢复常用颜色配置失败:', error)
      return false
    }
  }
  
  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const colors = this.getFavoriteColors()
    this.listeners.forEach(listener => {
      try {
        listener(colors)
      } catch (error) {
        console.error('通知常用颜色变化监听器失败:', error)
      }
    })
  }
  
  /**
   * 验证颜色值是否有效
   */
  private isValidColor(color: string): boolean {
    if (!color || typeof color !== 'string') {
      return false
    }
    
    // 支持 hex 格式 (#RGB, #RRGGBB)
    const hexRegex = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/
    if (hexRegex.test(color)) {
      return true
    }
    
    // 支持 rgb/rgba 格式
    const rgbRegex = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/
    if (rgbRegex.test(color)) {
      return true
    }
    
    // 支持 hsl/hsla 格式
    const hslRegex = /^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[\d.]+)?\s*\)$/
    if (hslRegex.test(color)) {
      return true
    }
    
    return false
  }
  
  /**
   * 标准化颜色值
   */
  private normalizeColor(color: string): string {
    if (!color) return ''
    
    // 转换为大写并去除空格
    let normalized = color.trim().toUpperCase()
    
    // 如果是3位hex，转换为6位
    if (/^#[A-F0-9]{3}$/.test(normalized)) {
      normalized = '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3]
    }
    
    return normalized
  }
  
  /**
   * 验证配置格式是否有效
   */
  private isValidConfig(config: any): config is FavoriteColorsConfig {
    return (
      config &&
      typeof config === 'object' &&
      Array.isArray(config.colors) &&
      typeof config.maxSlots === 'number' &&
      typeof config.lastUpdated === 'number' &&
      typeof config.version === 'string'
    )
  }
  
  /**
   * 检查是否在 Chrome 扩展环境中
   */
  private isChromeExtension(): boolean {
    return typeof chrome !== 'undefined' && 
           chrome.storage !== undefined && 
           chrome.storage.sync !== undefined
  }
}

// 导出单例实例
export const favoriteColorsManager = FavoriteColorsManager.getInstance()