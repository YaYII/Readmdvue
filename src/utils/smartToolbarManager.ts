import { logger } from './index'

/**
 * 智能工具栏管理器
 * 负责工具栏的智能显示/隐藏逻辑
 */
export class SmartToolbarManager {
  private static instance: SmartToolbarManager
  private toolbar: HTMLElement | null = null
  private isVisible = false
  private isSettingsPanelOpen = false
  private hideTimer: NodeJS.Timeout | null = null
  private mouseTracker: { x: number; y: number } = { x: 0, y: 0 }
  
  // 配置参数
  private readonly TRIGGER_ZONE_HEIGHT = 60 // 触发区域高度
  private readonly HIDE_DELAY = 2000 // 隐藏延迟时间（毫秒）
  private readonly ANIMATION_DURATION = 300 // 动画持续时间

  static getInstance(): SmartToolbarManager {
    if (!SmartToolbarManager.instance) {
      SmartToolbarManager.instance = new SmartToolbarManager()
    }
    return SmartToolbarManager.instance
  }

  /**
   * 初始化智能工具栏
   */
  initialize(toolbarElement: HTMLElement): void {
    this.toolbar = toolbarElement
    this.setupEventListeners()
    this.applyInitialStyles()
    this.hide() // 初始状态隐藏
    
    logger.info('智能工具栏管理器初始化完成')
  }

  /**
   * 设置面板打开状态
   */
  setSettingsPanelOpen(isOpen: boolean): void {
    this.isSettingsPanelOpen = isOpen
    
    if (isOpen) {
      this.show()
      this.clearHideTimer()
    } else {
      this.scheduleHide()
    }
  }

  /**
   * 显示工具栏
   */
  private show(): void {
    if (!this.toolbar || this.isVisible) return

    this.isVisible = true
    this.toolbar.classList.add('visible')
    this.toolbar.style.transform = 'translateX(-50%) translateY(0)'
    this.toolbar.style.opacity = '1'
    
    this.clearHideTimer()
    logger.info('工具栏已显示')
  }

  /**
   * 隐藏工具栏
   */
  private hide(): void {
    if (!this.toolbar || !this.isVisible || this.isSettingsPanelOpen) return

    this.isVisible = false
    this.toolbar.classList.remove('visible')
    this.toolbar.style.transform = 'translateX(-50%) translateY(-100%)'
    this.toolbar.style.opacity = '0'
    
    logger.info('工具栏已隐藏')
  }

  /**
   * 计划隐藏工具栏
   */
  private scheduleHide(): void {
    if (this.isSettingsPanelOpen) return

    this.clearHideTimer()
    this.hideTimer = setTimeout(() => {
      this.hide()
    }, this.HIDE_DELAY)
  }

  /**
   * 清除隐藏定时器
   */
  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
  }

  /**
   * 检查鼠标是否在触发区域
   */
  private isInTriggerZone(y: number): boolean {
    return y <= this.TRIGGER_ZONE_HEIGHT
  }

  /**
   * 检查鼠标是否在工具栏区域
   */
  private isInToolbarZone(x: number, y: number): boolean {
    if (!this.toolbar) return false

    const rect = this.toolbar.getBoundingClientRect()
    return (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    )
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 鼠标移动监听
    document.addEventListener('mousemove', (e) => {
      this.mouseTracker.x = e.clientX
      this.mouseTracker.y = e.clientY

      if (this.isInTriggerZone(e.clientY)) {
        this.show()
      } else if (!this.isInToolbarZone(e.clientX, e.clientY) && !this.isSettingsPanelOpen) {
        this.scheduleHide()
      }
    })

    // 工具栏鼠标进入/离开
    if (this.toolbar) {
      this.toolbar.addEventListener('mouseenter', () => {
        this.clearHideTimer()
      })

      this.toolbar.addEventListener('mouseleave', () => {
        if (!this.isSettingsPanelOpen) {
          this.scheduleHide()
        }
      })
    }

    // 页面滚动时隐藏（可选）
    let scrollTimer: NodeJS.Timeout | null = null
    document.addEventListener('scroll', () => {
      if (this.isVisible && !this.isSettingsPanelOpen) {
        this.hide()
        
        // 滚动停止后重新检查鼠标位置
        if (scrollTimer) clearTimeout(scrollTimer)
        scrollTimer = setTimeout(() => {
          if (this.isInTriggerZone(this.mouseTracker.y)) {
            this.show()
          }
        }, 150)
      }
    })

    // 窗口失焦时隐藏
    window.addEventListener('blur', () => {
      if (!this.isSettingsPanelOpen) {
        this.hide()
      }
    })

    // 键盘快捷键支持（可选）
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + S 显示/隐藏工具栏
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        if (this.isVisible) {
          this.hide()
        } else {
          this.show()
        }
      }
    })
  }

  /**
   * 应用初始样式
   */
  private applyInitialStyles(): void {
    if (!this.toolbar) return

    // 添加基础样式
    Object.assign(this.toolbar.style, {
      position: 'fixed',
      top: '0',
      left: '50%',
      transform: 'translateX(-50%) translateY(-100%)',
      zIndex: '999999',
      transition: `all ${this.ANIMATION_DURATION}ms cubic-bezier(0.4, 0.0, 0.2, 1)`,
      opacity: '0',
      pointerEvents: 'auto'
    })

    // 添加CSS类
    this.toolbar.classList.add('smart-toolbar')

    // 注入必要的CSS
    this.injectStyles()
  }

  /**
   * 注入必要的CSS样式
   */
  private injectStyles(): void {
    const styleId = 'smart-toolbar-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .smart-toolbar {
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        box-shadow: 
          0 8px 32px rgba(0, 0, 0, 0.1),
          0 2px 8px rgba(0, 0, 0, 0.05),
          inset 0 1px 0 rgba(255, 255, 255, 0.5);
        padding: 8px;
        user-select: none;
        -webkit-user-select: none;
      }

      .smart-toolbar.visible {
        pointer-events: auto;
      }

      .smart-toolbar:not(.visible) {
        pointer-events: none;
      }

      /* 深色模式适配 */
      @media (prefers-color-scheme: dark) {
        .smart-toolbar {
          background: rgba(28, 28, 30, 0.8);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            0 2px 8px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
      }

      /* 工具栏按钮样式优化 */
      .smart-toolbar .toolbar-btn {
        position: relative;
        padding: 8px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--md-accent-color, #007AFF);
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 2px;
      }

      .smart-toolbar .toolbar-btn:hover {
        background: rgba(var(--md-accent-rgb, 0, 122, 255), 0.1);
        transform: scale(1.05);
      }

      .smart-toolbar .toolbar-btn:active {
        transform: scale(0.95);
      }

      /* 触发区域指示器（开发模式） */
      .smart-toolbar-debug::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: ${this.TRIGGER_ZONE_HEIGHT}px;
        background: rgba(0, 122, 255, 0.1);
        border-bottom: 2px dashed rgba(0, 122, 255, 0.3);
        pointer-events: none;
        z-index: 999998;
      }
    `

    document.head.appendChild(style)
  }

  /**
   * 启用调试模式（显示触发区域）
   */
  enableDebugMode(): void {
    document.body.classList.add('smart-toolbar-debug')
  }

  /**
   * 禁用调试模式
   */
  disableDebugMode(): void {
    document.body.classList.remove('smart-toolbar-debug')
  }

  /**
   * 销毁工具栏管理器
   */
  destroy(): void {
    this.clearHideTimer()
    
    if (this.toolbar) {
      this.toolbar.remove()
      this.toolbar = null
    }

    // 移除样式
    const style = document.getElementById('smart-toolbar-styles')
    if (style) {
      style.remove()
    }

    this.isVisible = false
    this.isSettingsPanelOpen = false
  }
}

// 导出单例实例
export const smartToolbarManager = SmartToolbarManager.getInstance()