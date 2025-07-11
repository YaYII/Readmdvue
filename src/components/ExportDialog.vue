<template>
  <div class="export-dialog-overlay" @click="$emit('close')">
    <div class="export-dialog liquid-glass animate-scale-up" @click.stop>
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
              v-for="format in exportFormats"
              :key="format.type"
              :class="[
                'format-option',
                { 'active': selectedFormat === format.type }
              ]"
              @click="selectedFormat = format.type"
            >
              <div class="format-icon" :style="{ background: format.color }">
                <component :is="format.icon" />
              </div>
              <div class="format-info">
                <span class="format-name">{{ format.name }}</span>
                <span class="format-desc">{{ format.description }}</span>
              </div>
              <div class="format-check" v-if="selectedFormat === format.type">
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

            <!-- 页面设置 (仅PDF) -->
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
import { ref, computed, defineComponent } from 'vue'
import type { ExportOptions } from '../types'

// 定义事件
defineEmits<{
  close: []
  export: [options: ExportOptions]
}>()

// 定义props
defineProps<{
  documentTitle?: string
}>()

// 响应式数据
const selectedFormat = ref<string>('html')
const isExporting = ref(false)

// 导出选项
const exportOptions = ref<ExportOptions>({
  format: 'html',
  filename: 'document',
  includeStyles: true,
  includeImages: true,
  includeCharts: true,
  includeMath: true,
  pageSize: 'A4',
  orientation: 'portrait',
  quality: 0.9
})

// 图标组件
const HtmlIcon = defineComponent({
  template: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M13 12h7l-2 8H6l-2-8h7V4h2v8z" fill="currentColor"/>
      <path d="M5 4h14M7 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
})

const PdfIcon = defineComponent({
  template: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="currentColor" opacity="0.3"/>
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
})

const MarkdownIcon = defineComponent({
  template: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 5h18v14H3zM7 15V9l2 2 2-2v6M17 11h-2v4h2v-1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
})

const ImageIcon = defineComponent({
  template: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2"/>
      <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
})

// 导出格式配置
const exportFormats = [
  {
    type: 'html',
    name: 'HTML',
    description: '网页格式，保留所有样式',
    extension: 'html',
    color: 'linear-gradient(135deg, #FF6B35, #F7931E)',
    icon: HtmlIcon,
    supportsCharts: true,
    supportsMath: true
  },
  {
    type: 'pdf',
    name: 'PDF',
    description: '便携式文档格式',
    extension: 'pdf',
    color: 'linear-gradient(135deg, #DC143C, #B22222)',
    icon: PdfIcon,
    supportsCharts: true,
    supportsMath: true
  },
  {
    type: 'markdown',
    name: 'Markdown',
    description: '原始Markdown格式',
    extension: 'md',
    color: 'linear-gradient(135deg, #4A90E2, #357ABD)',
    icon: MarkdownIcon,
    supportsCharts: false,
    supportsMath: false
  },
  {
    type: 'png',
    name: 'PNG图片',
    description: '高质量图片格式',
    extension: 'png',
    color: 'linear-gradient(135deg, #50C878, #228B22)',
    icon: ImageIcon,
    supportsCharts: true,
    supportsMath: true
  },
  {
    type: 'jpeg',
    name: 'JPEG图片',
    description: '压缩图片格式',
    extension: 'jpg',
    color: 'linear-gradient(135deg, #FFD700, #FFA500)',
    icon: ImageIcon,
    supportsCharts: true,
    supportsMath: true
  }
]

// 计算属性
const selectedFormatConfig = computed(() => {
  return exportFormats.find(format => format.type === selectedFormat.value)
})

// 方法
const handleExport = async () => {
  if (isExporting.value) return
  
  isExporting.value = true
  
  try {
    const options: ExportOptions = {
      ...exportOptions.value,
      format: selectedFormat.value as 'html' | 'pdf' | 'markdown' | 'png' | 'jpeg'
    }
    
    // 这里应该调用实际的导出逻辑
    await new Promise(resolve => setTimeout(resolve, 2000)) // 模拟导出过程
    
    // 触发导出事件
    console.log('导出选项:', options)
    // emit('export', options)
    
    // 关闭对话框
    // emit('close')
  } catch (error) {
    console.error('导出失败:', error)
  } finally {
    isExporting.value = false
  }
}

// 监听格式变化，更新文件扩展名
const updateFilename = () => {
  if (selectedFormatConfig.value) {
    // 保持文件名，只更新扩展名
    const baseName = exportOptions.value.filename.replace(/\.[^/.]+$/, '')
    exportOptions.value.filename = baseName
  }
}

// 监听选中格式变化
const watchSelectedFormat = () => {
  exportOptions.value.format = selectedFormat.value as 'html' | 'pdf' | 'markdown' | 'png' | 'jpeg'
  updateFilename()
}

// 初始化
watchSelectedFormat()
</script>

<style scoped>
.export-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

.export-dialog {
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  font-family: var(--apple-font-family);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--liquid-glass-border);
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.header-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--apple-green), var(--apple-blue));
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.header-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--apple-label);
  margin: 0;
}

.header-subtitle {
  font-size: var(--font-size-base);
  color: var(--apple-secondary-label);
  margin: 0;
}

.close-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 50%;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--apple-label);
  margin: 0 0 var(--spacing-md) 0;
}

.format-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-sm);
}

.format-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--liquid-glass-light);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-in-out);
  text-align: left;
}

.format-option:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
}

.format-option.active {
  border-color: var(--apple-blue);
  background: rgba(0, 122, 255, 0.1);
}

.format-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.format-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.format-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--apple-label);
}

.format-desc {
  font-size: var(--font-size-sm);
  color: var(--apple-secondary-label);
}

.format-check {
  width: 24px;
  height: 24px;
  background: var(--apple-blue);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--liquid-glass-light);
  border: 1px solid var(--liquid-glass-border);
  border-radius: var(--radius-md);
}

.option-label {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
}

.option-label > span:first-child {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--apple-label);
}

.option-desc {
  font-size: var(--font-size-sm);
  color: var(--apple-secondary-label);
}

.select-apple {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--liquid-glass-light);
  border: 1px solid var(--liquid-glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  color: var(--apple-label);
  outline: none;
  transition: all var(--duration-normal) var(--ease-in-out);
}

.select-apple:focus {
  border-color: var(--apple-blue);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.slider-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-width: 150px;
}

.slider-apple {
  flex: 1;
  height: 6px;
  background: var(--apple-gray-5);
  border-radius: var(--radius-sm);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.slider-apple::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--apple-blue);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.slider-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--apple-secondary-label);
  min-width: 40px;
  text-align: right;
}

.filename-input {
  display: flex;
  align-items: center;
  background: var(--liquid-glass-light);
  border: 1px solid var(--liquid-glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.input-apple {
  flex: 1;
  padding: var(--spacing-md);
  background: transparent;
  border: none;
  font-size: var(--font-size-md);
  color: var(--apple-label);
  outline: none;
}

.filename-extension {
  padding: var(--spacing-md);
  background: var(--apple-gray-6);
  color: var(--apple-secondary-label);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
}

.dialog-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--liquid-glass-border);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .export-dialog {
    max-width: 95vw;
    max-height: 90vh;
  }
  
  .option-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }
  
  .slider-container {
    width: 100%;
    min-width: unset;
  }
  
  .footer-actions {
    flex-direction: column;
  }
}
</style>