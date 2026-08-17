/**
 * CSS变量管理器 - 非注入式CSS管理方案
 * 通过CSS变量和类切换实现动态样式管理
 */

export type ThemeMode = 'light' | 'dark' | 'auto' | 'eyecare'
export type AccentColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'graphite' | 'white' | 'custom'

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
  setAccentColor(accentColor: AccentColor, customColor?: string): void {
    console.log('设置强调色:', accentColor, customColor)

    // 移除现有强调色类
    const existingAccentClasses = Array.from(this.root.classList)
      .filter(cls => cls.startsWith('accent-'))
    existingAccentClasses.forEach(cls => this.root.classList.remove(cls))

    // 设置新强调色
    this.root.setAttribute('data-accent', accentColor)
    this.root.classList.add(`accent-${accentColor}`)

    // 处理自定义强调色
    if (accentColor === 'custom' && customColor) {
      // 设置自定义强调色的核心变量
      this.root.style.setProperty('--custom-accent-color', customColor, 'important')
      this.root.style.setProperty('--apple-accent-primary', customColor, 'important')
      this.root.style.setProperty('--accent-color', customColor, 'important')
      
      // 设置完整的强调色变量体系
      this.setCustomAccentColorVariables(customColor)
      
      // 强制注入样式以确保生效
      this.injectAccentColorStyles(accentColor, customColor)
      
      console.log('自定义强调色CSS变量已设置:', customColor)
      
      // 验证样式是否生效
      this.verifyStyleApplication(accentColor, customColor)
    } else {
      // 清除自定义强调色变量
      this.root.style.removeProperty('--custom-accent-color')
      
      // 同时设置CSS变量以确保兼容性
      const colorValue = this.getPresetAccentColor(accentColor)
      if (colorValue) {
        this.root.style.setProperty('--apple-accent-primary', colorValue, 'important')
        this.root.style.setProperty('--accent-color', colorValue, 'important')
        
        // 强制注入样式以确保生效
        this.injectAccentColorStyles(accentColor, colorValue)
        
        console.log('预设强调色CSS变量已设置:', colorValue)
        
        // 验证样式是否生效
        this.verifyStyleApplication(accentColor, colorValue)
      }
    }
  }

  /**
   * 注入强制强调色样式
   */
  private injectAccentColorStyles(accentColor: AccentColor, color: string): void {
    // 移除之前的强制样式
    const existingStyle = document.getElementById('md-accent-color-override')
    if (existingStyle) {
      existingStyle.remove()
    }

    // 创建新的样式元素
    const styleElement = document.createElement('style')
    styleElement.id = 'md-accent-color-override'
    
    // 为自定义强调色生成更全面的样式
    if (accentColor === 'custom') {
      styleElement.textContent = `
        /* Markdown Reader 自定义强调色强制样式 */
        :root {
          --custom-accent-color: ${color} !important;
          --apple-accent-primary: ${color} !important;
          --accent-color: ${color} !important;
          --md-accent-primary: ${color} !important;
          --accent-primary: ${color} !important;
          --primary-color: ${color} !important;
          --link-color: ${color} !important;
        }
        
        /* 自定义强调色的完整变量体系 */
        :root[data-accent="custom"] {
          --md-accent-primary: ${color} !important;
          --md-accent-secondary: color-mix(in srgb, ${color} 80%, transparent) !important;
          --md-accent-tertiary: color-mix(in srgb, ${color} 60%, transparent) !important;
          --md-accent-hover: color-mix(in srgb, ${color} 80%, black) !important;
          --md-accent-active: color-mix(in srgb, ${color} 60%, black) !important;
          --md-accent-light: color-mix(in srgb, ${color} 10%, transparent) !important;
          --md-accent-gradient: linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 70%, white) 100%) !important;
        }
        
        /* 自定义强调色类的样式 */
        .accent-custom {
          --apple-accent-primary: ${color} !important;
          --apple-accent-gradient: linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 70%, white) 100%) !important;
          --apple-accent-gradient-hover: linear-gradient(135deg, color-mix(in srgb, ${color} 80%, black) 0%, color-mix(in srgb, ${color} 60%, white) 100%) !important;
        }
        
        /* 自定义强调色选择器样式 */
        .accent-color-option.custom {
          background: ${color} !important;
          background-image: linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 70%, white) 100%) !important;
        }
        
        /* 强制应用到所有强调色相关的UI组件 */
        .btn-accent,
        .link-accent,
        .tag-accent,
        .progress-bar.accent,
        .loading-accent,
        input:checked + .switch-slider.accent,
        .input-accent:focus,
        a[href]:not([class]),
        .markdown-body a,
        .md-content a {
          color: ${color} !important;
        }
        
        .btn-accent {
          background: linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 70%, white) 100%) !important;
        }
        
        .btn-accent:hover {
          background: linear-gradient(135deg, color-mix(in srgb, ${color} 80%, black) 0%, color-mix(in srgb, ${color} 60%, white) 100%) !important;
        }
        
        .input-accent:focus {
          border-color: ${color} !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, ${color} 20%, transparent) !important;
        }
        
        .tag-accent {
          background: color-mix(in srgb, ${color} 10%, transparent) !important;
          color: ${color} !important;
          border-color: color-mix(in srgb, ${color} 20%, transparent) !important;
        }
        
        .progress-bar.accent,
        input:checked + .switch-slider.accent {
          background: ${color} !important;
        }
        
        .loading-accent {
          border-top-color: ${color} !important;
        }
      `
    } else {
      // 预设强调色的样式注入
      styleElement.textContent = `
        /* Markdown Reader 强调色强制样式 */
        :root {
          --apple-accent-primary: ${color} !important;
          --accent-color: ${color} !important;
          --md-accent-primary: ${color} !important;
        }
        
        .accent-${accentColor} {
          --apple-accent-primary: ${color} !important;
        }
        
        /* 强制应用到常见元素 */
        .markdown-body a,
        .md-content a,
        [data-md-rendered] a {
          color: ${color} !important;
        }
        
        .markdown-body .highlight,
        .md-content .highlight,
        [data-md-rendered] .highlight {
          background-color: ${color}20 !important;
        }
        
        /* 按钮和交互元素 */
        .btn-accent,
        .accent-button {
          background-color: ${color} !important;
          border-color: ${color} !important;
        }
      `
    }
    
    // 插入到head的最后，确保优先级
    document.head.appendChild(styleElement)
    console.log('强制强调色样式已注入')
  }

  /**
   * 获取预设强调色值
   */
  private getPresetAccentColor(accentColor: AccentColor): string | null {
    const accentColors = {
      blue: '#007AFF',
      purple: '#AF52DE',
      pink: '#FF2D92',
      red: '#FF3B30',
      orange: '#FF9500',
      yellow: '#FFCC00',
      green: '#30D158',
      graphite: '#8E8E93',
      white: '#FFFFFF'
    }
    
    return accentColors[accentColor as keyof typeof accentColors] || null
  }

  /**
   * 验证样式应用是否成功
   */
  private verifyStyleApplication(accentColor: AccentColor, expectedColor?: string): void {
    setTimeout(() => {
      const computedStyle = getComputedStyle(this.root)
      const actualColor = computedStyle.getPropertyValue('--apple-accent-primary').trim()
      
      const targetColor = expectedColor || this.getPresetAccentColor(accentColor)
      
      console.log('样式验证结果:', {
        expected: targetColor,
        actual: actualColor,
        accentColor: accentColor,
        rootClasses: this.root.className,
        dataAccent: this.root.getAttribute('data-accent')
      })
      
      if (targetColor && actualColor !== targetColor) {
        console.warn('强调色样式未正确应用，尝试备用方案')
        this.fallbackStyleApplication(accentColor, targetColor)
      } else {
        console.log('✅ 强调色样式应用成功')
      }
    }, 100)
  }

  /**
   * 备用样式应用方案
   */
  private fallbackStyleApplication(_accentColor: AccentColor, color: string | null): void {
    if (!color) return
    // 方案1: 直接在body上设置样式
    document.body.style.setProperty('--apple-accent-primary', color, 'important')
    document.body.style.setProperty('--accent-color', color, 'important')
    
    // 方案2: 在所有可能的容器上设置
    const containers = [
      '.markdown-body',
      '.md-content', 
      '[data-md-rendered]',
      'main',
      'article',
      '.content'
    ]
    
    containers.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.setProperty('--apple-accent-primary', color, 'important')
          element.style.setProperty('--accent-color', color, 'important')
        }
      })
    })
    
    console.log('备用样式应用方案已执行')
  }

  /**
   * 设置完整的自定义强调色变量体系
   */
  private setCustomAccentColorVariables(customColor: string): void {
    // 设置所有相关的强调色变量
    const accentVariables = {
      '--custom-accent-color': customColor,
      '--apple-accent-primary': customColor,
      '--accent-color': customColor,
      '--md-accent-primary': customColor,
      '--accent-primary': customColor,
      '--primary-color': customColor,
      '--link-color': customColor,
      '--highlight-color': customColor + '20' // 20% 透明度用于高亮
    }

    Object.entries(accentVariables).forEach(([variable, value]) => {
      this.root.style.setProperty(variable, value, 'important')
    })

    console.log('完整的自定义强调色变量体系已设置:', accentVariables)
  }

  /**
   * 设置自定义强调色
   */
  setCustomAccentColor(customColor: string): void {
    this.setAccentColor('custom', customColor)
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
   * 设置字体家族
   * 通过CSS变量直接设置字体家族
   */
  setFontFamily(fontFamily: string): void {
    console.log('设置字体家族:', fontFamily)
    this.root.style.setProperty('--md-font-family', fontFamily)
  }

  /**
   * 设置最大宽度
   * 通过data属性存储最大宽度配置
   */
  setMaxWidth(maxWidth: number): void {
    this.root.setAttribute('data-max-width', maxWidth.toString())
    this.root.classList.add('custom-max-width')
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
    maxWidth?: number
    fontFamily?: string
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

    if (config.maxWidth) {
      this.setMaxWidth(config.maxWidth)
    }

    if (config.fontFamily) {
      this.setFontFamily(config.fontFamily)
    }
  }
}

// 导出单例实例
export const cssVariableManager = CSSVariableManager.getInstance()
