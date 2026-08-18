<template>
  <div class="export-dialog-overlay" @click="$emit('close')">
    <div 
      class="export-dialog liquid-glass animate-scale-up" 
      :class="tocLayoutClass" 
      @click.stop
      @mousedown.prevent
      @dragstart.prevent
      @selectstart.prevent
      @touchstart.passive
      @touchmove.prevent
    >
      <!-- 头部 -->
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="header-text">
            <h2 class="header-title">导出文档</h2>
            <p class="header-subtitle">选择导出格式和选项</p>
          </div>
        </div>
        <button 
          class="btn-apple btn-secondary close-btn"
          @click="$emit('close')"
          aria-label="关闭导出对话框"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- 导出格式选择 -->
      <div class="dialog-content">
        <div class="format-section">
          <h3 class="section-title">导出格式</h3>
          <div class="format-grid">
            <button 
              v-for="format in formatOptions"
              :key="format.value"
              :class="[
                'format-option',
                { 'active': selectedFormat === format.value }
              ]"
              @click="selectedFormat = format.value"
            >
              <div class="format-icon">
                {{ format.icon }}
              </div>
              <div class="format-info">
                <span class="format-name">{{ format.label }}</span>
                <span class="format-desc">{{ format.description }}</span>
              </div>
              <div class="format-check" v-if="selectedFormat === format.value">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </button>
          </div>
        </div>

        <!-- 导出选项 -->
        <div class="options-section" v-if="selectedFormatConfig">
          <h3 class="section-title">导出选项</h3>
          <div class="options-grid">
            <!-- 包含样式 -->
            <div class="option-item">
              <label class="option-label">
                <span>包含样式</span>
                <span class="option-desc">导出时包含CSS样式</span>
              </label>
              <div class="switch-apple">
                <input 
                  type="checkbox" 
                  v-model="exportOptions.includeStyles"
                >
                <span class="switch-slider"></span>
              </div>
            </div>

            <!-- 包含图片 -->
            <div class="option-item">
              <label class="option-label">
                <span>包含图片</span>
                <span class="option-desc">导出时包含图片资源</span>
              </label>
              <div class="switch-apple">
                <input 
                  type="checkbox" 
                  v-model="exportOptions.includeImages"
                >
                <span class="switch-slider"></span>
              </div>
            </div>

            <!-- 包含图表 -->
            <div class="option-item" v-if="selectedFormatConfig.supportsCharts">
              <label class="option-label">
                <span>包含图表</span>
                <span class="option-desc">导出Mermaid等图表</span>
              </label>
              <div class="switch-apple">
                <input 
                  type="checkbox" 
                  v-model="exportOptions.includeCharts"
                >
                <span class="switch-slider"></span>
              </div>
            </div>

            <!-- 包含数学公式 -->
            <div class="option-item" v-if="selectedFormatConfig.supportsMath">
              <label class="option-label">
                <span>包含数学公式</span>
                <span class="option-desc">导出KaTeX数学公式</span>
              </label>
              <div class="switch-apple">
                <input 
                  type="checkbox" 
                  v-model="exportOptions.includeMath"
                >
                <span class="switch-slider"></span>
              </div>
            </div>

            <!-- 包含公式字体 -->
            <div class="option-item" v-if="selectedFormatConfig.supportsFonts">
              <label class="option-label">
                <span>包含公式字体</span>
                <span class="option-desc">内嵌KaTeX字体（自包含；关闭则导出文件更小、源码干净）</span>
              </label>
              <div class="switch-apple">
                <input 
                  type="checkbox" 
                  v-model="exportOptions.includeFonts"
                >
                <span class="switch-slider"></span>
              </div>
            </div>

            <!-- 页面设置（仅 PDF；Word 固定 A3 纵向） -->
            <template v-if="selectedFormat === 'pdf'">
              <div class="option-item">
                <label class="option-label">
                  <span>页面大小</span>
                  <span class="option-desc">选择PDF页面大小</span>
                </label>
                <select v-model="exportOptions.pageSize" class="select-apple">
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>

              <div class="option-item">
                <label class="option-label">
                  <span>页面方向</span>
                  <span class="option-desc">选择页面方向</span>
                </label>
                <select v-model="exportOptions.orientation" class="select-apple">
                  <option value="portrait">纵向</option>
                  <option value="landscape">横向</option>
                </select>
              </div>
            </template>

            <!-- 质量设置 (仅图片) -->
            <div class="option-item" v-if="selectedFormat === 'png' || selectedFormat === 'jpeg'">
              <label class="option-label">
                <span>图片质量</span>
                <span class="option-desc">调整导出图片质量</span>
              </label>
              <div class="slider-container">
                <input 
                  type="range" 
                  v-model="exportOptions.quality"
                  min="0.1" 
                  max="1" 
                  step="0.1"
                  class="slider-apple"
                >
                <span class="slider-value">{{ Math.round((exportOptions.quality || 0.9) * 100) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 文件名设置 -->
        <div class="filename-section">
          <h3 class="section-title">文件名</h3>
          <div class="filename-input">
            <input 
              type="text" 
              v-model="exportOptions.filename"
              class="input-apple"
              placeholder="输入文件名"
              @mousedown.stop
              @selectstart.stop
            >
            <span class="filename-extension">.{{ selectedFormatConfig?.extension }}</span>
          </div>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="dialog-footer">
        <div class="footer-actions">
          <button 
            class="btn-apple btn-secondary"
            @click="$emit('close')"
          >
            取消
          </button>
          
          <button 
            class="btn-apple btn-primary"
            @click="handleExport"
            :disabled="isExporting"
          >
            <svg v-if="isExporting" class="loading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ isExporting ? '导出中...' : '开始导出' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { ExportOptions } from '../types'
import { showNotification } from '../utils/appleNotification'
import { exportDocument, getCurrentPageContent, generateDefaultFilename } from '../utils/exportUtils'

interface Props {
  visible: boolean
  content: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  export: [options: ExportOptions]
}>()

// 推拉式布局相关状态
const tocVisible = ref(false)
const tocCollapsed = ref(false)
let tocObserver: MutationObserver | null = null
let checkTimeout: ReturnType<typeof setTimeout> | null = null

// 推拉式布局计算属性
const tocLayoutClass = computed(() => {
  if (!tocVisible.value) return ''
  return tocCollapsed.value ? 'toc-collapsed' : 'toc-expanded'
})

// 设置目录菜单状态监听器
const setupTocStateListeners = () => {
  try {
    // 检查目录面板状态
    const checkTocPanel = () => {
      const tocPanel = document.querySelector('.toc-panel')
      if (tocPanel) {
        // 检查目录是否可见
        const isVisible = tocPanel.classList.contains('show')
        const isCollapsed = tocPanel.classList.contains('collapsed')
        
        // 只在状态真正改变时更新
        if (tocVisible.value !== isVisible || tocCollapsed.value !== isCollapsed) {
          tocVisible.value = isVisible
          tocCollapsed.value = isCollapsed
          
          console.log('导出对话框 - 目录状态更新:', {
            visible: tocVisible.value,
            collapsed: tocCollapsed.value,
            layoutClass: tocLayoutClass.value
          })
        }
      } else {
        // 目录面板不存在，重置状态
        if (tocVisible.value || tocCollapsed.value) {
          tocVisible.value = false
          tocCollapsed.value = false
          console.log('导出对话框 - 目录面板不存在，重置状态')
        }
      }
    }
    
    // 初始检查
    requestAnimationFrame(() => {
      checkTocPanel()
    })
    
    // 使用防抖优化的MutationObserver
    const debouncedCheck = () => {
      if (checkTimeout) {
        clearTimeout(checkTimeout)
      }
      checkTimeout = setTimeout(() => {
        requestAnimationFrame(checkTocPanel)
        checkTimeout = null
      }, 16) // 约60fps的更新频率
    }
    
    // 使用MutationObserver监听DOM变化，但限制监听范围
    tocObserver = new MutationObserver((mutations) => {
      let shouldCheck = false
      
      // 优化：只检查与toc-panel相关的变化
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as Element
          if (target.classList.contains('toc-panel')) {
            shouldCheck = true
            break // 找到就退出循环
          }
        } else if (mutation.type === 'childList') {
          // 只检查直接相关的节点
          const hasRelevantChange = 
            Array.from(mutation.addedNodes).some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              ((node as Element).classList?.contains('toc-panel') || 
               (node as Element).querySelector?.('.toc-panel'))
            ) ||
            Array.from(mutation.removedNodes).some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              ((node as Element).classList?.contains('toc-panel') || 
               (node as Element).querySelector?.('.toc-panel'))
            )
          
          if (hasRelevantChange) {
            shouldCheck = true
            break // 找到就退出循环
          }
        }
      }
      
      if (shouldCheck) {
        debouncedCheck()
      }
    })
    
    // 优化：只监听可能包含toc-panel的容器，而不是整个body
    const targetContainer = document.querySelector('.markdown-content') || 
                           document.querySelector('.content-container') || 
                           document.body
    
    tocObserver.observe(targetContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'] // 只监听class属性变化
    })
    
    console.log('导出对话框 - 目录菜单状态监听器已设置（优化版）')
  } catch (error) {
    console.error('导出对话框 - 设置目录菜单状态监听器失败:', error)
  }
}

// 清理目录菜单状态监听器
const cleanupTocStateListeners = () => {
  if (tocObserver) {
    tocObserver.disconnect()
    tocObserver = null
  }
  // 清理组件自己的timeout
  if (checkTimeout) {
    clearTimeout(checkTimeout)
    checkTimeout = null
  }
}

// 响应式数据
const selectedFormat = ref<string>('html')
const isExporting = ref(false)

// 导出选项
const exportOptions = ref<ExportOptions>({
  format: 'html',
  filename: 'document.html',
  includeStyles: true,
  includeImages: true,
  includeCharts: true,
  includeMath: true,
  includeFonts: false,
  pageSize: 'A3',
  orientation: 'portrait',
  quality: 0.9
})

// 格式选项
const formatOptions = [
  { 
    value: 'html', 
    label: 'HTML', 
    icon: '🌐', 
    description: '网页格式，保持完整样式',
    extension: 'html',
    supportsCharts: true,
    supportsMath: true,
    supportsFonts: true
  },
  { 
    value: 'pdf', 
    label: 'PDF', 
    icon: '📄', 
    description: '便携文档格式，适合打印',
    extension: 'pdf',
    supportsCharts: true,
    supportsMath: true,
    supportsFonts: true
  },
  { 
    value: 'markdown', 
    label: 'Markdown', 
    icon: '📝', 
    description: '纯文本标记格式',
    extension: 'md',
    supportsCharts: false,
    supportsMath: false,
    supportsFonts: false
  },
  {
    value: 'word',
    label: 'Word',
    icon: '📘',
    description: 'Word 文档（标准 .docx）',
    extension: 'docx',
    supportsCharts: true,
    supportsMath: true,
    supportsFonts: true
  },
  { 
    value: 'png', 
    label: 'PNG', 
    icon: '🖼️', 
    description: '高质量图片格式',
    extension: 'png',
    supportsCharts: true,
    supportsMath: true
  },
  { 
    value: 'jpeg', 
    label: 'JPEG', 
    icon: '📷', 
    description: '压缩图片格式',
    extension: 'jpg',
    supportsCharts: true,
    supportsMath: true
  }
]

// 计算属性
const selectedFormatConfig = computed(() => {
  return formatOptions.find(format => format.value === selectedFormat.value)
})

// 处理导出
const handleExport = async () => {
  if (isExporting.value) return
  
  isExporting.value = true
  
  try {
    // 构建导出选项
    const options: ExportOptions = {
      ...exportOptions.value,
      format: selectedFormat.value as 'html' | 'pdf' | 'markdown' | 'png' | 'jpeg' | 'word'
    }

    console.log('开始导出:', options)
    
    // 获取当前页面内容
    const contentToExport = props.content || getCurrentPageContent()
    
    // 执行导出
    await exportDocument(contentToExport, options)
    
    console.log('导出完成')
    emit('close')
  } catch (error) {
    console.error('导出失败:', error)
    showNotification({
      title: '导出失败',
      message: '导出过程中发生错误，请重试',
      type: 'error'
    })
  } finally {
    isExporting.value = false
  }
}

// 更新文件名扩展名（优化版）
const updateFilename = (newFormat: string) => {
  const currentFilename = exportOptions.value.filename
  const baseName = currentFilename.replace(/\.[^/.]+$/, '')
  const newExtension = formatOptions.find(f => f.value === newFormat)?.extension || newFormat
  exportOptions.value.filename = `${baseName}.${newExtension}`
}

// 生成默认文件名
const generateFilename = () => {
  const filename = generateDefaultFilename(selectedFormat.value)
  exportOptions.value.filename = filename
}

// 监听格式变化（优化版）
watch(selectedFormat, (newFormat, oldFormat) => {
  // 避免重复赋值
  if (newFormat !== oldFormat) {
    exportOptions.value.format = newFormat as 'html' | 'pdf' | 'markdown' | 'png' | 'jpeg' | 'word'
    updateFilename(newFormat)
  }
}, { immediate: false }) // 不立即执行，避免初始化时的重复调用

// 初始化时生成默认文件名
onMounted(() => {
  generateFilename()
  setupTocStateListeners()
})

// 组件卸载时清理监听器
onUnmounted(() => {
  cleanupTocStateListeners()
})
</script>

<style scoped>
/* 基础样式 - 完全采用设置弹窗的样式 */
.export-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  z-index: 2000;
  padding: var(--spacing-lg);
}

.export-dialog {
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
  /* 添加过渡动画 */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  /* 禁用拖拽，但允许文本选择 */
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
  /* 防止触摸滑动 */
  touch-action: none;
}

/* 推拉式布局样式 - 增加20px右偏移优化间距，与设置面板保持一致 */
.export-dialog.toc-expanded {
  /* 当目录完全展开时，对话框向右偏移更多 */
  left: calc(50% + 140px) !important;
}

.export-dialog.toc-collapsed {
  /* 当目录折叠时，对话框偏移较少 */
  left: calc(50% + 80px) !important;
}


/* 头部样式 - 完全采用设置弹窗的样式 */
.dialog-header {
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

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #1d1d1f;
}

.header-subtitle {
  font-size: 13px;
  color: #8e8e93;
  margin: 0;
}

.close-btn {
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
  padding: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 1);
  color: #1d1d1f;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 内容区域 - 采用设置弹窗的样式 */
.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 控制组样式 - 完全采用设置弹窗的样式 */
.format-section,
.options-section,
.filename-section {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #1d1d1f;
}

/* 格式选项样式 */
.format-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.format-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.format-option:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.format-option.active {
  border-color: #007AFF;
  background: rgba(0, 122, 255, 0.1);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.format-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  background: linear-gradient(135deg, #007AFF, #5856D6);
}

.format-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.format-name {
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
}

.format-desc {
  font-size: 11px;
  color: #8e8e93;
  line-height: 1.3;
}

.format-check {
  width: 24px;
  height: 24px;
  background: #007AFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

/* 选项网格样式 */
.options-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.option-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.option-label > span:first-child {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}

.option-desc {
  font-size: 11px;
  color: #8e8e93;
  line-height: 1.3;
}

/* 开关样式 - 采用设置弹窗的样式 */
.switch-apple {
  position: relative;
  width: 44px;
  height: 24px;
}

.switch-apple input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #d1d1d6;
  transition: 0.2s;
  border-radius: 24px;
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.switch-apple input:checked + .switch-slider {
  background-color: #007AFF;
}

.switch-apple input:checked + .switch-slider:before {
  transform: translateX(20px);
}

/* 选择框样式 - 采用设置弹窗的样式 */
.select-apple {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d1d1d6;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #1d1d1f;
  outline: none;
  transition: all 0.2s ease;
  min-width: 120px;
}

.select-apple:focus {
  border-color: #007AFF;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

/* 滑块样式 - 采用设置弹窗的样式 */
.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 150px;
}

.slider-apple {
  flex: 1;
  height: 4px;
  background: #d1d1d6;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.slider-apple::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #007AFF;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
}

.slider-value {
  font-size: 12px;
  font-weight: 600;
  color: #007AFF;
  min-width: 40px;
  text-align: right;
}

/* 文件名输入样式 */
.filename-input {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d1d1d6;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.filename-input:focus-within {
  border-color: #007AFF;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.input-apple {
  flex: 1;
  padding: 12px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: #1d1d1f;
  outline: none;
  /* 允许输入框中的文本选择 */
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}

.filename-extension {
  padding: 12px;
  background: rgba(0, 0, 0, 0.05);
  color: #8e8e93;
  font-size: 13px;
  font-weight: 500;
  border-left: 1px solid rgba(0, 0, 0, 0.1);
}

/* 底部操作 - 采用设置弹窗的样式 */
.dialog-footer {
  padding: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
}

.footer-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* 按钮样式 - 采用设置弹窗的样式 */
.btn-apple {
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
  min-width: 100px;
}

.btn-primary {
  background: #007AFF;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: #0056CC;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 122, 255, 0.4);
}

.btn-primary:disabled {
  background: #d1d1d6;
  color: #8e8e93;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.9);
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 加载动画 */
.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 滚动条样式 - 采用设置弹窗的样式 */
.dialog-content::-webkit-scrollbar {
  width: 4px;
}

.dialog-content::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.dialog-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 响应式设计 - 采用设置弹窗的样式 */
@media (max-width: 768px) {
  .export-dialog {
    width: 95vw;
    max-height: 90vh;
  }
  
  .footer-actions {
    flex-direction: column;
  }
  
  .option-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .slider-container {
    width: 100%;
    min-width: unset;
  }
  
  .format-option {
    padding: 16px 12px;
  }
  
  .btn-apple {
    width: 100%;
  }
}

/* 动画效果 */
.animate-scale-up {
  animation: scaleUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes scaleUp {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
