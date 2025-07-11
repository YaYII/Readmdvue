import type { MarkdownConfig } from '../types'
import { logger } from './index'

/**
 * 配置更新节流管理器
 * 解决Chrome Storage API的写操作频率限制问题
 */
export class ConfigThrottleManager {
  private static instance: ConfigThrottleManager
  private pendingUpdates: Partial<MarkdownConfig> = {}
  private updateTimer: NodeJS.Timeout | null = null
  private lastUpdateTime = 0
  private readonly MIN_UPDATE_INTERVAL = 1000 // 最小更新间隔：1秒
  private readonly MAX_PENDING_TIME = 3000 // 最大等待时间：3秒

  static getInstance(): ConfigThrottleManager {
    if (!this.instance) {
      this.instance = new ConfigThrottleManager()
    }
    return this.instance
  }

  /**
   * 节流更新配置
   */
  async throttleUpdate(
    newConfig: Partial<MarkdownConfig>,
    updateCallback: (config: Partial<MarkdownConfig>) => Promise<void>
  ): Promise<void> {
    // 合并待更新的配置
    this.pendingUpdates = { ...this.pendingUpdates, ...newConfig }
    
    // 清除之前的定时器
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
    }

    const now = Date.now()
    const timeSinceLastUpdate = now - this.lastUpdateTime
    
    // 如果距离上次更新时间足够长，立即更新
    if (timeSinceLastUpdate >= this.MIN_UPDATE_INTERVAL) {
      await this.executeUpdate(updateCallback)
      return
    }

    // 否则设置延迟更新
    const delay = Math.min(
      this.MIN_UPDATE_INTERVAL - timeSinceLastUpdate,
      this.MAX_PENDING_TIME
    )

    this.updateTimer = setTimeout(async () => {
      await this.executeUpdate(updateCallback)
    }, delay)

    logger.info('配置更新已节流', { 
      delay, 
      pendingUpdates: Object.keys(this.pendingUpdates),
      timeSinceLastUpdate 
    })
  }

  /**
   * 执行实际的配置更新
   */
  private async executeUpdate(
    updateCallback: (config: Partial<MarkdownConfig>) => Promise<void>
  ): Promise<void> {
    if (Object.keys(this.pendingUpdates).length === 0) {
      return
    }

    const configToUpdate = { ...this.pendingUpdates }
    this.pendingUpdates = {}
    this.updateTimer = null
    this.lastUpdateTime = Date.now()

    try {
      await updateCallback(configToUpdate)
      logger.info('配置更新成功', { updatedFields: Object.keys(configToUpdate) })
    } catch (error) {
      logger.error('配置更新失败', error)
      // 如果更新失败，将配置重新加入待更新队列
      this.pendingUpdates = { ...this.pendingUpdates, ...configToUpdate }
      throw error
    }
  }

  /**
   * 强制立即更新所有待处理的配置
   */
  async forceUpdate(
    updateCallback: (config: Partial<MarkdownConfig>) => Promise<void>
  ): Promise<void> {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
    }
    await this.executeUpdate(updateCallback)
  }

  /**
   * 清除所有待处理的更新
   */
  clearPendingUpdates(): void {
    this.pendingUpdates = {}
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
  }

  /**
   * 获取当前待处理的更新
   */
  getPendingUpdates(): Partial<MarkdownConfig> {
    return { ...this.pendingUpdates }
  }
}

export const configThrottleManager = ConfigThrottleManager.getInstance()