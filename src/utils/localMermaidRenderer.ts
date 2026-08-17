// 使用 UMD 全量包（mermaid/dist/mermaid.min.js）：所有 diagram 静态包含，无懒加载动态 import——
// content script 的 import() 在 file:// 页面会按页面 URL 解析（file:///assets/... CORS 拦截），
// 全量包从根本上消除该问题（体积换取 file:// 场景 100% 可靠性）
import mermaid from 'mermaid/dist/mermaid.min.js'
import { showSuccess } from './appleNotification'

/**
 * 本地 Mermaid 渲染器
 * 使用本地 mermaid 库进行渲染，支持中文和复杂语法
 */
export class LocalMermaidRenderer {
  private static instance: LocalMermaidRenderer
  private initialized = false
  /** 当前生效的 mermaid 主题（跟随页面主题切换） */
  private currentTheme = 'default'

  private constructor() {
    this.initializeMermaid()
  }

  static getInstance(): LocalMermaidRenderer {
    if (!LocalMermaidRenderer.instance) {
      LocalMermaidRenderer.instance = new LocalMermaidRenderer()
    }
    return LocalMermaidRenderer.instance
  }

  /**
   * 获取当前主题对应的 mermaid 主题（跟随页面主题：浅色→default，深色→dark）
   */
  private getTheme(): 'dark' | 'default' {
    const rootTheme = document.documentElement.getAttribute('data-theme')
    const systemTheme = document.documentElement.getAttribute('data-system-theme')
    const isDark = rootTheme === 'dark' || (rootTheme === 'auto' && systemTheme === 'dark')
    return isDark ? 'dark' : 'default'
  }

  /**
   * 初始化 Mermaid（主题跟随页面当前主题）
   */
  private initializeMermaid(): void {
    try {
      mermaid.initialize({
        startOnLoad: false,
        // 跟随页面主题：浅色主题用 default（浅色线条），深色主题用 dark（浅色线条适配深底）
        theme: this.currentTheme,
        securityLevel: 'loose',
        fontFamily: 'PingFang SC, Microsoft YaHei UI, SF Pro Display, Segoe UI Variable, sans-serif',
        fontSize: 14,
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        },
        sequence: {
          useMaxWidth: true,
          wrap: true
        },
        gantt: {
          useMaxWidth: true
        },
        journey: {
          useMaxWidth: true
        },
        gitGraph: {
          useMaxWidth: true
        }
      })

      this.initialized = true
    } catch (error) {
      throw new Error('Mermaid 初始化失败')
    }
  }

  /**
   * 按当前页面主题应用 mermaid 主题（主题切换后重新配置）
   */
  private applyTheme(): void {
    const theme = this.getTheme()
    if (theme !== this.currentTheme || !this.initialized) {
      this.currentTheme = theme
      this.initializeMermaid()
    }
  }

  /**
   * 渲染 Mermaid 图表
   */
  async renderMermaid(content: string, containerId: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now()

    try {
      // 应用主题（跟随页面主题，首次或主题变化时初始化/重新配置）
      this.applyTheme()

      // 获取容器元素
      const container = document.getElementById(containerId)
      if (!container) {
        throw new Error(`找不到容器元素: ${containerId}`)
      }

      console.log('开始本地 Mermaid 渲染:', content.substring(0, 50) + '...')

      // 清理内容
      let cleanContent = content.trim()

      // 强制图表主题跟随页面主题：覆盖图表内 %%{init: {"theme": ...}}%% 的显式主题指令，
      // 避免个别图表使用 light 主题（浅底节点）与页面深色主题混搭显得突兀
      const forcedTheme = this.currentTheme
      cleanContent = cleanContent.replace(
        /%%\{init:\s*\{([\s\S]*?)\}\}%%/g,
        (match, inner: string) => {
          if (/theme\s*:/.test(inner)) {
            // 已有 theme 字段 → 替换为当前主题
            return match.replace(/theme\s*:\s*["']?[^"',}\s]+["']?/, `theme: "${forcedTheme}"`)
          }
          // 无 theme 字段 → 在 init 对象开头插入当前主题
          return match.replace(/%%\{init:\s*\{/, `%%{init: {"theme": "${forcedTheme}", `)
        }
      )
      
      // 验证 Mermaid 语法
      if (!this.validateMermaidSyntax(cleanContent)) {
        throw new Error('Mermaid 语法验证失败')
      }

      // 生成唯一的图表 ID
      const chartId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // 使用 mermaid.render 方法渲染
      const { svg } = await mermaid.render(chartId, cleanContent)

      // 显示渲染结果
      this.displayMermaidResult(container, svg)

      const renderTime = Date.now() - startTime

      // 显示成功通知
      showSuccess(
        '图表渲染完成',
        `Mermaid 图表已成功渲染 (${renderTime.toFixed(0)}ms)`,
        { 
          duration: 2000,
          liquidGlass: true
        }
      )

      console.log(`✅ Mermaid 图表渲染成功（来源：本地离线渲染，${renderTime}ms）`)

      return { success: true }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      
      // 本地失败只是「回退 Kroki」的中间状态，不是最终失败 —— 用 warn 而不是 error，避免误导
      console.warn('本地 Mermaid 渲染失败（将回退 Kroki 在线渲染）:', error)
      
      // 显示错误信息
      const container = document.getElementById(containerId)
      if (container) {
        this.showMermaidError(container, errorMessage)
      }

      return { 
        success: false, 
        error: errorMessage 
      }
    }
  }

  /**
   * 验证 Mermaid 语法
   */
  private validateMermaidSyntax(content: string): boolean {
    try {
      // 基本语法检查
      const trimmedContent = content.trim()
      
      // 检查是否为空
      if (!trimmedContent) {
        return false
      }

      // 检查是否包含基本的 Mermaid 关键词
      const mermaidKeywords = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
        'stateDiagram', 'journey', 'gantt', 'pie', 'gitgraph',
        'erDiagram', 'mindmap', 'timeline'
      ]

      const hasValidKeyword = mermaidKeywords.some(keyword => 
        trimmedContent.toLowerCase().includes(keyword.toLowerCase())
      )

      if (!hasValidKeyword) {
        console.warn('Mermaid 内容缺少有效关键词')
        return false
      }

      return true
    } catch (error) {
      console.error('Mermaid 语法验证失败:', error)
      return false
    }
  }

  /**
   * 显示 Mermaid 渲染结果
   */
  private displayMermaidResult(container: HTMLElement, svg: string): void {
    // 隐藏加载状态
    const loading = container.querySelector('.chart-loading')
    if (loading) loading.remove()

    // 显示图表
    let contentElement = container.querySelector('.chart-content') as HTMLElement
    if (!contentElement) {
      contentElement = document.createElement('div')
      contentElement.className = 'chart-content'
      container.appendChild(contentElement)
    }

    // 保留data-content属性
    const dataContent = contentElement.getAttribute('data-content')
    
    // 设置 SVG 内容
    contentElement.innerHTML = `
      <div class="mermaid-chart-wrapper" style="
        width: 100%;
        max-width: 100%; 
        overflow-x: auto; 
        border-radius: 0;
        /* 背景跟随主题主背景色（深色主题 = 纯黑 #000） */
        background: var(--md-bg-primary);
        padding: 16px;
      ">
        ${svg}
      </div>
    `
    
    // 恢复data-content属性
    if (dataContent) {
      contentElement.setAttribute('data-content', dataContent)
    }

    // 隐藏错误信息
    const errorElement = container.querySelector('.chart-error')
    if (errorElement) {
      (errorElement as HTMLElement).style.display = 'none'
    }

    // 应用样式优化
    this.optimizeMermaidSvg(contentElement)
  }

  /**
   * 优化 Mermaid SVG 样式
   */
  private optimizeMermaidSvg(container: HTMLElement): void {
    const svg = container.querySelector('svg')
    if (!svg) return

    // 1:1 原始尺寸显示（不压缩）：mermaid 节点文字在 foreignObject 内，
    // 不随 SVG 等比缩放——压缩会导致文字溢出被节点/边界遮挡（放大后正常）。
    // 按 viewBox 尺寸显示 + 容器横向滚动，保证文字始终完整可读。
    const vb = svg.getAttribute('viewBox')
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number)
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        svg.style.width = `${parts[2]}px`
        svg.style.height = `${parts[3]}px`
      }
    }
    svg.style.maxWidth = 'none'
    svg.style.flexShrink = '0'
    
    // 优化字体
    const textElements = svg.querySelectorAll('text')
    textElements.forEach(text => {
      text.style.fontFamily = 'PingFang SC, Microsoft YaHei UI, SF Pro Display, Segoe UI Variable, sans-serif'
      // 重置行距：页面 CSS（用户设置大行距）会污染 SVG 多行 text，导致行距过大溢出
      text.style.lineHeight = 'normal'
    })

    // 提取 mermaid 图表自身的文字颜色（SVG 内 style 的 .label color 规则），
    // 用于 foreignObject 内文字——避免继承页面正文色（深色主题=白色）显得突兀
    let labelColor: string | null = null
    const styleEl = svg.querySelector('style')
    if (styleEl) {
      const cssText = styleEl.textContent || ''
      const m = cssText.match(/\.label[^{]*\{[^}]*color:\s*([^;]+)/i)
      if (m) labelColor = m[1].trim()
    }
    if (!labelColor) {
      // fallback：采样 SVG 内普通 text 元素的计算色（mermaid 主题文字色）
      const sample = svg.querySelector('text')
      if (sample) {
        const c = getComputedStyle(sample).color
        if (c && c !== 'rgba(0, 0, 0, 0)') labelColor = c
      }
    }

    // 隔离 foreignObject 内 HTML 文字：防止被页面 CSS（行距/字距/字族/颜色）污染，
    // 行距过大会使文字超出节点文本框被隐藏半截；颜色用 mermaid 主题色（不突兀）
    svg.querySelectorAll('foreignObject').forEach((fo) => {
      const htmlEls = fo.querySelectorAll('div, span, p')
      htmlEls.forEach((el) => {
        const s = (el as HTMLElement).style
        s.lineHeight = 'normal'
        s.letterSpacing = 'normal'
        s.wordSpacing = 'normal'
        s.fontFamily = 'PingFang SC, Microsoft YaHei UI, SF Pro Display, Segoe UI Variable, sans-serif'
        if (labelColor) s.color = labelColor
      })
    })

    // 深色页面：统一所有节点为深底白字（覆盖图表内显式指定的浅色节点样式，
    // 避免浅蓝底 #e8f0fe 等与深色页面混搭突兀）；浅色页面：按节点背景对比色
    const pageTheme = document.documentElement.getAttribute('data-theme')
    const isDarkPage = pageTheme === 'dark' ||
      (pageTheme === 'auto' && document.documentElement.getAttribute('data-system-theme') === 'dark')
    svg.querySelectorAll('g.node').forEach((node) => {
      const rect = node.querySelector('rect')
      const fo = node.querySelector('foreignObject')
      if (!rect || !fo) return
      if (isDarkPage) {
        // 深色页面：节点统一深底；文字用页面文字色（--md-text-primary）——
        // 默认白色，用户自定义文字色时才引用用户色（不强制强调色）
        rect.style.fill = '#1f2020'
        const textColor = this.getPageTextColor() || '#ffffff'
        fo.querySelectorAll('div, span, p').forEach((el) => {
          ;(el as HTMLElement).style.color = textColor
        })
      } else {
        // 浅色页面：按节点背景对比度决定文字颜色
        let bg = rect.getAttribute('fill') || rect.style.fill || ''
        if (!bg || bg === 'none') {
          try {
            bg = getComputedStyle(rect).fill
          } catch {
            bg = ''
          }
        }
        if (bg && bg !== 'none') {
          const textColor = this.isDarkColor(bg) ? '#ffffff' : '#1f2937'
          fo.querySelectorAll('div, span, p').forEach((el) => {
            ;(el as HTMLElement).style.color = textColor
          })
        }
      }
    })
  }

  /** 获取页面文字色（深色模式默认白色；用户自定义文字色时返回用户色） */
  private getPageTextColor(): string | null {
    try {
      const cs = getComputedStyle(document.documentElement)
      const text = cs.getPropertyValue('--md-text-primary').trim()
      if (text && text !== 'var(--apple-label)') return text
      const label = cs.getPropertyValue('--apple-label').trim()
      if (label) return label
      return null
    } catch {
      return null
    }
  }

  /** 判断颜色是否为深色（感知亮度 < 0.5），用于决定文字取白/深 */
  private isDarkColor(color: string): boolean {
    let r = 0
    let g = 0
    let b = 0
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16)
        g = parseInt(hex[1] + hex[1], 16)
        b = parseInt(hex[2] + hex[2], 16)
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16)
        g = parseInt(hex.slice(2, 4), 16)
        b = parseInt(hex.slice(4, 6), 16)
      }
    } else if (color.startsWith('rgb')) {
      const m = color.match(/rgba?\(([^)]+)\)/)
      if (m) {
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()))
        r = parts[0] || 0
        g = parts[1] || 0
        b = parts[2] || 0
      }
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance < 0.5
  }

  /**
   * 显示 Mermaid 错误信息
   */
  private showMermaidError(container: HTMLElement, message: string): void {
    // 隐藏加载状态
    const loading = container.querySelector('.chart-loading')
    if (loading) loading.remove()

    // 显示错误信息
    let errorElement = container.querySelector('.chart-error') as HTMLElement
    if (!errorElement) {
      errorElement = document.createElement('div')
      errorElement.className = 'chart-error'
      container.appendChild(errorElement)
    }

    errorElement.innerHTML = `
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Mermaid 图表渲染失败</div>
        <div class="error-message">${message}</div>
        <div class="error-actions">
          <button class="retry-button" onclick="retryChart('${container.id}', 'mermaid', \`${this.getContentFromContainer(container)}\`)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.65 2.35A8 8 0 1 0 16 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M16 4V8H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            重试
          </button>
        </div>
      </div>
    `
    errorElement.style.display = 'block'
  }

  /**
   * 从容器中获取图表内容
   */
  private getContentFromContainer(container: HTMLElement): string {
    const contentElement = container.querySelector('.chart-content')
    if (contentElement) {
      const dataContent = contentElement.getAttribute('data-content')
      if (dataContent) {
        return decodeURIComponent(dataContent).replace(/`/g, '\\`')
      }
      return (contentElement.textContent || '').replace(/`/g, '\\`')
    }
    return ''
  }
}

// 导出单例实例
export const localMermaidRenderer = LocalMermaidRenderer.getInstance()
