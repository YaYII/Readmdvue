import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import manifest from './manifest.json'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    crx({
      manifest,
      // 减少扩展程序重载频率的配置
      browser: 'chrome'
    }),
    {
      // 构建后修复：content script 主包中的动态 import（mermaid/KaTeX 懒加载 chunk）
      // 统一重写为 chrome.runtime.getURL 扩展绝对 URL——
      // 相对路径在 file:// 页面会被解析为 file:///assets/...（跨源被 CORS 拦截），
      // 扩展绝对 URL 在任何页面协议下都正确加载
      name: 'fix-content-dynamic-import',
      closeBundle() {
        // 扫描整个 dist 下所有 .js（content 入口产物在 dist/content/main.js，
        // 动态 chunk 在 dist/assets/——此前只扫 assets/main-*.js 导致空转）
        const distDir = join(__dirname, 'dist')
        const files: string[] = []
        const collect = (dir: string): void => {
          for (const name of readdirSync(dir)) {
            const p = join(dir, name)
            const st = statSync(p)
            if (st.isDirectory()) collect(p)
            else if (name.endsWith('.js')) files.push(p)
          }
        }
        collect(distDir)
        files.forEach((path) => {
          let code = readFileSync(path, 'utf8')
          const before = code
          // import("../assets/NAME.js") 或 import("./NAME.js")
          // → import(chrome.runtime.getURL("assets/NAME.js"))（扩展绝对 URL，任何页面协议下可加载）
          code = code.replace(/import\("\.\.\/assets\/([^"]+\.js)"\)/g, 'import(chrome.runtime.getURL("assets/$1"))')
          code = code.replace(/import\("\.\/([^"]+\.js)"\)/g, 'import(chrome.runtime.getURL("assets/$1"))')
          if (code !== before) {
            writeFileSync(path, code)
            console.log(`[fix-content-dynamic-import] 已重写: ${path}`)
          }
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    host: 'localhost',
    hmr: {
      port: 5174,
      host: 'localhost',
      // 优化HMR配置以减少重载
      overlay: false, // 禁用错误覆盖层，避免频繁刷新
      clientPort: 5174
    },
    cors: true,
    // 优化文件监听配置
    watch: {
      // 排除不需要监听的文件和目录
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.log',
        '**/test-*.md', // 排除测试markdown文件
        '**/README.md',
        '**/*.md.backup',
        '**/package-lock.json'
      ],
      // 减少文件系统事件的轮询频率
      usePolling: false,
      interval: 1000, // 增加轮询间隔
      binaryInterval: 2000
    }
  },
  // 生产构建时移除所有 console.* 和 debugger，避免大量日志拖累用户浏览器性能；
  // dev (vite serve) 下保留以便调试
  esbuild: {
    // 临时排查（2026-08-12 SAVE_FILE 链路）：保留 console 便于用户控制台定位；排查完恢复 drop
    drop: command === 'build' ? ['debugger'] : []
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    copyPublicDir: true, // 确保public目录下的文件被复制
    rollupOptions: {
      input: {
        // 明确指定入口文件
        'content': 'src/content/main.ts',
        'background': 'src/background/main.ts',
        'popup': 'src/popup/main.ts'
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: (chunkInfo) => {
          // 根据入口文件名生成正确的输出路径
          const name = chunkInfo.name
          if (name === 'content') {
            return 'content/main.js'
          } else if (name === 'background') {
            return 'background/main.js'
          } else if (name === 'popup') {
            return 'popup/main.js'
          }
          return '[name]/main.js'
        },
      },
      // 防止第三方库注入不必要的网络请求
      external: (id) => {
        // 排除可能包含外部请求的模块
        if (id.includes('analytics') ||
          id.includes('tracking') ||
          id.includes('telemetry') ||
          id.includes('sentry') ||
          id.includes('bugsnag')) {
          return true
        }
        return false
      }
    }
  },
  // 优化依赖处理
  optimizeDeps: {
    // 排除某些依赖的预构建以减少重载
    exclude: ['@crxjs/vite-plugin'],
    include: [
      'vue',
      'pinia',
      'marked',
      'highlight.js'
    ]
  },
  // 环境变量
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    // 开发环境标识：仅 dev 模式为 true
    __DEV__: JSON.stringify(command === 'serve')
  },
  // CSS优化
  css: {
    devSourcemap: false, // 在开发环境禁用CSS sourcemap以提高性能
    postcss: {
      plugins: []
    }
    // 注意：Vite默认会将CSS提取为独立文件，无需额外配置
  }
}))
