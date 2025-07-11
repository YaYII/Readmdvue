<template>
  <div id="app" :class="themeClass">
    <!-- 主要内容区域 -->
    <div class="app-container">
      <!-- 顶部工具栏 -->
      <div class="app-toolbar liquid-glass">
        <div class="toolbar-left">
          <button 
            class="toolbar-btn"
            @click="toggleSettings"
            title="设置 (Ctrl+,)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          
          <button 
            class="toolbar-btn"
            @click="toggleSearch"
            title="搜索 (Ctrl+F)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          
          <button 
            class="toolbar-btn"
            @click="toggleExport"
            title="导出 (Ctrl+E)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
        
        <div class="toolbar-center">
          <div class="app-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2"/>
              <polyline points="10,9 9,9 8,9" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>Markdown Reader</span>
          </div>
        </div>
        
        <div class="toolbar-right">
          <button 
            class="toolbar-btn"
            @click="toggleTheme"
            :title="isDarkMode ? '切换到浅色模式' : '切换到深色模式'"
          >
            <svg v-if="isDarkMode" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
              <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2"/>
              <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2"/>
              <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2"/>
              <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2"/>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          
          <button 
            class="toolbar-btn"
            @click="togglePerformance"
            title="性能监控 (Ctrl+Shift+P)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- 主要内容 -->
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
    
    <!-- 侧边面板 -->
    <div class="app-panels">
      <!-- 设置面板 -->
      <transition name="slide-right">
        <SettingsPanel 
          v-if="showSettings"
          @close="showSettings = false"
        />
      </transition>
      
      <!-- 搜索面板 -->
      <transition name="slide-left">
        <SearchPanel 
          v-if="showSearch"
          @close="showSearch = false"
        />
      </transition>
    </div>
    
    <!-- 模态对话框 -->
    <div class="app-modals">
      <!-- 导出对话框 -->
      <transition name="modal">
        <ExportDialog 
          v-if="showExport"
          @close="showExport = false"
          @export="handleExport"
        />
      </transition>
    </div>
    
    <!-- 性能监控 -->
    <PerformanceMonitor ref="performanceMonitor" />
    
    <!-- 全局通知 -->
    <div class="app-notifications">
      <transition-group name="notification" tag="div">
        <div 
          v-for="notification in notifications"
          :key="notification.id"
          class="notification liquid-glass"
          :class="notification.type"
        >
          <div class="notification-icon">
            <svg v-if="notification.type === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            </svg>
            <svg v-else-if="notification.type === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
              <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
          </div>
          <button 
            class="notification-close"
            @click="removeNotification(notification.id)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </transition-group>
    </div>
    
    <!-- 全局加载指示器 -->
    <div v-if="pluginStore.isLoading" class="global-loading">
      <div class="loading-spinner"></div>
      <p class="loading-text">正在加载...</p>
    </div>
    
    <!-- 全局错误提示 -->
    <div v-if="pluginStore.error" class="global-error">
      <div class="error-content">
        <h3 class="error-title">出现错误</h3>
        <p class="error-message">{{ pluginStore.error }}</p>
        <div class="error-actions">
          <button @click="handleRetry" class="btn btn-primary">
            重试
          </button>
          <button @click="handleClearError" class="btn btn-secondary">
            忽略
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 通知系统接口定义
interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
}

// 全局类型声明
declare global {
  interface Window {
    showNotification: (notification: Omit<Notification, 'id'>) => void
  }
}

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePluginStore } from './stores/plugin'
import { useMarkdownStore } from './stores/markdown'
import { useAccentColor } from './composables/useAccentColor'
import { logger } from './utils'
import SettingsPanel from './components/SettingsPanel.vue'
import SearchPanel from './components/SearchPanel.vue'
import ExportDialog from './components/ExportDialog.vue'
import PerformanceMonitor from './components/PerformanceMonitor.vue'

// 组件引用
const performanceMonitor = ref<InstanceType<typeof PerformanceMonitor>>()

// 状态管理
const pluginStore = usePluginStore()
const markdownStore = useMarkdownStore()

// 强调色管理
const { loadAccentColor } = useAccentColor()

// 响应式数据
const showSettings = ref(false)
const showSearch = ref(false)
const showExport = ref(false)

const notifications = ref<Notification[]>([])

// 计算属性
const isDarkMode = computed(() => markdownStore.isDarkMode)
const themeClass = computed(() => markdownStore.currentThemeClass)

// 错误处理
const handleRetry = () => {
  pluginStore.clearError()
  pluginStore.initialize()
}

const handleClearError = () => {
  pluginStore.clearError()
}

// 方法
const toggleSettings = () => {
  showSettings.value = !showSettings.value
  if (showSettings.value) {
    showSearch.value = false
  }
}

const toggleSearch = () => {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    showSettings.value = false
  }
}

const toggleExport = () => {
  showExport.value = !showExport.value
}

const toggleTheme = () => {
  markdownStore.toggleTheme()
}

const togglePerformance = () => {
  if (performanceMonitor.value) {
    performanceMonitor.value.show()
  }
}

const handleExport = (options: any) => {
  // 处理导出逻辑
  console.log('导出选项:', options)
  showNotification({
    type: 'success',
    title: '导出成功',
    message: `已成功导出为 ${options.format.toUpperCase()} 格式`
  })
  showExport.value = false
}

// 通知系统
const showNotification = (notification: Omit<Notification, 'id'>) => {
  const id = Date.now().toString()
  const newNotification: Notification = {
    id,
    duration: 3000,
    ...notification
  }
  
  notifications.value.push(newNotification)
  
  // 自动移除通知
  if (newNotification.duration && newNotification.duration > 0) {
    setTimeout(() => {
      removeNotification(id)
    }, newNotification.duration)
  }
}

const removeNotification = (id: string) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

// 全局键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  // ESC键清除错误
  if (event.key === 'Escape' && pluginStore.error) {
    handleClearError()
  }
  
  // Ctrl/Cmd + R 刷新
  if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
    event.preventDefault()
    handleRetry()
  }
  
  // Ctrl+, 打开设置
  if (event.ctrlKey && event.key === ',') {
    event.preventDefault()
    toggleSettings()
  }
  
  // Ctrl+F 打开搜索
  if (event.ctrlKey && event.key === 'f') {
    event.preventDefault()
    toggleSearch()
  }
  
  // Ctrl+E 打开导出
  if (event.ctrlKey && event.key === 'e') {
    event.preventDefault()
    toggleExport()
  }
  
  // Ctrl+Shift+P 打开性能监控
  if (event.ctrlKey && event.shiftKey && event.key === 'P') {
    event.preventDefault()
    togglePerformance()
  }
  
  // Escape 关闭所有面板
  if (event.key === 'Escape') {
    showSettings.value = false
    showSearch.value = false
    showExport.value = false
  }
}

// 生命周期
onMounted(() => {
  logger.info('主应用组件挂载完成')
  
  // 初始化 Markdown 存储
  markdownStore.initialize()
  
  // 初始化强调色
  loadAccentColor()
  
  // 监听强调色变化事件
  window.addEventListener('accent-color-changed', (event: Event) => {
    const customEvent = event as CustomEvent
    logger.info('强调色已变化:', customEvent.detail)
  })
  
  // 监听键盘事件
  document.addEventListener('keydown', handleKeydown)
  
  // 显示欢迎通知
  showNotification({
    type: 'info',
    title: '欢迎使用 Markdown Reader',
    message: '使用 Ctrl+, 打开设置，Ctrl+F 搜索内容'
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// 暴露方法给全局使用
window.showNotification = showNotification
</script>

<style scoped>
.app-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  background: var(--md-bg-primary);
  color: var(--md-text-primary);
  font-family: var(--md-font-primary);
}

/* 全局加载指示器 */
.global-loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

@media (prefers-color-scheme: dark) {
  .global-loading {
    background: rgba(28, 28, 30, 0.95);
  }
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--md-border-primary);
  border-top: 3px solid var(--md-accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--md-spacing-lg);
}

.loading-text {
  font-size: 0.875rem;
  color: var(--md-text-secondary);
  margin: 0;
}

/* 全局错误提示 */
.global-error {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.3s ease;
}

.error-content {
  background: var(--md-bg-primary);
  border-radius: var(--md-radius-xl);
  padding: var(--md-spacing-3xl);
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: var(--md-shadow-lg);
  border: 1px solid var(--md-border-primary);
}

.error-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--md-accent-red);
  margin: 0 0 var(--md-spacing-lg) 0;
}

.error-message {
  font-size: 0.875rem;
  color: var(--md-text-secondary);
  line-height: 1.6;
  margin: 0 0 var(--md-spacing-2xl) 0;
}

.error-actions {
  display: flex;
  gap: var(--md-spacing-md);
  justify-content: center;
}

.btn {
  padding: var(--md-spacing-md) var(--md-spacing-xl);
  border-radius: var(--md-radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 80px;
}

.btn-primary {
  background: var(--md-accent-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--md-accent-hover);
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--md-bg-secondary);
  color: var(--md-text-secondary);
  border: 1px solid var(--md-border-primary);
}

.btn-secondary:hover {
  background: var(--md-border-primary);
  color: var(--md-text-primary);
  transform: translateY(-1px);
}

/* 动画定义 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .error-content {
    padding: var(--md-spacing-2xl);
    margin: var(--md-spacing-lg);
  }
  
  .error-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .global-loading {
    background: rgba(255, 255, 255, 0.98);
  }
  
  @media (prefers-color-scheme: dark) {
    .global-loading {
      background: rgba(0, 0, 0, 0.98);
    }
  }
  
  .error-content {
    border-width: 2px;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
    border-top-color: var(--md-accent-primary);
  }
  
  .global-loading,
  .global-error {
    animation: none;
  }
  
  .btn:hover {
    transform: none;
  }
}
</style>