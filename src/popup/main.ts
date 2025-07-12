import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
// CSS样式通过popup HTML文件直接引用，避免Vite转换为JS注入

// 创建Vue应用实例
const app = createApp(App)

// 创建Pinia实例
const pinia = createPinia()

// 使用Pinia
app.use(pinia)

// 挂载应用
app.mount('#app')

// 开发环境下的调试信息
if (import.meta.env.DEV) {
  console.log('Markdown Reader Vue - Popup 已启动')
  console.log('Vue版本:', app.version)
  console.log('环境:', import.meta.env.MODE)
}

// 错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue应用错误:', err)
  console.error('组件实例:', instance)
  console.error('错误信息:', info)

  // 可以在这里添加错误上报逻辑
  if (import.meta.env.PROD) {
    // 生产环境下的错误处理
    // 例如：发送错误报告到服务器
  }
}

// 全局属性
app.config.globalProperties.$chrome = chrome

// 性能监控（开发环境）
if (import.meta.env.DEV) {
  app.config.performance = true
}

// 导出应用实例（用于调试）
;(globalThis as any).__VUE_APP__ = app