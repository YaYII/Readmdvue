import type { AccentColor } from '../types'
import { logger } from './index'

/**
 * 强调色管理器
 * 专门用于在content script环境中管理强调色
 */
export class AccentColorManager {
  private static instance: AccentColorManager
  private currentAccentColor: AccentColor = 'blue'
  private styleElement: HTMLStyleElement | null = null

  static getInstance(): AccentColorManager {
    if (!AccentColorManager.instance) {
      AccentColorManager.instance = new AccentColorManager()
    }
    return AccentColorManager.instance
  }

  /**
   * 强调色配置映射
   */
  private readonly accentColorMap: Record<AccentColor, {
    primary: string
    secondary: string
    tertiary: string
    quaternary: string
    quinary: string
    gradient: string
    gradientHover: string
  }> = {
    blue: {
      primary: '#007AFF',
      secondary: 'rgba(0, 122, 255, 0.8)',
      tertiary: 'rgba(0, 122, 255, 0.6)',
      quaternary: 'rgba(0, 122, 255, 0.4)',
      quinary: 'rgba(0, 122, 255, 0.2)',
      gradient: 'linear-gradient(135deg, #007AFF, rgba(0, 122, 255, 0.8))',
      gradientHover: 'linear-gradient(135deg, rgba(0, 122, 255, 0.8), rgba(0, 122, 255, 0.6))'
    },
    purple: {
      primary: '#AF52DE',
      secondary: 'rgba(175, 82, 222, 0.8)',
      tertiary: 'rgba(175, 82, 222, 0.6)',
      quaternary: 'rgba(175, 82, 222, 0.4)',
      quinary: 'rgba(175, 82, 222, 0.2)',
      gradient: 'linear-gradient(135deg, #AF52DE, rgba(175, 82, 222, 0.8))',
      gradientHover: 'linear-gradient(135deg, rgba(175, 82, 222, 0.8), rgba(175, 82, 222, 0.6))'
    },
    pink: {
      primary: '#FF2D92',
      secondary: 'rgba(255, 45, 146, 0.8)',
      tertiary: 'rgba(255, 45, 146, 0.6)',
      quaternary: 'rgba(255, 45, 146, 0.4)',
      quinary: 'rgba(255, 45, 146, 0.2)',
      gradient: 'linear-gradient(135deg, #FF2D92, rgba(255, 45, 146, 0.8))',
      gradientHover: 'linear-gradient(135deg, rgba(255, 45, 146, 0.8), rgba(255, 45, 146, 0.6))'
    },
    red: {
      primary: '#FF3B30',
      secondary: 'rgba(255, 59, 48, 0.8)',
      tertiary: 'rgba(255, 59, 48, 0.6)',
      quaternary: 'rgba(255, 59, 48, 0.4)',
      quinary: 'rgba(255, 59, 48, 0.2)',
      gradient: 'linear-gradient(135deg, #FF3B30, rgba(255, 59, 48, 0.8))',
      gradientHover: 'linear-gradient(135deg, rgba(255, 59, 48, 0.8), rgba(255, 59, 48, 0.6))'
    },
    orange: {
      primary: '#FF9500',
      secondary: 'rgba(255, 149, 0, 0.8)',
      tertiary: 'rgba(255, 149, 0, 0.6)',
      quaternary: 'rgba(255, 149, 0, 0.4)',
      quinary: 'rgba(255, 149, 0, 0.2)',
      gradient: 'linear-gradient(135deg, #FF9500, rgba(255, 149, 0, 0.8))',
      gradientHover: 'linear-gradient(135deg, rgba(255, 149, 0, 0.8), rgba(255, 149, 0, 0.6))'
    },
    yellow: {
      primary: '#FFCC00',
      secondary: 'rgba(255, 204, 0, 0.8)',
      tertiary: 'rgba(255, 204, 0, 0.6)',
      quaternary: 'rgba(255, 204, 0, 0.4)',
      quinary: 'rgba(255, 204, 0, 0.2)',
      gradient: 'linear-gradient(135deg, #FFCC00, rgba(255, 204, 0, 0.8))',
      gradientHover: 'linear-gradient(135deg, rgba(255, 204, 0, 0.8), rgba(255, 204, 0, 0.6))'
    },
    green: {
      primary: '#30D158',
      secondary: 'rgba(48, 209, 88, 0.8)',
      tertiary: 'rgba(48, 209, 88, 0.6)',
      quaternary: 'rgba(48, 209, 88, 0.4)',
      quinary: 'rgba(48, 209, 88, 0.2)',
      gradient: 'linear-gradient(135deg, #30D158, rgba(48, 209, 88, 0.8))',
      gradientHover: 'linear-gradient(135deg, rgba(48, 209, 88, 0.8), rgba(48, 209, 88, 0.6))'
    },
    graphite: {
      primary: '#8E8E93',
      secondary: 'rgba(142, 142, 147, 0.8)',
      tertiary: 'rgba(142, 142, 147, 0.6)',
      quaternary: 'rgba(142, 142, 147, 0.4)',
      quinary: 'rgba(142, 142, 147, 0.2)',
      gradient: 'linear-gradient(135deg, #8E8E93, rgba(142, 142, 147, 0.8))',
      gradientHover: 'linear-gradient(135deg, rgba(142, 142, 147, 0.8), rgba(142, 142, 147, 0.6))'
    }
  }

  /**
   * 应用强调色
   */
  applyAccentColor(accentColor: AccentColor): void {
    this.currentAccentColor = accentColor
    
    // 移除现有的强调色类
    this.removeExistingAccentClasses()
    
    // 添加新的强调色类
    document.documentElement.classList.add(`accent-${accentColor}`)
    
    // 设置data属性供CSS选择器使用
    document.documentElement.setAttribute('data-accent-color', accentColor)
    
    logger.info(`强调色已应用: ${accentColor}`)
  }

  /**
   * 移除现有的强调色类
   */
  private removeExistingAccentClasses(): void {
    const classList = document.documentElement.classList
    const accentClasses = Array.from(classList).filter(cls => cls.startsWith('accent-'))
    accentClasses.forEach(cls => classList.remove(cls))
  }

  // 原 applyCSSVariables 和 applyAccentColorVariables 方法已移除
  // 强调色现在完全通过CSS类和属性选择器控制，不再使用JavaScript设置CSS变量

  /**
   * 获取当前强调色
   */
  getCurrentAccentColor(): AccentColor {
    return this.currentAccentColor
  }

  /**
   * 获取强调色配置
   */
  getAccentColorConfig(accentColor: AccentColor) {
    return this.accentColorMap[accentColor]
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.styleElement) {
      this.styleElement.remove()
      this.styleElement = null
    }
    this.removeExistingAccentClasses()
  }
}

// 导出单例实例
export const accentColorManager = AccentColorManager.getInstance()