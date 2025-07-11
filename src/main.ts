/**
 * Markdown Reader Vue - 主应用入口
 * 初始化Vue应用和全局配置
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import { usePluginStore } from './stores/plugin'
import { logger, errorHandler } from './utils'

// CSS样式通过HTML文件直接引用，避免Vite转换为JS注入

// 创建路由实例（为了支持可能的多页面扩展）
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('./popup/App.vue')
    }
  ]
})

// 创建Pinia实例
const pinia = createPinia()

// 创建Vue应用实例
const app = createApp(App)

// 注册插件
app.use(pinia)
app.use(router)

// 全局属性注入
if (typeof chrome !== 'undefined') {
  app.config.globalProperties.$chrome = chrome
}
app.config.globalProperties.$logger = logger
app.config.globalProperties.$errorHandler = errorHandler

// 全局错误处理
app.config.errorHandler = (err: any, instance: any, info: string) => {
  logger.error('Vue应用错误', { error: err, info, instance })
  errorHandler.handle(err, 'vue-app')

  // 显示用户友好的错误通知
  if (window.showNotification) {
    window.showNotification({
      type: 'error',
      title: '应用错误',
      message: '应用遇到了一个错误，请刷新页面重试'
    })
  }
}

// 全局警告处理
app.config.warnHandler = (msg: string, _instance: any, trace: string) => {
  console.warn('Vue 警告:', msg)
  console.warn('组件追踪:', trace)
}

// 开发环境配置
if (import.meta.env.DEV) {
  app.config.performance = true
  logger.info('Vue应用启动', { mode: 'development' })
}

// 应用初始化
const initializeApp = async () => {
  try {
    // 初始化插件store
    const pluginStore = usePluginStore()
    await pluginStore.initialize()

    // 挂载应用
    app.mount('#app')

    logger.info('Vue应用初始化完成')
  } catch (error) {
    logger.error('Vue应用初始化失败', { error })
    errorHandler.handle(error, 'app-init')

    // 显示错误信息
    document.body.innerHTML = `
      <div style="
        padding: 20px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #dc3545;
      ">
        <h3>应用初始化失败</h3>
        <p>请刷新页面重试，或检查浏览器控制台获取详细错误信息。</p>
        <button onclick="location.reload()" style="
          background: #007AFF;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 10px;
        ">刷新页面</button>
      </div>
    `
  }
}

// 启动应用
initializeApp()

// 全局类型声明
declare global {
  interface Window {
    showNotification: (notification: {
      type: 'success' | 'error' | 'warning' | 'info'
      title: string
      message: string
      duration?: number
    }) => void
  }
}

// 导出应用实例（用于测试或调试）
export { app, router, pinia }
export default app