/**
 * 苹果风格通知系统
 * 基于苹果设计语言，提供优雅的通知体验
 */

export interface NotificationOptions {
  title: string
  message?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
  persistent?: boolean
  actions?: NotificationAction[]
  icon?: string
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center'
  showProgress?: boolean
  liquidGlass?: boolean
}

export interface NotificationAction {
  label: string
  action: () => void
  style?: 'primary' | 'secondary' | 'destructive'
}

export interface NotificationInstance {
  id: string
  element: HTMLElement
  options: NotificationOptions
  close: () => void
  update: (options: Partial<NotificationOptions>) => void
}

/**
 * 通知管理器
 */
export class AppleNotificationManager {
  private static instance: AppleNotificationManager
  private notifications = new Map<string, NotificationInstance>()
  private container: HTMLElement | null = null
  private nextId = 1

  static getInstance(): AppleNotificationManager {
    if (!AppleNotificationManager.instance) {
      AppleNotificationManager.instance = new AppleNotificationManager()
    }
    return AppleNotificationManager.instance
  }

  constructor() {
    this.initContainer()
    this.injectStyles()
  }

  /**
   * 显示通知
   */
  show(options: NotificationOptions): NotificationInstance {
    const id = `notification-${this.nextId++}`
    const element = this.createNotificationElement(id, options)
    
    const instance: NotificationInstance = {
      id,
      element,
      options,
      close: () => this.close(id),
      update: (updateOptions) => this.update(id, updateOptions)
    }

    this.notifications.set(id, instance)
    this.container!.appendChild(element)

    // 触发入场动画
    requestAnimationFrame(() => {
      element.classList.add('notification-show')
    })

    // 自动关闭
    if (!options.persistent && options.duration !== 0) {
      const duration = options.duration || this.getDefaultDuration(options.type)
      setTimeout(() => {
        this.close(id)
      }, duration)
    }

    return instance
  }

  /**
   * 关闭通知
   */
  close(id: string): void {
    const instance = this.notifications.get(id)
    if (!instance) return

    instance.element.classList.add('notification-hide')
    
    setTimeout(() => {
      if (instance.element.parentNode) {
        instance.element.parentNode.removeChild(instance.element)
      }
      this.notifications.delete(id)
    }, 300)
  }

  /**
   * 更新通知
   */
  update(id: string, options: Partial<NotificationOptions>): void {
    const instance = this.notifications.get(id)
    if (!instance) return

    Object.assign(instance.options, options)
    
    // 更新内容
    const titleElement = instance.element.querySelector('.notification-title')
    const messageElement = instance.element.querySelector('.notification-message')
    const iconElement = instance.element.querySelector('.notification-icon')

    if (titleElement && options.title) {
      titleElement.textContent = options.title
    }
    
    if (messageElement && options.message) {
      messageElement.textContent = options.message
    }

    if (iconElement && options.icon) {
      iconElement.textContent = options.icon
    }

    // 更新类型样式
    if (options.type) {
      instance.element.className = instance.element.className.replace(
        /notification-\w+/g, 
        `notification-${options.type}`
      )
    }
  }

  /**
   * 关闭所有通知
   */
  closeAll(): void {
    Array.from(this.notifications.keys()).forEach(id => {
      this.close(id)
    })
  }

  /**
   * 创建通知元素
   */
  private createNotificationElement(id: string, options: NotificationOptions): HTMLElement {
    const element = document.createElement('div')
    element.id = id
    element.className = `apple-notification notification-${options.type || 'info'} ${options.liquidGlass ? 'liquid-glass' : ''}`
    
    const icon = this.getTypeIcon(options.type) || options.icon || ''
    
    element.innerHTML = `
      <div class="notification-content">
        ${icon ? `<div class="notification-icon">${icon}</div>` : ''}
        <div class="notification-text">
          <div class="notification-title">${options.title}</div>
          ${options.message ? `<div class="notification-message">${options.message}</div>` : ''}
        </div>
        <button class="notification-close" aria-label="关闭通知">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      ${options.actions && options.actions.length > 0 ? this.createActionsHTML(options.actions) : ''}
      ${options.showProgress ? '<div class="notification-progress"><div class="progress-bar"></div></div>' : ''}
    `

    // 绑定事件
    this.bindEvents(element, id, options)

    return element
  }

  /**
   * 创建操作按钮HTML
   */
  private createActionsHTML(actions: NotificationAction[]): string {
    return `
      <div class="notification-actions">
        ${actions.map((action, index) => `
          <button class="notification-action notification-action-${action.style || 'secondary'}" data-action-index="${index}">
            ${action.label}
          </button>
        `).join('')}
      </div>
    `
  }

  /**
   * 绑定事件
   */
  private bindEvents(element: HTMLElement, id: string, options: NotificationOptions): void {
    // 关闭按钮
    const closeButton = element.querySelector('.notification-close')
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.close(id)
      })
    }

    // 操作按钮
    if (options.actions) {
      const actionButtons = element.querySelectorAll('.notification-action')
      actionButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
          options.actions![index].action()
          if (!options.persistent) {
            this.close(id)
          }
        })
      })
    }

    // 点击通知体关闭（可选）
    element.addEventListener('click', (e) => {
      if (e.target === element || e.target === element.querySelector('.notification-content')) {
        if (!options.persistent && !options.actions) {
          this.close(id)
        }
      }
    })

    // 进度条动画
    if (options.showProgress && !options.persistent) {
      const progressBar = element.querySelector('.progress-bar') as HTMLElement
      if (progressBar) {
        const duration = options.duration || this.getDefaultDuration(options.type)
        progressBar.style.animationDuration = `${duration}ms`
        progressBar.classList.add('progress-animate')
      }
    }
  }

  /**
   * 初始化容器
   */
  private initContainer(): void {
    this.container = document.getElementById('apple-notifications-container')
    
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.id = 'apple-notifications-container'
      this.container.className = 'apple-notifications-container'
      document.body.appendChild(this.container)
    }
  }

  /**
   * 初始化样式 - 已废弃注入方式
   * 样式现在通过CSS文件静态加载
   */
  private initStyles(): void {
    // 样式已通过enhanced-components.css静态加载
    // 不再需要动态注入
  }

  /**
   * 获取类型图标
   */
  private getTypeIcon(type?: string): string {
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    }
    return icons[type as keyof typeof icons] || ''
  }

  /**
   * 获取默认持续时间
   */
  private getDefaultDuration(type?: string): number {
    const durations = {
      success: 3000,
      warning: 5000,
      error: 7000,
      info: 4000
    }
    return durations[type as keyof typeof durations] || 4000
  }
}

// 创建全局实例
export const appleNotification = AppleNotificationManager.getInstance()

// 便捷方法
export function showNotification(options: NotificationOptions): NotificationInstance {
  return appleNotification.show(options)
}

export function showSuccess(title: string, message?: string, options?: Partial<NotificationOptions>): NotificationInstance {
  return appleNotification.show({
    title,
    message,
    type: 'success',
    ...options
  })
}

export function showError(title: string, message?: string, options?: Partial<NotificationOptions>): NotificationInstance {
  return appleNotification.show({
    title,
    message,
    type: 'error',
    ...options
  })
}

export function showWarning(title: string, message?: string, options?: Partial<NotificationOptions>): NotificationInstance {
  return appleNotification.show({
    title,
    message,
    type: 'warning',
    ...options
  })
}

export function showInfo(title: string, message?: string, options?: Partial<NotificationOptions>): NotificationInstance {
  return appleNotification.show({
    title,
    message,
    type: 'info',
    ...options
  })
}