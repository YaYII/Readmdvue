import { createApp, type App } from 'vue'
import { createPinia } from 'pinia'
import SettingsPanel from '../components/SettingsPanel.vue'
import ExportDialog from '../components/ExportDialog.vue'
import PerformanceMonitor from '../components/PerformanceMonitor.vue'
import TableOfContents from '../components/TableOfContents.vue'
import type { MarkdownConfig } from '../types'
import type { TocItem } from '../utils/markdownRenderer'

/**
 * Vue组件管理器
 * 负责在content script中管理Vue组件的生命周期
 */
class VueComponentManager {
  private apps: Map<string, App> = new Map()
  private containers: Map<string, HTMLElement> = new Map()

  /**
   * 显示设置面板
   */
  showSettingsPanel(
    config: MarkdownConfig, 
    onUpdate: (config: Partial<MarkdownConfig>) => void,
    onClose?: () => void
  ): void {
    console.log('显示设置面板，当前配置:', config)
    this.createComponent('settings', SettingsPanel, {
      config,
      onClose: () => {
        console.log('设置面板关闭')
        this.hideComponent('settings')
        // 调用外部关闭回调
        if (onClose) {
          onClose()
        }
      },
      onUpdate: (updates: Partial<MarkdownConfig>) => {
        console.log('设置面板配置更新:', updates)
        onUpdate(updates)
      }
    })
  }

  /**
   * 显示导出对话框
   */
  showExportDialog(
    content: string,
    config: MarkdownConfig,
    onExport: (format: string, options: any) => void
  ): void {
    this.createComponent('export', ExportDialog, {
      content,
      config,
      onClose: () => this.hideComponent('export'),
      onExport
    })
  }



  /**
   * 显示性能监控
   */
  showPerformanceMonitor(metrics: any): void {
    this.createComponent('performance', PerformanceMonitor, {
      metrics,
      onClose: () => this.hideComponent('performance')
    })
  }

  /**
   * 创建目录组件
   */
  createTableOfContents(tocItems: TocItem[]): void {
    // 如果目录组件已存在，先销毁
    if (this.apps.has('toc')) {
      this.hideTableOfContents()
    }

    // 创建容器，直接添加到body
    const container = document.createElement('div')
    container.id = 'vue-table-of-contents'
    container.className = 'vue-toc-container'
    document.body.appendChild(container)

    // 创建Vue应用，传递必要的回调函数
    const app = createApp(TableOfContents, {
      tocItems,
      // 传递工具栏按钮的回调函数
      onSettingsClick: () => {
        // 触发设置面板显示事件
        window.dispatchEvent(new CustomEvent('showSettingsPanel'))
      },
      onExportClick: () => {
        // 触发导出对话框显示事件
        window.dispatchEvent(new CustomEvent('showExportDialog'))
      },
      onToggleOriginal: () => {
        // 触发切换原始内容事件
        window.dispatchEvent(new CustomEvent('toggleOriginalContent'))
      }
    })
    app.use(createPinia())

    // 挂载应用
    app.mount(container)

    // 保存引用
    this.apps.set('toc', app)
    this.containers.set('toc', container)
  }

  /**
   * 隐藏目录组件
   */
  hideTableOfContents(): void {
    const app = this.apps.get('toc')
    const container = this.containers.get('toc')

    if (app) {
      app.unmount()
      this.apps.delete('toc')
    }

    if (container) {
      container.remove()
      this.containers.delete('toc')
    }
  }

  /**
   * 创建Vue组件
   */
  private createComponent(id: string, component: any, props: any): void {
    // 如果组件已存在，先销毁
    if (this.apps.has(id)) {
      this.hideComponent(id)
    }

    // 创建容器
    const container = document.createElement('div')
    container.id = `vue-component-${id}`
    container.className = 'vue-component-container'
    document.body.appendChild(container)

    // 创建Vue应用
    const app = createApp(component, props)
    app.use(createPinia())

    // 挂载应用
    app.mount(container)

    // 保存引用
    this.apps.set(id, app)
    this.containers.set(id, container)

    // 添加遮罩层
    this.createOverlay(id)
  }

  /**
   * 隐藏组件
   */
  private hideComponent(id: string): void {
    const app = this.apps.get(id)
    const container = this.containers.get(id)

    if (app) {
      app.unmount()
      this.apps.delete(id)
    }

    if (container) {
      container.remove()
      this.containers.delete(id)
    }

    // 移除遮罩层
    this.removeOverlay(id)
  }

  /**
   * 创建遮罩层
   */
  private createOverlay(id: string): void {
    const overlay = document.createElement('div')
    overlay.id = `vue-overlay-${id}`
    overlay.className = 'vue-component-overlay'
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      z-index: 999;
      animation: fadeIn 0.3s ease-out;
    `

    // 点击遮罩层关闭组件
    overlay.addEventListener('click', (e) => {
      // 确保点击的是遮罩层本身，而不是其子元素
      if (e.target === overlay) {
        // 触发组件的关闭逻辑，而不是直接隐藏
        const container = this.containers.get(id)
        if (container) {
          // 查找组件内的关闭按钮并触发点击
          const closeBtn = container.querySelector('[data-close-btn]') as HTMLElement
          if (closeBtn) {
            closeBtn.click()
          } else {
            // 如果没有找到关闭按钮，直接隐藏
            this.hideComponent(id)
          }
        }
      }
    })

    document.body.appendChild(overlay)
  }

  /**
   * 移除遮罩层
   */
  private removeOverlay(id: string): void {
    const overlay = document.getElementById(`vue-overlay-${id}`)
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.3s ease-out'
      setTimeout(() => overlay.remove(), 300)
    }
  }

  /**
   * 销毁所有组件
   */
  destroy(): void {
    for (const id of this.apps.keys()) {
      this.hideComponent(id)
    }
  }
}

// 创建全局实例
export const vueComponentManager = new VueComponentManager()

// 添加CSS动画
const style = document.createElement('style')
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  
  .vue-component-container {
    position: relative;
    z-index: 1000;
  }
  
  .vue-component-overlay {
    pointer-events: auto;
  }
`
document.head.appendChild(style)