/**
 * Liquid Glass 材质系统
 * 基于苹果2025年最新设计语言，实现半透明材质效果
 * 支持动态环境适应和实时渲染
 * 重构版本：完全基于CSS类和属性选择器，无JavaScript样式注入
 */

export interface LiquidGlassConfig {
  opacity?: number
  blur?: number
  brightness?: number
  contrast?: number
  saturation?: number
  hue?: number
  borderRadius?: number
  borderWidth?: number
  shadowIntensity?: number
  reflectionIntensity?: number
  environmentAdaptive?: boolean
  animationDuration?: number
}

export interface LiquidGlassTheme {
  name: string
  config: LiquidGlassConfig
  accentColor: string
  description: string
}

/**
 * Liquid Glass 材质管理器
 * 重构版本：所有样式通过CSS类和data属性控制
 */
export class LiquidGlassManager {
  private static instance: LiquidGlassManager
  private currentTheme: string = 'default'
  private environmentBrightness: number = 0.5
  private animationFrameId: number | null = null
  
  // 预定义主题
  private themes: Map<string, LiquidGlassTheme> = new Map([
    ['default', {
      name: '默认',
      config: {
        opacity: 0.8,
        blur: 20,
        brightness: 1.1,
        contrast: 1.2,
        saturation: 1.1,
        hue: 0,
        borderRadius: 12,
        borderWidth: 1,
        shadowIntensity: 0.3,
        reflectionIntensity: 0.2,
        environmentAdaptive: true,
        animationDuration: 300
      },
      accentColor: '#007AFF',
      description: '经典的Liquid Glass效果，适合大多数场景'
    }],
    ['vibrant', {
      name: '活力',
      config: {
        opacity: 0.85,
        blur: 25,
        brightness: 1.3,
        contrast: 1.4,
        saturation: 1.3,
        hue: 15,
        borderRadius: 16,
        borderWidth: 1.5,
        shadowIntensity: 0.4,
        reflectionIntensity: 0.3,
        environmentAdaptive: true,
        animationDuration: 250
      },
      accentColor: '#FF9500',
      description: '更加鲜艳的效果，适合创意和艺术类应用'
    }],
    ['subtle', {
      name: '优雅',
      config: {
        opacity: 0.75,
        blur: 15,
        brightness: 1.05,
        contrast: 1.1,
        saturation: 0.95,
        hue: -5,
        borderRadius: 8,
        borderWidth: 0.5,
        shadowIntensity: 0.2,
        reflectionIntensity: 0.15,
        environmentAdaptive: true,
        animationDuration: 400
      },
      accentColor: '#8E8E93',
      description: '更加内敛的效果，适合专业和商务场景'
    }],
    ['dark', {
      name: '深色',
      config: {
        opacity: 0.9,
        blur: 30,
        brightness: 0.8,
        contrast: 1.5,
        saturation: 0.8,
        hue: 0,
        borderRadius: 12,
        borderWidth: 1,
        shadowIntensity: 0.5,
        reflectionIntensity: 0.1,
        environmentAdaptive: true,
        animationDuration: 300
      },
      accentColor: '#AF52DE',
      description: '适合深色环境的Liquid Glass效果'
    }]
  ])

  static getInstance(): LiquidGlassManager {
    if (!LiquidGlassManager.instance) {
      LiquidGlassManager.instance = new LiquidGlassManager()
    }
    return LiquidGlassManager.instance
  }

  constructor() {
    this.initEnvironmentDetection()
    this.initGlobalStyles()
  }

  /**
   * 应用Liquid Glass效果到元素
   * 重构版本：通过CSS类和data属性控制
   */
  applyLiquidGlass(
    element: HTMLElement, 
    customConfig?: Partial<LiquidGlassConfig>,
    themeName?: string
  ): void {
    const theme = this.themes.get(themeName || this.currentTheme)!
    const config = { ...theme.config, ...customConfig }
    
    // 设置基础CSS类和data属性
    this.setElementClasses(element, config, theme.accentColor, themeName || this.currentTheme)
    
    // 添加动态效果类
    this.addDynamicEffectClasses(element)
    
    // 环境适应
    if (config.environmentAdaptive) {
      this.enableEnvironmentAdaptation(element, config)
    }
  }

  /**
   * 设置元素类和属性
   * 替代原来的直接样式设置
   */
  private setElementClasses(
    element: HTMLElement, 
    config: LiquidGlassConfig, 
    accentColor: string,
    themeName: string
  ): void {
    // 添加基础Liquid Glass类
    element.classList.add('liquid-glass-element')
    
    // 设置主题类
    element.classList.add(`liquid-glass-theme-${themeName}`)
    
    // 设置配置data属性，供CSS使用
    element.setAttribute('data-lg-opacity', (config.opacity || 0.8).toString())
    element.setAttribute('data-lg-blur', (config.blur || 20).toString())
    element.setAttribute('data-lg-brightness', (config.brightness || 1.1).toString())
    element.setAttribute('data-lg-contrast', (config.contrast || 1.2).toString())
    element.setAttribute('data-lg-saturation', (config.saturation || 1.1).toString())
    element.setAttribute('data-lg-hue', (config.hue || 0).toString())
    element.setAttribute('data-lg-border-radius', (config.borderRadius || 12).toString())
    element.setAttribute('data-lg-border-width', (config.borderWidth || 1).toString())
    element.setAttribute('data-lg-shadow-intensity', (config.shadowIntensity || 0.3).toString())
    element.setAttribute('data-lg-reflection-intensity', (config.reflectionIntensity || 0.2).toString())
    element.setAttribute('data-lg-animation-duration', (config.animationDuration || 300).toString())
    element.setAttribute('data-lg-accent-color', accentColor)
    element.setAttribute('data-liquid-glass-theme', themeName)
    
    // 添加反射效果
    this.addReflectionEffect(element, config, accentColor)
  }

  /**
   * 添加反射效果
   * 重构版本：创建反射层但通过CSS类控制样式
   */
  private addReflectionEffect(
    element: HTMLElement, 
    config: LiquidGlassConfig, 
    accentColor: string
  ): void {
    // 移除已存在的反射层
    const existingReflection = element.querySelector('.liquid-glass-reflection')
    if (existingReflection) {
      existingReflection.remove()
    }

    const reflection = document.createElement('div')
    reflection.className = 'liquid-glass-reflection'
    
    // 设置反射层的data属性，供CSS使用
    reflection.setAttribute('data-lg-reflection-intensity', (config.reflectionIntensity || 0.2).toString())
    reflection.setAttribute('data-lg-border-radius', (config.borderRadius || 12).toString())
    reflection.setAttribute('data-lg-accent-color', accentColor)
    
    element.appendChild(reflection)
  }

  /**
   * 添加动态效果类
   * 替代原来的事件监听器中的直接样式设置
   */
  private addDynamicEffectClasses(element: HTMLElement): void {
    // 移除已存在的事件监听器
    const newElement = element.cloneNode(true) as HTMLElement
    element.parentNode?.replaceChild(newElement, element)
    
    // 鼠标悬停效果 - 通过CSS类控制
    newElement.addEventListener('mouseenter', () => {
      newElement.classList.add('liquid-glass-hover')
    })

    newElement.addEventListener('mouseleave', () => {
      newElement.classList.remove('liquid-glass-hover', 'liquid-glass-active')
    })

    // 点击效果 - 通过CSS类控制
    newElement.addEventListener('mousedown', () => {
      newElement.classList.add('liquid-glass-active')
    })

    newElement.addEventListener('mouseup', () => {
      newElement.classList.remove('liquid-glass-active')
    })
  }

  /**
   * 启用环境适应
   * 重构版本：通过data属性和CSS类控制
   */
  private enableEnvironmentAdaptation(element: HTMLElement, config: LiquidGlassConfig): void {
    // 设置环境适应标记
    element.setAttribute('data-environment-adaptive', 'true')
    element.classList.add('liquid-glass-adaptive')
    
    const updateEnvironmentEffect = () => {
      const brightness = this.environmentBrightness
      
      // 计算自适应值并设置为data属性
      const adaptedOpacity = config.opacity! * (0.7 + brightness * 0.3)
      const adaptedBlur = config.blur! * (0.8 + brightness * 0.4)
      
      element.setAttribute('data-lg-adapted-opacity', adaptedOpacity.toString())
      element.setAttribute('data-lg-adapted-blur', adaptedBlur.toString())
      element.setAttribute('data-lg-environment-brightness', brightness.toString())
      
      // 触发CSS更新 - 通过切换类实现
      element.classList.remove('liquid-glass-environment-update')
      // 强制重排
      element.offsetHeight
      element.classList.add('liquid-glass-environment-update')
    }

    // 初始应用
    updateEnvironmentEffect()
  }

  /**
   * 初始化环境检测
   */
  private initEnvironmentDetection(): void {
    // 检测系统主题
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const updateEnvironment = () => {
      this.environmentBrightness = mediaQuery.matches ? 0.3 : 0.7
      
      // 更新文档根元素的环境属性
      document.documentElement.setAttribute('data-system-theme', mediaQuery.matches ? 'dark' : 'light')
      document.documentElement.setAttribute('data-environment-brightness', this.environmentBrightness.toString())
      
      this.updateAllAdaptiveElements()
    }

    mediaQuery.addEventListener('change', updateEnvironment)
    updateEnvironment()

    // 检测页面亮度变化
    this.startBrightnessDetection()
  }

  /**
   * 开始亮度检测
   */
  private startBrightnessDetection(): void {
    const detectBrightness = () => {
      // 简单的页面亮度检测算法
      const body = document.body
      const computedStyle = window.getComputedStyle(body)
      const backgroundColor = computedStyle.backgroundColor
      
      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        const rgb = this.parseRgb(backgroundColor)
        if (rgb) {
          const brightness = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255
          this.environmentBrightness = brightness
          
          // 更新文档根元素的环境亮度属性
          document.documentElement.setAttribute('data-environment-brightness', brightness.toString())
          
          this.updateAllAdaptiveElements()
        }
      }

      this.animationFrameId = requestAnimationFrame(detectBrightness)
    }

    detectBrightness()
  }

  /**
   * 更新所有自适应元素
   */
  private updateAllAdaptiveElements(): void {
    const adaptiveElements = document.querySelectorAll('[data-environment-adaptive="true"]')
    adaptiveElements.forEach(element => {
      const htmlElement = element as HTMLElement
      const themeName = htmlElement.getAttribute('data-liquid-glass-theme') || this.currentTheme
      const theme = this.themes.get(themeName)
      
      if (theme) {
        this.enableEnvironmentAdaptation(htmlElement, theme.config)
      }
    })
  }

  /**
   * 初始化全局样式 - 已废弃注入方式
   * 样式现在通过CSS文件静态加载
   */
  private initGlobalStyles(): void {
    // 样式已通过apple-design-system.css静态加载
    // 不再需要动态注入
  }

  /**
   * 工具方法
   */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  private parseRgb(rgb: string): { r: number; g: number; b: number } | null {
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      }
    }
    return null
  }

  /**
   * 公共API
   */

  /**
   * 设置主题
   */
  setTheme(themeName: string): void {
    if (this.themes.has(themeName)) {
      this.currentTheme = themeName
      
      // 更新文档根元素的主题属性
      document.documentElement.setAttribute('data-liquid-glass-theme', themeName)
      
      this.updateAllAdaptiveElements()
    }
  }

  /**
   * 获取当前主题
   */
  getCurrentTheme(): string {
    return this.currentTheme
  }

  /**
   * 获取所有主题
   */
  getAllThemes(): LiquidGlassTheme[] {
    return Array.from(this.themes.values())
  }

  /**
   * 添加自定义主题
   */
  addTheme(name: string, theme: LiquidGlassTheme): void {
    this.themes.set(name, theme)
  }

  /**
   * 移除Liquid Glass效果
   * 重构版本：通过移除CSS类和属性实现
   */
  removeLiquidGlass(element: HTMLElement): void {
    // 移除所有Liquid Glass相关的类
    element.classList.remove(
      'liquid-glass-element',
      'liquid-glass-adaptive',
      'liquid-glass-hover',
      'liquid-glass-active',
      'liquid-glass-environment-update'
    )
    
    // 移除主题类
    this.themes.forEach((_, themeName) => {
      element.classList.remove(`liquid-glass-theme-${themeName}`)
    })
    
    // 移除所有data属性
    const attributesToRemove = [
      'data-lg-opacity',
      'data-lg-blur',
      'data-lg-brightness',
      'data-lg-contrast',
      'data-lg-saturation',
      'data-lg-hue',
      'data-lg-border-radius',
      'data-lg-border-width',
      'data-lg-shadow-intensity',
      'data-lg-reflection-intensity',
      'data-lg-animation-duration',
      'data-lg-accent-color',
      'data-lg-adapted-opacity',
      'data-lg-adapted-blur',
      'data-lg-environment-brightness',
      'data-environment-adaptive',
      'data-liquid-glass-theme'
    ]
    
    attributesToRemove.forEach(attr => {
      element.removeAttribute(attr)
    })

    // 移除反射层
    const reflection = element.querySelector('.liquid-glass-reflection')
    if (reflection) {
      reflection.remove()
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
  }
}

// 创建全局实例
export const liquidGlass = LiquidGlassManager.getInstance()

// 便捷函数
export function applyLiquidGlass(
  element: HTMLElement, 
  config?: Partial<LiquidGlassConfig>,
  theme?: string
): void {
  liquidGlass.applyLiquidGlass(element, config, theme)
}

export function removeLiquidGlass(element: HTMLElement): void {
  liquidGlass.removeLiquidGlass(element)
}

export function setLiquidGlassTheme(theme: string): void {
  liquidGlass.setTheme(theme)
}