/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 扩展全局类型
declare global {
  interface Window {
    markdownRenderer?: any
  }
}

// 浏览器插件相关类型扩展
declare namespace chrome {
  namespace runtime {
    interface Port {
      name: string
    }
  }
}

export {}