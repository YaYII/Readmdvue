<template>
  <div class="settings-panel">
    <!-- 头部 -->
    <div class="settings-header">
      <div class="header-content">
        <div class="header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 class="header-title">设置</h2>
      </div>
      <button 
        class="close-button"
        data-close-btn
        @click="$emit('close')"
        aria-label="关闭设置"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- 设置内容 -->
    <div class="settings-content">
      <!-- 外观设置 -->
      <div class="control-group">
        <h4 class="group-title">外观设置</h4>
        
        <div class="control-item">
          <label class="control-label-full">
            <span class="label-text">主题模式</span>
            <select 
              :value="config.theme" 
              @change="updateConfig({ theme: ($event.target as HTMLSelectElement).value as any })"
              class="control-select"
            >
              <option value="auto">跟随系统</option>
              <option value="light">浅色模式</option>
              <option value="dark">深色模式</option>
              <option value="eyecare">护眼模式</option>
            </select>
          </label>
          <p class="control-description">护眼模式采用温暖的米黄色调，减少眼部疲劳</p>
        </div>

        <div class="control-item">
          <label class="control-label-full">
            <span class="label-text">强调色</span>
            <div class="accent-color-grid">
              <div 
                v-for="color in accentColors" 
                :key="color.value"
                class="accent-color-option"
                :class="[color.value, { active: config.accentColor === color.value }]"
                @click="updateConfig({ accentColor: color.value })"
                :title="color.name"
              ></div>
            </div>
          </label>
          <p class="control-description">选择界面的强调色主题</p>
        </div>

        <div class="control-item">
          <label class="control-label-full">
            <span class="label-text">字体大小</span>
            <div class="range-container">
              <input 
                type="range" 
                :value="config.fontSize" 
                @input="updateConfig({ fontSize: Number(($event.target as HTMLInputElement).value) })"
                min="12" 
                max="24" 
                step="1"
                class="control-range"
              >
              <span class="range-value">{{ config.fontSize }}px</span>
            </div>
          </label>
        </div>

        <div class="control-item">
          <label class="control-label-full">
            <span class="label-text">行高</span>
            <div class="range-container">
              <input 
                type="range" 
                :value="config.lineHeight" 
                @input="updateConfig({ lineHeight: Number(($event.target as HTMLInputElement).value) })"
                min="1.2" 
                max="2.0" 
                step="0.1"
                class="control-range"
              >
              <span class="range-value">{{ config.lineHeight }}</span>
            </div>
          </label>
        </div>

        <div class="control-item">
          <label class="control-label-full">
            <span class="label-text">最大宽度</span>
            <div class="range-container">
              <input 
                type="range" 
                :value="config.maxWidth" 
                @input="updateConfig({ maxWidth: Number(($event.target as HTMLInputElement).value) })"
                min="600" 
                max="1200" 
                step="50"
                class="control-range"
              >
              <span class="range-value">{{ config.maxWidth }}px</span>
            </div>
          </label>
        </div>
      </div>

      <!-- 渲染功能 -->
      <div class="control-group">
        <h4 class="group-title">渲染功能</h4>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableMermaid"
              @change="updateConfig({ enableMermaid: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">Mermaid 图表</span>
          </label>
          <p class="control-description">支持流程图、时序图、甘特图等</p>
        </div>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableMath"
              @change="updateConfig({ enableMath: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">数学公式</span>
          </label>
          <p class="control-description">LaTeX 数学公式渲染</p>
        </div>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableCharts"
              @change="updateConfig({ enableCharts: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">图表渲染</span>
          </label>
          <p class="control-description">PlantUML、Kroki 等图表</p>
        </div>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableHighlight"
              @change="updateConfig({ enableHighlight: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">代码高亮</span>
          </label>
          <p class="control-description">语法高亮显示代码块</p>
        </div>
      </div>

      <!-- 内容功能 -->
      <div class="control-group">
        <h4 class="group-title">内容功能</h4>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableTables"
              @change="updateConfig({ enableTables: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">表格样式</span>
          </label>
          <p class="control-description">美化表格显示效果</p>
        </div>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableTaskLists"
              @change="updateConfig({ enableTaskLists: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">任务列表</span>
          </label>
          <p class="control-description">支持可交互的任务清单</p>
        </div>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableImageZoom"
              @change="updateConfig({ enableImageZoom: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">图片缩放</span>
          </label>
          <p class="control-description">点击图片可放大查看</p>
        </div>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableCopyCode"
              @change="updateConfig({ enableCopyCode: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">代码复制</span>
          </label>
          <p class="control-description">代码块添加复制按钮</p>
        </div>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableLineNumbers"
              @change="updateConfig({ enableLineNumbers: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">行号显示</span>
          </label>
          <p class="control-description">代码块显示行号</p>
        </div>
        
        <div class="control-item">
          <label class="control-label">
            <input 
              type="checkbox" 
              :checked="config.enableAutoSave"
              @change="updateConfig({ enableAutoSave: ($event.target as HTMLInputElement).checked })"
              class="control-checkbox"
            >
            <span class="checkbox-custom"></span>
            <span class="label-text">自动保存</span>
          </label>
          <p class="control-description">自动保存配置更改</p>
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="settings-footer">
      <button 
        @click="resetToDefaults"
        class="action-button secondary"
      >
        重置默认
      </button>
      <button 
        @click="printPage"
        class="action-button secondary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="button-icon">
          <polyline points="6,9 6,2 18,2 18,9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <polyline points="6,14 6,22 18,22 18,14"></polyline>
        </svg>
        打印页面
      </button>
      
      <button 
        @click="exportHtml"
        class="action-button primary"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="button-icon">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
        导出 HTML
      </button>
      <button 
        @click="emit('close')"
        class="action-button primary"
      >
        完成
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMarkdownStore } from '../stores/markdown'
import type { MarkdownConfig, AccentColor } from '../types'

// 定义事件
const emit = defineEmits<{
  close: []
}>()

// 使用store
const markdownStore = useMarkdownStore()
const config = computed(() => markdownStore.config)

// 强调色选项
const accentColors = [
  { value: 'blue', name: '蓝色' },
  { value: 'purple', name: '紫色' },
  { value: 'pink', name: '粉色' },
  { value: 'red', name: '红色' },
  { value: 'orange', name: '橙色' },
  { value: 'yellow', name: '黄色' },
  { value: 'green', name: '绿色' },
  { value: 'graphite', name: '石墨色' }
] as const

// 组件挂载时初始化
onMounted(async () => {
  console.log('设置面板挂载，初始化配置')
  
  // 确保配置已加载
  await markdownStore.initialize()
  
  // 应用当前配置
  updateAccentColor(markdownStore.config.accentColor)
  applyTheme(markdownStore.config.theme)
  applyStyleConfig(markdownStore.config)
  
  console.log('当前配置:', markdownStore.config)
})

// 方法
const updateConfig = async (updates: Partial<MarkdownConfig>) => {
  console.log('更新配置:', updates)
  await markdownStore.updateConfig(updates)
  
  // 如果更新了强调色，需要更新CSS变量
  if (updates.accentColor) {
    updateAccentColor(updates.accentColor)
  }
  
  // 如果更新了主题，需要应用主题
  if (updates.theme) {
    applyTheme(updates.theme)
  }
  
  // 应用样式配置
  applyStyleConfig(markdownStore.config)
}

const applyStyleConfig = (config: MarkdownConfig) => {
  console.log('应用样式配置:', config)
  
  // 只通知content script应用配置，不在popup中设置CSS变量
  // 这样避免了双重应用和冲突
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_STYLE_CONFIG',
          config: config
        }).catch(error => {
          console.log('发送样式配置消息失败:', error)
        })
      }
    })
  } catch (error) {
    console.log('无法发送样式配置消息:', error)
  }
}

const updateAccentColor = (accentColor: AccentColor) => {
  console.log('应用强调色:', accentColor)
  
  // 移除之前的强调色类
  document.documentElement.classList.remove(
    'accent-blue', 'accent-purple', 'accent-pink', 'accent-red',
    'accent-orange', 'accent-yellow', 'accent-green', 'accent-graphite'
  )
  
  // 添加新的强调色类
  document.documentElement.classList.add(`accent-${accentColor}`)
  
  // 更新CSS变量
  const colorMap = {
    blue: '#007AFF',
    purple: '#AF52DE',
    pink: '#FF2D92',
    red: '#FF3B30',
    orange: '#FF9500',
    yellow: '#FFCC00',
    green: '#30D158',
    graphite: '#8E8E93'
  }
  
  const color = colorMap[accentColor]
  if (color) {
    document.documentElement.style.setProperty('--accent-color', color)
    document.documentElement.style.setProperty('--accent-color-rgb', hexToRgb(color))
  }
}

const applyTheme = (theme: string) => {
  console.log('应用主题:', theme)
  document.documentElement.setAttribute('data-theme', theme)
  
  if (theme === 'auto') {
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const actualTheme = mediaQuery.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-actual-theme', actualTheme)
    }
    mediaQuery.addEventListener('change', handleChange)
    handleChange() // 立即应用
  } else {
    document.documentElement.setAttribute('data-actual-theme', theme)
  }
}

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    const r = parseInt(result[1], 16)
    const g = parseInt(result[2], 16)
    const b = parseInt(result[3], 16)
    return `${r}, ${g}, ${b}`
  }
  return '0, 122, 255' // 默认蓝色
}

const resetToDefaults = async () => {
  console.log('重置为默认配置')
  await markdownStore.resetConfig()
  
  // 重新应用默认强调色和主题
  updateAccentColor(markdownStore.config.accentColor)
  applyTheme(markdownStore.config.theme)
}

const exportHtml = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'EXPORT_HTML'
      })
    }
  } catch (error) {
    console.error('导出HTML失败:', error)
  }
}

const printPage = () => {
  try {
    //先关闭弹窗，避免打印了弹窗内容。
    emit('close')
    
    //再次执行隐藏设置菜单悬浮框。
    // 确保所有可能的悬浮元素都被隐藏
    setTimeout(() => {
      // 隐藏可能存在的工具栏
      const toolbar = document.querySelector('.action-toolbar')
      if (toolbar) {
        (toolbar as HTMLElement).style.display = 'none'
      }
      
      // 隐藏查看原始页面按钮
      const restoreButton = document.querySelector('.md-restore-button')
      if (restoreButton) {
        (restoreButton as HTMLElement).style.display = 'none'
      }
      
      // 隐藏可能存在的其他悬浮元素
      const floatingElements = document.querySelectorAll('[class*="floating"], [class*="popup"], [class*="tooltip"], [class*="markdown-vue-toolbar"]')
      floatingElements.forEach(element => {
        (element as HTMLElement).style.display = 'none'
      })
      
      // 后执行打印操作
      setTimeout(() => {
        window.print()
        
        // 打印完成后恢复元素显示
        setTimeout(() => {
          if (toolbar) {
            (toolbar as HTMLElement).style.display = ''
          }
          if (restoreButton) {
            (restoreButton as HTMLElement).style.display = ''
          }
          floatingElements.forEach(element => {
            (element as HTMLElement).style.display = ''
          })
        }, 100)
      }, 50)
    }, 100)
    
  } catch (error) {
    console.error('打印页面失败:', error)
    // 即使打印失败也关闭弹窗
    emit('close')
  }
}
</script>

<style scoped>
/* 基础样式 */
.settings-panel {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: 90vw;
  max-width: 600px;
  max-height: 80vh;
  z-index: 999999 !important;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 16px !important;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important;
  /* 防止页面样式干扰 */
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  /* 防止选中效果 */
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  /* 防止文本选择高亮 */
  -webkit-touch-callout: none !important;
  -webkit-tap-highlight-color: transparent !important;
}

/* 头部样式 */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #007AFF, #5856D6);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #1d1d1f;
}

.close-button {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #8e8e93;
}

.close-button:hover {
  background: rgba(255, 255, 255, 1);
  color: #1d1d1f;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 内容区域 */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* 控制组样式 */
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

/* 强调色网格 */
.accent-color-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.accent-color-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.accent-color-option:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.accent-color-option.active {
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 0 2px #007AFF;
}

.accent-color-option.blue { background: #007AFF; }
.accent-color-option.purple { background: #AF52DE; }
.accent-color-option.pink { background: #FF2D92; }
.accent-color-option.red { background: #FF3B30; }
.accent-color-option.orange { background: #FF9500; }
.accent-color-option.yellow { background: #FFCC00; }
.accent-color-option.green { background: #30D158; }
.accent-color-option.graphite { background: #8E8E93; }

/* 底部操作 */
.settings-footer {
  padding: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
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

.button-icon {
  width: 14px;
  height: 14px;
}

/* 滚动条样式 */
.settings-content::-webkit-scrollbar {
  width: 4px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .settings-panel {
    width: 95vw;
    max-height: 90vh;
  }
  
  .settings-footer {
    flex-direction: column;
  }
  
  .control-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .range-container {
    width: 100%;
  }
}
</style>