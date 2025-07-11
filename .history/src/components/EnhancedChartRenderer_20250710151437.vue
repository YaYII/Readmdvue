<template>
  <div 
    class="enhanced-chart-renderer"
    :class="{ 
      'loading': isLoading, 
      'error': hasError,
      'liquid-glass': enableLiquidGlass,
      'fullscreen': isFullscreen
    }"
    ref="containerRef"
  >
    <!-- 工具栏 -->
    <div class="chart-toolbar" v-if="showToolbar">
      <div class="toolbar-left">
        <div class="chart-type-badge">{{ chartType.toUpperCase() }}</div>
        <div class="chart-status" :class="statusClass">
          <div class="status-dot"></div>
          <span class="status-text">{{ statusText }}</span>
        </div>
      </div>
      
      <div class="toolbar-right">
        <button 
          class="toolbar-button"
          @click="refreshChart"
          :disabled="isLoading"
          title="刷新图表"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.65 2.35A8 8 0 1 0 16 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M16 4V8H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        
        <button 
          class="toolbar-button"
          @click="exportChart"
          :disabled="isLoading || hasError"
          title="导出图表"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 10v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4M8 12V2M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        
        <button 
          class="toolbar-button"
          @click="toggleFullscreen"
          :disabled="isLoading"
          title="全屏显示"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 3a1 1 0 0 1 1-1h4M2 13a1 1 0 0 0 1 1h4M14 3a1 1 0 0 0-1-1H9M14 13a1 1 0 0 1-1 1H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 图表内容区域 -->
    <div class="chart-content" ref="chartContentRef">
      <!-- 加载状态 -->
      <Transition name="fade">
        <div v-if="isLoading" class="loading-overlay">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <div class="loading-text">{{ loadingText }}</div>
          <div class="loading-progress" v-if="showProgress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
            </div>
            <div class="progress-text">{{ progress }}%</div>
          </div>
        </div>
      </Transition>

      <!-- 错误状态 -->
      <Transition name="fade">
        <div v-if="hasError && !isLoading" class="error-overlay">
          <div class="error-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
              <path d="M16 16l16 16M32 16l-16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="error-title">图表渲染失败</div>
          <div class="error-message">{{ errorMessage }}</div>
          <div class="error-actions">
            <button class="retry-button" @click="retryRender">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13.65 2.35A8 8 0 1 0 16 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M16 4V8H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              重试 ({{ retryCount }}/{{ maxRetries }})
            </button>
            <button class="details-button" @click="showErrorDetails">
              查看详情
            </button>
          </div>
        </div>
      </Transition>

      <!-- 图表容器 -->
      <div 
        v-show="!isLoading && !hasError"
        class="chart-container"
        ref="chartRef"
        :id="chartId"
      ></div>
    </div>

    <!-- 性能指标 -->
    <div class="performance-metrics" v-if="showMetrics && !isLoading && !hasError">
      <div class="metric-item">
        <span class="metric-label">渲染时间</span>
        <span class="metric-value">{{ renderTime }}ms</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">图表大小</span>
        <span class="metric-value">{{ chartSize }}</span>
      </div>
      <div class="metric-item" v-if="fromCache">
        <span class="metric-label">缓存</span>
        <span class="metric-value cache">已缓存</span>
      </div>
    </div>

    <!-- 全屏遮罩 -->
    <Transition name="fullscreen">
      <div v-if="isFullscreen" class="fullscreen-overlay" @click="closeFullscreen">
        <div class="fullscreen-content" @click.stop>
          <div class="fullscreen-header">
            <h3 class="fullscreen-title">{{ chartType.toUpperCase() }} 图表</h3>
            <button class="fullscreen-close" @click="closeFullscreen">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="fullscreen-chart" ref="fullscreenChartRef"></div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { asyncChartRenderer } from '@/utils/asyncChartRenderer'
import { liquidGlass } from '@/utils/liquidGlass'
import { showSuccess, showError } from '@/utils/appleNotification'

// Props
interface Props {
  chartType: 'mermaid' | 'plantuml' | 'kroki'
  chartCode: string
  enableLiquidGlass?: boolean
  showToolbar?: boolean
  showMetrics?: boolean
  showProgress?: boolean
  timeout?: number
  maxRetries?: number
  cacheEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enableLiquidGlass: true,
  showToolbar: true,
  showMetrics: true,
  showProgress: true,
  timeout: 10000,
  maxRetries: 3,
  cacheEnabled: true
})

// Emits
const emit = defineEmits<{
  rendered: [success: boolean, renderTime: number]
  error: [error: Error]
  retry: [attempt: number]
}>()

// 响应式状态
const containerRef = ref<HTMLElement>()
const chartContentRef = ref<HTMLElement>()
const chartRef = ref<HTMLElement>()
const fullscreenChartRef = ref<HTMLElement>()

const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const retryCount = ref(0)
const renderTime = ref(0)
const chartSize = ref('')
const fromCache = ref(false)
const isFullscreen = ref(false)
const progress = ref(0)

// 生成唯一ID
const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// 计算属性
const statusClass = computed(() => {
  if (isLoading.value) return 'loading'
  if (hasError.value) return 'error'
  return 'success'
})

const statusText = computed(() => {
  if (isLoading.value) return '渲染中...'
  if (hasError.value) return '渲染失败'
  return '渲染完成'
})

const loadingText = computed(() => {
  const texts = {
    mermaid: '正在渲染 Mermaid 图表...',
    plantuml: '正在渲染 PlantUML 图表...',
    kroki: '正在渲染 Kroki 图表...'
  }
  return texts[props.chartType] || '正在渲染图表...'
})

// 方法
const renderChart = async () => {
  if (!chartRef.value) return

  isLoading.value = true
  hasError.value = false
  progress.value = 0
  
  // 模拟进度更新
  const progressInterval = setInterval(() => {
    if (progress.value < 90) {
      progress.value += Math.random() * 20
    }
  }, 200)

  try {
    const startTime = performance.now()
    
    const result = await asyncChartRenderer.renderChart({
      type: props.chartType,
      content: props.chartCode,
      containerId: chartId,
      timeout: props.timeout,
      retryCount: props.maxRetries,
      cacheEnabled: props.cacheEnabled
    })

    const endTime = performance.now()
    renderTime.value = Math.round(endTime - startTime)
    fromCache.value = result.cached || false
    
    // 计算图表大小
    const chartElement = chartRef.value.querySelector('svg, img, canvas')
    if (chartElement) {
      const rect = chartElement.getBoundingClientRect()
      chartSize.value = `${Math.round(rect.width)}×${Math.round(rect.height)}`
    }

    progress.value = 100
    emit('rendered', true, renderTime.value)
    
    if (!fromCache.value) {
      showSuccess('图表渲染完成', `${props.chartType.toUpperCase()} 图表已成功渲染`)
    }

  } catch (error) {
    hasError.value = true
    errorMessage.value = error instanceof Error ? error.message : '未知错误'
    emit('error', error instanceof Error ? error : new Error('渲染失败'))
    
    showError('图表渲染失败', errorMessage.value)
  } finally {
    clearInterval(progressInterval)
    isLoading.value = false
    progress.value = 0
  }
}

const refreshChart = async () => {
  retryCount.value = 0
  await renderChart()
}

const retryRender = async () => {
  if (retryCount.value < props.maxRetries) {
    retryCount.value++
    emit('retry', retryCount.value)
    await renderChart()
  }
}

const exportChart = () => {
  if (!chartRef.value || hasError.value) return

  const chartElement = chartRef.value.querySelector('svg')
  if (chartElement) {
    // 导出SVG
    const svgData = new XMLSerializer().serializeToString(chartElement)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.chartType}-chart-${Date.now()}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showSuccess('图表已导出', '图表已成功导出为 SVG 文件')
  }
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  
  if (isFullscreen.value) {
    nextTick(() => {
      if (fullscreenChartRef.value && chartRef.value) {
        // 克隆图表到全屏容器
        const chartClone = chartRef.value.cloneNode(true) as HTMLElement
        fullscreenChartRef.value.innerHTML = ''
        fullscreenChartRef.value.appendChild(chartClone)
      }
    })
  }
}

const closeFullscreen = () => {
  isFullscreen.value = false
}

const showErrorDetails = () => {
  console.error('Chart render error details:', {
    chartType: props.chartType,
    chartCode: props.chartCode,
    errorMessage: errorMessage.value,
    retryCount: retryCount.value
  })
  
  showError('错误详情', '详细错误信息已输出到控制台')
}

// 监听图表代码变化
watch(() => props.chartCode, () => {
  if (props.chartCode) {
    renderChart()
  }
}, { immediate: true })

// 生命周期
onMounted(async () => {
  // 应用Liquid Glass效果
  await nextTick()
  if (containerRef.value && props.enableLiquidGlass) {
    liquidGlass.applyLiquidGlass(containerRef.value, {
      opacity: 0.95,
      blur: 15,
      borderRadius: 12
    })
  }
})

onUnmounted(() => {
  // 清理Liquid Glass效果
  if (containerRef.value && props.enableLiquidGlass) {
    liquidGlass.removeLiquidGlass(containerRef.value)
  }
})

// 暴露方法
defineExpose({
  renderChart,
  refreshChart,
  exportChart,
  toggleFullscreen,
  retryRender
})
</script>

<style scoped>
.enhanced-chart-container {
  position: relative;
  min-height: 200px;
  border-radius: 12px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'PingFang SC', sans-serif;
}

.chart-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}

.chart-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  color: #1d1d1f;
  text-align: center;
  padding: 40px 20px;
}

.loading-spinner {
  position: relative;
  width: 60px;
  height: 60px;
  margin-bottom: 20px;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-top: 3px solid #007AFF;
  border-radius: 50%;
  animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

.spinner-ring:nth-child(1) { animation-delay: -0.45s; }
.spinner-ring:nth-child(2) { animation-delay: -0.3s; }
.spinner-ring:nth-child(3) { animation-delay: -0.15s; }

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: #1d1d1f;
}

.loading-progress {
  width: 200px;
  height: 4px;
  background: rgba(0, 122, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #007AFF, #5856D6);
  border-radius: 2px;
  transition: width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.chart-content {
  position: relative;
  z-index: 5;
  padding: 20px;
  min-height: 200px;
}

.chart-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  padding: 40px 20px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  color: #c62828;
  margin-bottom: 8px;
}

.error-message {
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
  max-width: 300px;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.retry-button, .details-button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button {
  background: #007AFF;
  color: white;
}

.retry-button:hover:not(:disabled) {
  background: #0056CC;
  transform: translateY(-1px);
}

.retry-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.details-button {
  background: rgba(142, 142, 147, 0.1);
  color: #8E8E93;
}

.details-button:hover {
  background: rgba(142, 142, 147, 0.2);
}

.error-details {
  max-width: 400px;
  text-align: left;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 16px;
  backdrop-filter: blur(10px);
}

.details-header {
  font-weight: 600;
  margin-bottom: 12px;
  color: #1d1d1f;
}

.details-content div {
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}

.performance-metrics {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 12px;
  z-index: 15;
}

.metrics-item {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metrics-label {
  color: #666;
  font-weight: 500;
}

.metrics-value {
  color: #1d1d1f;
  font-weight: 600;
}

.chart-toolbar {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 15;
}

.toolbar-button {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s ease;
}

.toolbar-button:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}

/* 过渡动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.shake-enter-active {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .enhanced-chart-container {
    border-radius: 8px;
  }
  
  .chart-loading, .chart-error {
    padding: 20px 16px;
  }
  
  .loading-text {
    font-size: 14px;
  }
  
  .error-title {
    font-size: 18px;
  }
  
  .error-actions {
    flex-direction: column;
    width: 100%;
    max-width: 200px;
  }
  
  .performance-metrics {
    position: static;
    margin: 12px;
    justify-content: center;
  }
  
  .chart-toolbar {
    position: static;
    margin: 12px;
    justify-content: center;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .loading-text, .details-header {
    color: #f5f5f7;
  }
  
  .error-details {
    background: rgba(28, 28, 30, 0.8);
  }
  
  .details-content div {
    color: #a1a1a6;
  }
  
  .metrics-item, .toolbar-button {
    background: rgba(28, 28, 30, 0.9);
  }
  
  .metrics-label {
    color: #a1a1a6;
  }
  
  .metrics-value {
    color: #f5f5f7;
  }
}

/* 无障碍设计 */
@media (prefers-reduced-motion: reduce) {
  .spinner-ring {
    animation: none;
  }
  
  .fade-enter-active, .fade-leave-active,
  .slide-fade-enter-active, .slide-fade-leave-active {
    transition: none;
  }
  
  .shake-enter-active {
    animation: none;
  }
}
</style>