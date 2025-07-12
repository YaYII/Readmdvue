import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { fileURLToPath, URL } from 'node:url'
import manifest from './manifest.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    crx({
      manifest,
      // 减少扩展程序重载频率的配置
      browser: 'chrome'
    })
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
    // 添加开发环境标识
    __DEV__: JSON.stringify(true)
  },
  // CSS优化
  css: {
    devSourcemap: false, // 在开发环境禁用CSS sourcemap以提高性能
    postcss: {
      plugins: []
    }
    // 注意：Vite默认会将CSS提取为独立文件，无需额外配置
  }
})