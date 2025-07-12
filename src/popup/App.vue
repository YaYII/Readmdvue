<template>
  <div class="popup-container">
    <!-- 头部 -->
    <header class="popup-header">
      <div class="header-content">
        <div class="logo-section">
          <div class="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h18v18H3V3zm2 2v14h14V5H5z" fill="currentColor"/>
              <path d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" fill="currentColor"/>
            </svg>
          </div>
          <div class="title-section">
            <h1 class="app-title">Markdown Reader</h1>
            <p class="app-subtitle">Vue Edition</p>
          </div>
        </div>
        <div class="version-badge">
          v{{ version }}
        </div>
      </div>
    </header>

    <!-- 状态显示 -->
    <section class="status-section">
      <div class="status-card" :class="statusClass">
        <div class="status-icon">
          <component :is="statusIcon" />
        </div>
        <div class="status-content">
          <h3 class="status-title">{{ statusTitle }}</h3>
          <p class="status-description">{{ statusDescription }}</p>
          
          <!-- 扩展上下文失效提示 -->
          <div v-if="!checkExtensionContext()" class="context-error-notice">
            <div class="error-message">
              <AlertIcon class="error-icon" />
              <span>检测到扩展上下文失效，你的配置列表中没有主题选项。无法修改</span>
            </div>
            <!-- 停止插件运行按钮 -->
            <div class="action-item">
              <button 
                @click="stopExtension" 
                class="action-btn stop-btn"
                :disabled="isLoading"
              >
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
                停止运行
              </button>
            </div>
            <!-- 重新加载扩展按钮 -->
            <button @click="reloadExtension" class="reload-button">
              <RefreshIcon class="button-icon" />
              重新加载扩展
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 日志面板 -->
    <section class="logs-section" v-if="showLogs && pluginStore.logs.length > 0">
      <div class="logs-header">
        <h4 class="logs-title">运行日志</h4>
        <button @click="clearLogs" class="clear-button">
          <ClearIcon class="button-icon" />
        </button>
      </div>
      <div class="logs-content">
        <div 
          v-for="log in recentLogs" 
          :key="log.timestamp"
          class="log-item"
          :class="`log-${log.level}`"
        >
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </section>

    <!-- 支付支持部分 -->
    <section class="support-section" v-if="showSupport">
      <div class="support-header">
        <h4 class="support-title">
          <HeartIcon class="heart-icon" />
          支持开发者
        </h4>
        <button @click="toggleSupport" class="close-button">
          <!-- <CloseIcon class="button-icon" /> -->
        </button>
      </div>
      <div class="support-content">
        <p class="support-description">
          如果这个插件对您有帮助，欢迎扫码支持开发者继续改进和维护
        </p>
        <div class="qr-codes-container">
          <div class="qr-code-item">
            <div class="qr-code-wrapper">
              <img 
                src="../assets/pay/24d4be73eecb41422cacfedef3002456.jpg" 
                alt="微信支付"
                class="qr-code-image"
              />
            </div>
            <span class="qr-code-label">微信支付</span>
          </div>
          <div class="qr-code-item">
            <div class="qr-code-wrapper">
              <img 
                src="../assets/pay/8832d512343a8573d8bb212463ae15a9.jpg" 
                alt="支付宝"
                class="qr-code-image"
              />
            </div>
            <span class="qr-code-label">支付宝</span>
          </div>
        </div>
        <div class="support-thanks">
          <span class="thanks-text">感谢您的支持 ❤️</span>
        </div>
      </div>
    </section>

    <!-- 页脚 -->
    <footer class="popup-footer">
      <div class="footer-links">
        <button @click="toggleLogs" class="footer-link">
          {{ showLogs ? '隐藏' : '显示' }}日志
        </button>
        <button @click="toggleSupport" class="footer-link">
          {{ showSupport ? '隐藏' : '支持' }}开发者
        </button>
        <button @click="openHelp" class="footer-link">
          帮助文档
        </button>
      </div>
      <div class="footer-info">
        <span class="copyright">© 2025 Markdown Reader Vue</span>
      </div>
    </footer>

    <!-- 加载遮罩 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue'
import { usePluginStore } from '../stores/plugin'
import type { MarkdownConfig } from '../types'
import { defaultConfig } from '../types'

// Icons (简化的SVG图标组件)
const CheckIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor' }, [
  h('path', { d: 'M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z' })
])

const AlertIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor' }, [
  h('path', { d: 'M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z' })
])

const RefreshIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor' }, [
  h('path', { d: 'M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z' }),
  h('path', { d: 'M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z' })
])

const ClearIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor' }, [
  h('path', { d: 'M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z' })
])

const HeartIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor' }, [
  h('path', { d: 'M8 2.748l-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15z' })
])

const CloseIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor' }, [
  h('path', { d: 'M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z' })
])

// Store
const pluginStore = usePluginStore()

// 响应式数据
const version = ref('2.0.0')
const isLoading = ref(false)
const loadingText = ref('')
const showLogs = ref(false)
const showSupport = ref(true)
const localConfig = ref<MarkdownConfig>({ ...defaultConfig })

// 计算属性
const statusClass = computed(() => {
  if (pluginStore.state.isMarkdownFile) {
    return 'status-success'
  }
  return 'status-inactive'
})

const statusIcon = computed(() => {
  return pluginStore.state.isMarkdownFile ? CheckIcon : AlertIcon
})

const statusTitle = computed(() => {
  if (pluginStore.state.isMarkdownFile) {
    return 'Markdown 文件已识别'
  }
  return '当前页面不是 Markdown 文件'
})

const statusDescription = computed(() => {
  if (pluginStore.state.isMarkdownFile) {
    return '插件已激活，可以使用所有功能'
  }
  return '请访问 .md 或 .markdown 文件以使用插件功能'
})

const recentLogs = computed(() => {
  return pluginStore.logs.slice(-10).reverse()
})

// 方法
const checkExtensionContext = (): boolean => {
  try {
    return !!(chrome?.runtime?.id)
  } catch {
    return false
  }
}

const toggleLogs = () => {
  showLogs.value = !showLogs.value
}

const toggleSupport = () => {
  showSupport.value = !showSupport.value
}

const clearLogs = () => {
  pluginStore.clearLogs()
}

const openHelp = () => {
  chrome.tabs.create({ 
    url: 'https://github.com/your-username/markdown-reader-vue#readme' 
  })
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const stopExtension = async () => {
  try {
    isLoading.value = true
    
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (tab.id) {
      // 发送停止消息到后台脚本
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_EXTENSION',
        payload: { 
          tabId: tab.id,
          reason: 'user_popup_stop' 
        }
      })
      
      if (response.success) {
        console.log('✅ 插件已停止运行')
        // 可以选择关闭popup或显示成功消息
        window.close()
      } else {
        console.error('❌ 停止插件失败:', response.error)
        alert('停止插件失败: ' + response.error)
      }
    }
  } catch (error) {
    console.error('❌ 停止插件时发生错误:', error)
    alert('停止插件时发生错误: ' + error)
  } finally {
    isLoading.value = false
  }
}

const reloadExtension = async () => {
  try {
    // 尝试重新加载扩展
    await chrome.runtime.reload()
  } catch (error) {
    // 如果无法重新加载，提示用户手动操作
    alert('无法自动重新加载扩展，请手动在扩展管理页面重新加载或刷新页面')
    console.error('重新加载扩展失败:', error)
  }
}

// 生命周期
onMounted(async () => {
  try {
    // 初始化插件状态
    await pluginStore.initialize()
    
    // 加载配置
    await pluginStore.loadConfig()
    localConfig.value = { ...pluginStore.currentConfig }
    
    // 检查当前标签页
    await pluginStore.checkCurrentTab()
  } catch (error) {
    console.error('初始化失败:', error)
    pluginStore.error = error instanceof Error ? error.message : '初始化失败'
  }
})

// 监听配置变化
watch(() => pluginStore.currentConfig, (newConfig) => {
    localConfig.value = { ...newConfig }
  }, { deep: true })
</script>

<style scoped>
/* 基础样式 */
.popup-container {
  width: 380px;
  min-height: 500px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'PingFang SC', sans-serif;
  color: #1d1d1f;
  overflow: hidden;
  position: relative;
}

/* 头部样式 */
.popup-header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #007AFF, #5856D6);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.title-section {
  display: flex;
  flex-direction: column;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  line-height: 1.2;
}

.app-subtitle {
  font-size: 12px;
  color: #8e8e93;
  margin: 0;
  font-weight: 500;
}

.version-badge {
  background: rgba(0, 122, 255, 0.1);
  color: #007AFF;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

/* 状态部分 */
.status-section {
  padding: 20px;
}

.status-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.status-success {
  background: rgba(48, 209, 88, 0.1);
  border-color: rgba(48, 209, 88, 0.2);
}

.status-inactive {
  background: rgba(255, 149, 0, 0.1);
  border-color: rgba(255, 149, 0, 0.2);
}

.status-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.status-success .status-icon {
  background: #30D158;
}

.status-inactive .status-icon {
  background: #FF9500;
}

.status-content {
  flex: 1;
}

.status-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.status-description {
  font-size: 12px;
  color: #8e8e93;
  margin: 0;
  line-height: 1.4;
}

/* 扩展上下文失效提示样式 */
.context-error-notice {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.2);
  border-radius: 8px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #d70015;
}

.error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* 停止按钮样式 */
.stop-btn {
  background: linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%);
  color: white;
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stop-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #e6342a 0%, #ff5252 100%);
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(255, 59, 48, 0.3);
}

.stop-btn:active {
  transform: translateY(0);
  box-shadow: 0 4px 15px rgba(255, 59, 48, 0.2);
}

.stop-btn:disabled {
  background: #f5f5f7;
  color: #8e8e93;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.reload-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #ff3b30;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reload-button:hover {
  background: #d70015;
  transform: translateY(-1px);
}

.reload-button:active {
  transform: translateY(0);
}

.reload-button .button-icon {
  width: 14px;
  height: 14px;
}

/* 控制面板 */
.controls-section {
  padding: 0 20px 20px;
}

.control-group {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #1d1d1f;
}

.control-item {
  margin-bottom: 12px;
}

.control-item:last-child {
  margin-bottom: 0;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.control-label-full {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-checkbox {
  display: none;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d1d6;
  border-radius: 4px;
  position: relative;
  transition: all 0.2s ease;
}

.control-checkbox:checked + .checkbox-custom {
  background: #007AFF;
  border-color: #007AFF;
}

.control-checkbox:checked + .checkbox-custom::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0px;
  width: 6px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.label-text {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}

.control-description {
  font-size: 11px;
  color: #8e8e93;
  margin: 4px 0 0 26px;
  line-height: 1.3;
}

.control-select {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d1d1d6;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #1d1d1f;
  outline: none;
  transition: all 0.2s ease;
  width: 100%;
}

.control-select:focus {
  border-color: #007AFF;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.range-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-range {
  flex: 1;
  height: 4px;
  background: #d1d1d6;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
}

.control-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #007AFF;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
}

.range-value {
  font-size: 12px;
  font-weight: 600;
  color: #007AFF;
  min-width: 40px;
  text-align: right;
}

/* 操作按钮 */
.actions-section {
  padding: 0 20px 20px;
  display: flex;
  gap: 12px;
}

.action-button {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  outline: none;
}

.action-button.primary {
  background: #007AFF;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.action-button.primary:hover {
  background: #0056CC;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 122, 255, 0.4);
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.9);
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.action-button.secondary:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.button-icon {
  width: 14px;
  height: 14px;
}

/* 支付支持部分 */
.support-section {
  margin: 0 20px 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.support-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(255, 45, 146, 0.05), rgba(175, 82, 222, 0.05));
}

.support-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1d1d1f;
}

.heart-icon {
  width: 18px;
  height: 18px;
  color: #FF2D92;
  animation: heartbeat 2s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.close-button {
  background: none;
  border: none;
  color: #8e8e93;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1d1d1f;
}

.support-content {
  padding: 20px;
}

.support-description {
  font-size: 13px;
  color: #6e6e73;
  margin: 0 0 20px 0;
  line-height: 1.5;
  text-align: center;
}

.qr-codes-container {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 20px;
}

.qr-code-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-code-wrapper {
  width: 120px;
  height: 120px;
  border-radius: 16px;
  overflow: hidden;
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.qr-code-wrapper:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.qr-code-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.qr-code-label {
  font-size: 12px;
  font-weight: 500;
  color: #6e6e73;
  text-align: center;
}

.support-thanks {
  text-align: center;
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 45, 146, 0.05), rgba(175, 82, 222, 0.05));
  border-radius: 12px;
  border: 1px solid rgba(255, 45, 146, 0.1);
}

.thanks-text {
  font-size: 13px;
  font-weight: 500;
  color: #FF2D92;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

/* 日志面板 */
.logs-section {
  margin: 0 20px 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.logs-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logs-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}

.clear-button {
  background: none;
  border: none;
  color: #8e8e93;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1d1d1f;
}

.logs-content {
  max-height: 120px;
  overflow-y: auto;
}

.log-item {
  padding: 8px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  font-size: 11px;
  display: flex;
  gap: 8px;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  color: #8e8e93;
  font-weight: 500;
  min-width: 60px;
}

.log-message {
  flex: 1;
  line-height: 1.3;
}

.log-error {
  background: rgba(255, 59, 48, 0.05);
  color: #d70015;
}

.log-warn {
  background: rgba(255, 149, 0, 0.05);
  color: #bf5700;
}

.log-info {
  color: #1d1d1f;
}

/* 页脚 */
.popup-footer {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding: 16px 20px;
  margin-top: auto;
}

.footer-links {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.footer-link {
  background: none;
  border: none;
  color: #007AFF;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.footer-link:hover {
  opacity: 0.7;
}

.footer-info {
  display: flex;
  justify-content: center;
}

.copyright {
  font-size: 10px;
  color: #8e8e93;
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 1000;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 122, 255, 0.2);
  border-top: 3px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  font-size: 13px;
  color: #8e8e93;
  margin: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 滚动条样式 */
.logs-content::-webkit-scrollbar {
  width: 4px;
}

.logs-content::-webkit-scrollbar-track {
  background: transparent;
}

.logs-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.logs-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>