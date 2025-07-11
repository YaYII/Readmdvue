/**
 * Liquid Glass 材质系统
 * 基于苹果2025年最新设计语言，实现半透明材质效果
 * 支持动态环境适应和实时渲染
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
    this.injectGlobalStyles()
  }

  /**
   * 应用Liquid Glass效果到元素
   */
  applyLiquidGlass(
    element: HTMLElement, 
    customConfig?: Partial<LiquidGlassConfig>,
    themeName?: string
  ): void {
    const theme = this.themes.get(themeName || this.currentTheme)!
    const config = { ...theme.config, ...customConfig }
    
    // 设置基础样式
    this.setElementStyles(element, config, theme.accentColor)
    
    // 添加动态效果
    this.addDynamicEffects(element, config)
    
    // 环境适应
    if (config.environmentAdaptive) {
      this.enableEnvironmentAdaptation(element, config)
    }
  }

  /**
   * 设置元素样式
   */
  private setElementStyles(
    element: HTMLElement, 
    config: LiquidGlassConfig, 
    accentColor: string
  ): void {
    const styles = {
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: `blur(${config.blur}px) brightness(${config.brightness}) contrast(${config.contrast}) saturate(${config.saturation}) hue-rotate(${config.hue}deg)`,
      WebkitBackdropFilter: `blur(${config.blur}px) brightness(${config.brightness}) contrast(${config.contrast}) saturate(${config.saturation}) hue-rotate(${config.hue}deg)`,
      background: `rgba(255, 255, 255, ${config.opacity})`,
      borderRadius: `${config.borderRadius}px`,
      border: `${config.borderWidth}px solid rgba(255, 255, 255, 0.3)`,
      boxShadow: `
        0 8px 32px rgba(0, 0, 0, ${config.shadowIntensity}),
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        inset 0 -1px 0 rgba(255, 255, 255, 0.2)
      `,
      transition: `all ${config.animationDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
      zIndex: '1'
    }

    Object.assign(element.style, styles)
    
    // 添加伪元素用于反射效果
    this.addReflectionEffect(element, config, accentColor)
  }

  /**
   * 添加反射效果
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
    
    const reflectionStyles = {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: `linear-gradient(135deg, 
        rgba(255, 255, 255, ${config.reflectionIntensity}) 0%, 
        transparent 30%, 
        transparent 70%, 
        ${this.hexToRgba(accentColor, config.reflectionIntensity! * 0.5)} 100%
      )`,
      borderRadius: `${config.borderRadius}px`,
      pointerEvents: 'none',
      zIndex: '2'
    }

    Object.assign(reflection.style, reflectionStyles)
    element.appendChild(reflection)
  }

  /**
   * 添加动态效果
   */
  private addDynamicEffects(element: HTMLElement, config: LiquidGlassConfig): void {
    // 鼠标悬停效果
    element.addEventListener('mouseenter', () => {
      element.style.transform = 'translateY(-2px) scale(1.02)'
      element.style.boxShadow = `
        0 12px 48px rgba(0, 0, 0, ${config.shadowIntensity! * 1.5}),
        inset 0 1px 0 rgba(255, 255, 255, 0.6),
        inset 0 -1px 0 rgba(255, 255, 255, 0.3)
      `
    })

    element.addEventListener('mouseleave', () => {
      element.style.transform = 'translateY(0) scale(1)'
      element.style.boxShadow = `
        0 8px 32px rgba(0, 0, 0, ${config.shadowIntensity}),
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        inset 0 -1px 0 rgba(255, 255, 255, 0.2)
      `
    })

    // 点击效果
    element.addEventListener('mousedown', () => {
      element.style.transform = 'translateY(1px) scale(0.98)'
    })

    element.addEventListener('mouseup', () => {
      element.style.transform = 'translateY(-2px) scale(1.02)'
    })
  }

  /**
   * 启用环境适应
   */
  private enableEnvironmentAdaptation(element: HTMLElement, config: LiquidGlassConfig): void {
    const updateEnvironmentEffect = () => {
      const brightness = this.environmentBrightness
      const adaptedOpacity = config.opacity! * (0.7 + brightness * 0.3)
      const adaptedBlur = config.blur! * (0.8 + brightness * 0.4)
      
      element.style.background = `rgba(255, 255, 255, ${adaptedOpacity})`
      element.style.backdropFilter = `blur(${adaptedBlur}px) brightness(${config.brightness}) contrast(${config.contrast}) saturate(${config.saturation}) hue-rotate(${config.hue}deg)`
      ;(element.style as any).WebkitBackdropFilter = element.style.backdropFilter
    }

    // 初始应用
    updateEnvironmentEffect()

    // 监听环境变化
    element.setAttribute('data-environment-adaptive', 'true')
  }

  /**
   * 初始化环境检测
   */
  private initEnvironmentDetection(): void {
    // 检测系统主题
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const updateEnvironment = () => {
      this.environmentBrightness = mediaQuery.matches ? 0.3 : 0.7
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
   * 注入全局样式
   */
  private injectGlobalStyles(): void {
    const styleId = 'liquid-glass-global-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .liquid-glass {
        position: relative;
        overflow: hidden;
      }

      .liquid-glass::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: inherit;
        filter: blur(20px);
        z-index: -1;
      }

      .liquid-glass-container {
        position: relative;
        isolation: isolate;
      }

      .liquid-glass-content {
        position: relative;
        z-index: 3;
      }

      /* 动画关键帧 */
      @keyframes liquidGlassShimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .liquid-glass-shimmer {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.4) 50%,
          transparent 100%
        );
        animation: liquidGlassShimmer 2s infinite;
        pointer-events: none;
      }

      /* 响应式适配 */
      @media (max-width: 768px) {
        .liquid-glass {
          backdrop-filter: blur(15px) !important;
          -webkit-backdrop-filter: blur(15px) !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .liquid-glass {
          transition: none !important;
        }
        
        .liquid-glass-shimmer {
          animation: none !important;
        }
      }
    `

    document.head.appendChild(style)
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
   */
  removeLiquidGlass(element: HTMLElement): void {
    // 重置样式
    element.style.backdropFilter = ''
    ;(element.style as any).WebkitBackdropFilter = ''
    element.style.background = ''
    element.style.borderRadius = ''
    element.style.border = ''
    element.style.boxShadow = ''
    element.style.transition = ''

    // 移除反射层
    const reflection = element.querySelector('.liquid-glass-reflection')
    if (reflection) {
      reflection.remove()
    }

    // 移除属性
    element.removeAttribute('data-environment-adaptive')
    element.removeAttribute('data-liquid-glass-theme')
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