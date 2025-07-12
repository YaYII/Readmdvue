/**
 * 常用颜色数据迁移工具
 * 将旧的 MarkdownConfig.favoriteColors 数据迁移到新的 FavoriteColorsManager
 */

import { favoriteColorsManager } from './favoriteColorsManager'
import type { MarkdownConfig } from '../types'

export class FavoriteColorsMigration {
  private static instance: FavoriteColorsMigration
  private migrationCompleted = false
  
  static getInstance(): FavoriteColorsMigration {
    if (!FavoriteColorsMigration.instance) {
      FavoriteColorsMigration.instance = new FavoriteColorsMigration()
    }
    return FavoriteColorsMigration.instance
  }
  
  /**
   * 执行数据迁移
   */
  async migrate(config: MarkdownConfig): Promise<boolean> {
    if (this.migrationCompleted) {
      return true
    }
    
    try {
      console.log('开始常用颜色数据迁移...')
      
      // 确保常用颜色管理器已初始化
      await favoriteColorsManager.initialize()
      
      // 检查是否有旧数据需要迁移
      const oldFavoriteColors = config.favoriteColors || []
      const currentColors = favoriteColorsManager.getFavoriteColors()
      
      if (oldFavoriteColors.length === 0) {
        console.log('没有旧的常用颜色数据需要迁移')
        this.migrationCompleted = true
        return true
      }
      
      // 如果新管理器中已有数据，询问是否覆盖
      if (currentColors.length > 0) {
        console.log('新管理器中已有常用颜色数据，跳过迁移')
        this.migrationCompleted = true
        return true
      }
      
      // 迁移数据
      let migratedCount = 0
      for (const color of oldFavoriteColors) {
        if (color && typeof color === 'string') {
          const success = await favoriteColorsManager.addColor(color)
          if (success) {
            migratedCount++
          }
        }
      }
      
      console.log(`常用颜色数据迁移完成，成功迁移 ${migratedCount}/${oldFavoriteColors.length} 个颜色`)
      
      // 标记迁移完成
      this.migrationCompleted = true
      
      // 保存迁移标记到存储
      await this.saveMigrationFlag()
      
      return true
    } catch (error) {
      console.error('常用颜色数据迁移失败:', error)
      return false
    }
  }
  
  /**
   * 检查是否已完成迁移
   */
  async checkMigrationStatus(): Promise<boolean> {
    try {
      // 检查存储中的迁移标记
      const migrationFlag = await this.loadMigrationFlag()
      if (migrationFlag) {
        this.migrationCompleted = true
        return true
      }
      
      return false
    } catch (error) {
      console.warn('检查迁移状态失败:', error)
      return false
    }
  }
  
  /**
   * 强制重新迁移
   */
  async forceMigrate(config: MarkdownConfig): Promise<boolean> {
    this.migrationCompleted = false
    await this.clearMigrationFlag()
    return await this.migrate(config)
  }
  
  /**
   * 清理旧数据（迁移完成后调用）
   */
  async cleanupOldData(updateConfig: (updates: Partial<MarkdownConfig>) => Promise<void>): Promise<boolean> {
    try {
      // 清空旧的 favoriteColors 字段
      await updateConfig({ favoriteColors: [] })
      console.log('旧的常用颜色数据已清理')
      return true
    } catch (error) {
      console.error('清理旧数据失败:', error)
      return false
    }
  }
  
  /**
   * 保存迁移标记
   */
  private async saveMigrationFlag(): Promise<void> {
    try {
      const migrationData = {
        completed: true,
        timestamp: Date.now(),
        version: '1.0.0'
      }
      
      // 保存到 chrome.storage
      if (this.isChromeExtension()) {
        await chrome.storage.sync.set({ 'favorite-colors-migration': migrationData })
      }
      
      // 同时保存到 localStorage
      localStorage.setItem('favorite-colors-migration', JSON.stringify(migrationData))
    } catch (error) {
      console.warn('保存迁移标记失败:', error)
    }
  }
  
  /**
   * 加载迁移标记
   */
  private async loadMigrationFlag(): Promise<boolean> {
    try {
      // 优先从 chrome.storage 加载
      if (this.isChromeExtension()) {
        const result = await chrome.storage.sync.get('favorite-colors-migration')
        if (result['favorite-colors-migration']?.completed) {
          return true
        }
      }
      
      // 从 localStorage 加载
      const saved = localStorage.getItem('favorite-colors-migration')
      if (saved) {
        const migrationData = JSON.parse(saved)
        return migrationData.completed === true
      }
      
      return false
    } catch (error) {
      console.warn('加载迁移标记失败:', error)
      return false
    }
  }
  
  /**
   * 清除迁移标记
   */
  private async clearMigrationFlag(): Promise<void> {
    try {
      // 从 chrome.storage 清除
      if (this.isChromeExtension()) {
        await chrome.storage.sync.remove('favorite-colors-migration')
      }
      
      // 从 localStorage 清除
      localStorage.removeItem('favorite-colors-migration')
    } catch (error) {
      console.warn('清除迁移标记失败:', error)
    }
  }
  
  /**
   * 检查是否在 Chrome 扩展环境中
   */
  private isChromeExtension(): boolean {
    return typeof chrome !== 'undefined' && 
           chrome.storage !== undefined && 
           chrome.storage.sync !== undefined
  }
  
  /**
   * 获取迁移状态信息
   */
  getMigrationInfo(): { completed: boolean; timestamp?: number } {
    return {
      completed: this.migrationCompleted
    }
  }
}

// 导出单例实例
export const favoriteColorsMigration = FavoriteColorsMigration.getInstance()