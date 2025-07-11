/**
 * CSS变量管理器 - 非注入式CSS管理方案
 * 通过CSS变量和类切换实现动态样式管理
 */

export type ThemeMode = 'light' | 'dark' | 'auto' | 'eyecare'
export type AccentColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'graphite'

export class CSSVariableManager {
  private static instance: CSSVariableManager
  private root: HTMLElement

  static getInstance(): CSSVariableManager {
    if (!CSSVariableManager.instance) {
      CSSVariableManager.instance = new CSSVariableManager()
    }
    return CSSVariableManager.instance
  }

  private constructor() {
    this.root = document.documentElement
  }

  /**
   * 设置主题模式
   * 通过切换根元素的data-theme属性来控制CSS变量
   */
  setTheme(theme: ThemeMode): void {
    // 移除现有主题类
    this.root.classList.remove('theme-light', 'theme-dark', 'theme-auto', 'theme-eyecare')
    
    // 设置新主题
    this.root.setAttribute('data-theme', theme)
    this.root.classList.add(`theme-${theme}`)
    
    // 如果是auto模式，监听系统主题变化
    if (theme === 'auto') {
      this.watchSystemTheme()
    }
  }

  /**
   * 设置强调色
   * 通过切换根元素的data-accent属性来控制强调色变量
   */
  setAccentColor(accentColor: AccentColor): void {
    // 移除现有强调色类
    const existingAccentClasses = Array.from(this.root.classList)
      .filter(cls => cls.startsWith('accent-'))
    existingAccentClasses.forEach(cls => this.root.classList.remove(cls))
    
    // 设置新强调色
    this.root.setAttribute('data-accent', accentColor)
    this.root.classList.add(`accent-${accentColor}`)
  }

  /**
   * 设置字体配置
   * 通过data属性和预定义的CSS类实现，避免动态CSS变量注入
   */
  setTypography(fontSize: number, lineHeight: number): void {
    // 使用data属性存储字体配置，CSS通过属性选择器读取
    this.root.setAttribute('data-font-size', fontSize.toString())
    this.root.setAttribute('data-line-height', lineHeight.toString())
    
    // 添加相应的CSS类以触发样式更新
    this.root.classList.add('custom-typography')
  }

  /**
   * 批量设置配置
   * 通过data属性而非CSS变量实现
   */
  setVariables(variables: Record<string, string>): void {
    // 将CSS变量转换为data属性
    Object.entries(variables).forEach(([key, value]) => {
      const dataKey = key.replace('--', '').replace(/-/g, '_')
      this.root.setAttribute(`data-${dataKey}`, value)
    })
  }

  /**
   * 获取当前CSS变量值
   */
  getVariable(name: string): string {
    return getComputedStyle(this.root).getPropertyValue(name).trim()
  }

  /**
   * 重置所有自定义变量
   */
  reset(): void {
    // 重置主题
    this.root.removeAttribute('data-theme')
    this.root.classList.remove('theme-light', 'theme-dark', 'theme-auto', 'theme-eyecare')
    
    // 重置强调色
    this.root.removeAttribute('data-accent')
    const accentClasses = Array.from(this.root.classList)
      .filter(cls => cls.startsWith('accent-'))
    accentClasses.forEach(cls => this.root.classList.remove(cls))
    
    // 重置自定义CSS变量
    const customProperties = ['--md-font-size', '--md-line-height']
    customProperties.forEach(prop => {
      this.root.style.removeProperty(prop)
    })
  }

  /**
   * 监听系统主题变化
   */
  private watchSystemTheme(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const updateSystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      const systemTheme = e.matches ? 'dark' : 'light'
      this.root.setAttribute('data-system-theme', systemTheme)
    }
    
    // 初始设置
    updateSystemTheme(mediaQuery)
    
    // 监听变化
    mediaQuery.addEventListener('change', updateSystemTheme)
  }

  /**
   * 获取当前配置状态
   */
  getCurrentState(): {
    theme: string | null
    accent: string | null
    fontSize: string
    lineHeight: string
  } {
    return {
      theme: this.root.getAttribute('data-theme'),
      accent: this.root.getAttribute('data-accent'),
      fontSize: this.getVariable('--md-font-size'),
      lineHeight: this.getVariable('--md-line-height')
    }
  }

  /**
   * 应用完整配置
   */
  applyConfig(config: {
    theme?: ThemeMode
    accentColor?: AccentColor
    fontSize?: number
    lineHeight?: number
  }): void {
    if (config.theme) {
      this.setTheme(config.theme)
    }
    
    if (config.accentColor) {
      this.setAccentColor(config.accentColor)
    }
    
    if (config.fontSize || config.lineHeight) {
      this.setTypography(
        config.fontSize || 16,
        config.lineHeight || 1.6
      )
    }
  }
}

// 导出单例实例
export const cssVariableManager = CSSVariableManager.getInstance()