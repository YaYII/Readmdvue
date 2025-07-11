<template>
  <div 
    class="performance-monitor"
    :class="{ 
      'liquid-glass': liquidGlassEnabled,
      'expanded': isExpanded,
      'minimized': isMinimized
    }"
  >
    <!-- 主要指标显示 -->
    <div class="monitor-header" @click="toggleExpanded">
      <div class="header-left">
        <div class="status-indicator" :class="performanceStatus"></div>
        <h3 class="monitor-title">性能监控</h3>
        <div class="quick-stats">
          <span class="stat-item">
            <span class="stat-label">FPS:</span>
            <span class="stat-value" :class="fpsClass">{{ currentFPS }}</span>
          </span>
          <span class="stat-item">
            <span class="stat-label">内存:</span>
            <span class="stat-value">{{ formatBytes(memoryUsage) }}</span>
          </span>
        </div>
      </div>
      <div class="header-right">
        <button 
          class="control-button"
          @click.stop="toggleMinimized"
          :title="isMinimized ? '展开' : '最小化'"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path v-if="isMinimized" d="M3 8h10M8 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path v-else d="M4 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button 
          class="control-button"
          @click.stop="toggleExpanded"
          :title="isExpanded ? '收起详情' : '展开详情'"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path :d="isExpanded ? 'M12 10l-4-4-4 4' : 'M4 6l4 4 4-4'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 详细指标 (展开时显示) -->
    <Transition name="expand">
      <div v-if="isExpanded && !isMinimized" class="monitor-details">
        <!-- 性能指标网格 -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-icon">⚡</span>
              <span class="metric-title">帧率</span>
            </div>
            <div class="metric-value large" :class="fpsClass">{{ currentFPS }}</div>
            <div class="metric-subtitle">FPS</div>
            <div class="metric-trend" :class="fpsTrend">
              {{ fpsTrendText }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-icon">🧠</span>
              <span class="metric-title">内存使用</span>
            </div>
            <div class="metric-value large">{{ formatBytes(memoryUsage) }}</div>
            <div class="metric-subtitle">当前占用</div>
            <div class="metric-trend" :class="memoryTrend">
              {{ memoryTrendText }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-icon">⏱️</span>
              <span class="metric-title">渲染时间</span>
            </div>
            <div class="metric-value large">{{ averageRenderTime.toFixed(1) }}</div>
            <div class="metric-subtitle">ms</div>
            <div class="metric-trend" :class="renderTimeTrend">
              {{ renderTimeTrendText }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-icon">📊</span>
              <span class="metric-title">DOM 节点</span>
            </div>
            <div class="metric-value large">{{ domNodeCount }}</div>
            <div class="metric-subtitle">个节点</div>
            <div class="metric-trend" :class="domTrend">
              {{ domTrendText }}
            </div>
          </div>
        </div>

        <!-- 性能图表 -->
        <div class="performance-charts">
          <div class="chart-container">
            <h4 class="chart-title">FPS 趋势</h4>
            <div class="chart-wrapper">
              <canvas ref="fpsChart" class="performance-chart"></canvas>
            </div>
          </div>
          
          <div class="chart-container">
            <h4 class="chart-title">内存使用趋势</h4>
            <div class="chart-wrapper">
              <canvas ref="memoryChart" class="performance-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- 性能统计 -->
        <div class="performance-stats">
          <h4 class="stats-title">性能统计</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">平均 FPS:</span>
              <span class="stat-value">{{ averageFPS.toFixed(1) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最低 FPS:</span>
              <span class="stat-value">{{ minFPS }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最高 FPS:</span>
              <span class="stat-value">{{ maxFPS }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">内存峰值:</span>
              <span class="stat-value">{{ formatBytes(maxMemoryUsage) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">运行时间:</span>
              <span class="stat-value">{{ formatDuration(runningTime) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">渲染次数:</span>
              <span class="stat-value">{{ renderCount }}</span>
            </div>
          </div>
        </div>

        <!-- 性能建议 -->
        <div v-if="performanceSuggestions.length > 0" class="performance-suggestions">
          <h4 class="suggestions-title">性能建议</h4>
          <div class="suggestions-list">
            <div 
              v-for="(suggestion, index) in performanceSuggestions" 
              :key="index"
              class="suggestion-item"
              :class="suggestion.type"
            >
              <span class="suggestion-icon">{{ suggestion.icon }}</span>
              <span class="suggestion-text">{{ suggestion.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { liquidGlass } from '@/utils/liquidGlass'
import { showWarning, showInfo } from '@/utils/appleNotification'

// 响应式数据
const isExpanded = ref(false)
const isMinimized = ref(false)
const liquidGlassEnabled = ref(true)

// 性能指标
const currentFPS = ref(60)
const memoryUsage = ref(0)
const averageRenderTime = ref(0)
const domNodeCount = ref(0)
const runningTime = ref(0)

// 历史数据
const fpsHistory = ref<number[]>([])
const memoryHistory = ref<number[]>([])
const renderTimeHistory = ref<number[]>([])

// 统计数据
const averageFPS = ref(60)
const minFPS = ref(60)
const maxFPS = ref(60)
const maxMemoryUsage = ref(0)
const renderCount = ref(0)

// 图表引用
const fpsChart = ref<HTMLCanvasElement>()
const memoryChart = ref<HTMLCanvasElement>()

// 定时器
let performanceTimer: number | null = null
let chartUpdateTimer: number | null = null
let startTime = Date.now()

// 计算属性
const performanceStatus = computed(() => {
  if (currentFPS.value >= 50) return 'excellent'
  if (currentFPS.value >= 30) return 'good'
  if (currentFPS.value >= 20) return 'fair'
  return 'poor'
})

const fpsClass = computed(() => {
  if (currentFPS.value >= 50) return 'excellent'
  if (currentFPS.value >= 30) return 'good'
  if (currentFPS.value >= 20) return 'warning'
  return 'critical'
})

const fpsTrend = computed(() => {
  if (fpsHistory.value.length < 2) return 'stable'
  const recent = fpsHistory.value.slice(-5)
  const trend = recent[recent.length - 1] - recent[0]
  if (trend > 2) return 'up'
  if (trend < -2) return 'down'
  return 'stable'
})

const fpsTrendText = computed(() => {
  switch (fpsTrend.value) {
    case 'up': return '↗ 上升'
    case 'down': return '↘ 下降'
    default: return '→ 稳定'
  }
})

const memoryTrend = computed(() => {
  if (memoryHistory.value.length < 2) return 'stable'
  const recent = memoryHistory.value.slice(-5)
  const trend = recent[recent.length - 1] - recent[0]
  const threshold = 1024 * 1024 // 1MB
  if (trend > threshold) return 'up'
  if (trend < -threshold) return 'down'
  return 'stable'
})

const memoryTrendText = computed(() => {
  switch (memoryTrend.value) {
    case 'up': return '↗ 增长'
    case 'down': return '↘ 减少'
    default: return '→ 稳定'
  }
})

const renderTimeTrend = computed(() => {
  if (renderTimeHistory.value.length < 2) return 'stable'
  const recent = renderTimeHistory.value.slice(-5)
  const trend = recent[recent.length - 1] - recent[0]
  if (trend > 1) return 'up'
  if (trend < -1) return 'down'
  return 'stable'
})

const renderTimeTrendText = computed(() => {
  switch (renderTimeTrend.value) {
    case 'up': return '↗ 增加'
    case 'down': return '↘ 减少'
    default: return '→ 稳定'
  }
})

const domTrend = computed(() => {
  return 'stable' // 简化处理
})

const domTrendText = computed(() => '→ 稳定')

const performanceSuggestions = computed(() => {
  const suggestions: Array<{type: string, icon: string, text: string}> = []
  
  if (currentFPS.value < 30) {
    suggestions.push({
      type: 'warning',
      icon: '⚠️',
      text: 'FPS 较低，建议减少页面复杂度或关闭一些动画效果'
    })
  }
  
  if (memoryUsage.value > 100 * 1024 * 1024) { // 100MB
    suggestions.push({
      type: 'warning',
      icon: '🧠',
      text: '内存使用较高，建议刷新页面或关闭其他标签页'
    })
  }
  
  if (averageRenderTime.value > 16) {
    suggestions.push({
      type: 'info',
      icon: '⏱️',
      text: '渲染时间较长，可能影响用户体验'
    })
  }
  
  if (domNodeCount.value > 5000) {
    suggestions.push({
      type: 'info',
      icon: '📊',
      text: 'DOM 节点较多，建议优化页面结构'
    })
  }
  
  return suggestions
})

// 方法
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    nextTick(() => {
      updateCharts()
    })
  }
}

const toggleMinimized = () => {
  isMinimized.value = !isMinimized.value
  if (isMinimized.value) {
    isExpanded.value = false
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

const measurePerformance = () => {
  // 测量 FPS
  let lastTime = performance.now()
  let frameCount = 0
  
  const measureFrame = (currentTime: number) => {
    frameCount++
    const deltaTime = currentTime - lastTime
    
    if (deltaTime >= 1000) { // 每秒更新一次
      const fps = Math.round((frameCount * 1000) / deltaTime)
      currentFPS.value = fps
      
      // 更新历史数据
      fpsHistory.value.push(fps)
      if (fpsHistory.value.length > 60) { // 保留最近60个数据点
        fpsHistory.value.shift()
      }
      
      // 更新统计
      const allFPS = fpsHistory.value
      averageFPS.value = allFPS.reduce((a, b) => a + b, 0) / allFPS.length
      minFPS.value = Math.min(...allFPS)
      maxFPS.value = Math.max(...allFPS)
      
      frameCount = 0
      lastTime = currentTime
    }
    
    requestAnimationFrame(measureFrame)
  }
  
  requestAnimationFrame(measureFrame)
}

const measureMemory = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    memoryUsage.value = memory.usedJSHeapSize
    maxMemoryUsage.value = Math.max(maxMemoryUsage.value, memory.usedJSHeapSize)
    
    memoryHistory.value.push(memory.usedJSHeapSize)
    if (memoryHistory.value.length > 60) {
      memoryHistory.value.shift()
    }
  }
}

const measureRenderTime = () => {
  const startTime = performance.now()
  
  requestAnimationFrame(() => {
    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    renderTimeHistory.value.push(renderTime)
    if (renderTimeHistory.value.length > 60) {
      renderTimeHistory.value.shift()
    }
    
    if (renderTimeHistory.value.length > 0) {
      averageRenderTime.value = renderTimeHistory.value.reduce((a, b) => a + b, 0) / renderTimeHistory.value.length
    }
    
    renderCount.value++
  })
}

const measureDOM = () => {
  domNodeCount.value = document.querySelectorAll('*').length
}

const updateCharts = () => {
  if (!fpsChart.value || !memoryChart.value) return
  
  // 简化的图表绘制
  const drawChart = (canvas: HTMLCanvasElement, data: number[], color: string, label: string) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const width = canvas.width = canvas.offsetWidth * 2
    const height = canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    
    ctx.clearRect(0, 0, width / 2, height / 2)
    
    if (data.length < 2) return
    
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * (width / 2 - 40) + 20
      const y = height / 2 - 20 - ((value - min) / range) * (height / 2 - 40)
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    ctx.stroke()
  }
  
  drawChart(fpsChart.value, fpsHistory.value, '#007AFF', 'FPS')
  drawChart(memoryChart.value, memoryHistory.value.map(m => m / 1024 / 1024), '#30D158', 'Memory (MB)')
}

const startMonitoring = () => {
  measurePerformance()
  
  performanceTimer = window.setInterval(() => {
    measureMemory()
    measureRenderTime()
    measureDOM()
    runningTime.value = Date.now() - startTime
    
    // 检查性能问题并发送通知
    if (currentFPS.value < 20 && fpsHistory.value.length > 5) {
      const recentLowFPS = fpsHistory.value.slice(-5).every(fps => fps < 20)
      if (recentLowFPS) {
        showWarning('性能警告', '检测到持续的低帧率，建议优化页面性能')
      }
    }
    
    if (memoryUsage.value > 200 * 1024 * 1024) { // 200MB
      showWarning('内存警告', '内存使用过高，建议刷新页面')
    }
  }, 1000)
  
  chartUpdateTimer = window.setInterval(() => {
    if (isExpanded.value) {
      updateCharts()
    }
  }, 2000)
}

const stopMonitoring = () => {
  if (performanceTimer) {
    clearInterval(performanceTimer)
    performanceTimer = null
  }
  if (chartUpdateTimer) {
    clearInterval(chartUpdateTimer)
    chartUpdateTimer = null
  }
}

// 生命周期
onMounted(() => {
  if (liquidGlassEnabled.value) {
    const monitor = document.querySelector('.performance-monitor') as HTMLElement
    if (monitor) {
      liquidGlass.applyLiquidGlass(monitor, {
        opacity: 0.9,
        blur: 15,
        brightness: 1.1,
        contrast: 1.1,
        saturation: 1.2
      })
    }
  }
  
  startMonitoring()
  
  showInfo('性能监控', '性能监控已启动，正在收集数据...')
})

onUnmounted(() => {
  stopMonitoring()
  
  if (liquidGlassEnabled.value) {
    liquidGlass.remove(document.querySelector('.performance-monitor'))
  }
})
</script>

<style scoped>
/* 过渡动画 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.slide-fade-enter-from {
  transform: translateX(100%) scale(0.95);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(100%) scale(0.95);
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
}

.expand-enter-to,
.expand-leave-from {
  max-height: 1000px;
  opacity: 1;
  transform: translateY(0);
}

/* 主容器 */
.performance-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  max-height: calc(100vh - 40px);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  overflow: hidden;
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI Variable', sans-serif;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.performance-monitor.minimized {
  width: 280px;
}

/* 快速统计样式 */
.quick-stats {
  display: flex;
  gap: 12px;
  margin-left: 8px;
}

.quick-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.quick-stats .stat-label {
  color: #8E8E93;
  font-weight: 500;
}

.quick-stats .stat-value {
  font-weight: 600;
  color: #1D1D1F;
}

.quick-stats .stat-value.excellent {
  color: #30D158;
}

.quick-stats .stat-value.good {
  color: #007AFF;
}

.quick-stats .stat-value.warning {
  color: #FF9500;
}

.quick-stats .stat-value.critical {
  color: #FF3B30;
}

@media (prefers-color-scheme: dark) {
  .quick-stats .stat-value {
    color: #F5F5F7;
  }
}

/* 控制按钮样式 */
.control-button {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #8E8E93;
}

.control-button:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #1D1D1F;
}

@media (prefers-color-scheme: dark) {
  .control-button {
    background: rgba(255, 255, 255, 0.1);
    color: #8E8E93;
  }
  
  .control-button:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #F5F5F7;
  }
}

/* 详细监控区域 */
.monitor-details {
  padding: 0 20px 20px;
}

/* 指标卡片样式 */
.metric-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.metric-title {
  font-size: 12px;
  font-weight: 600;
  color: #8E8E93;
}

.metric-value.large {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}

.metric-subtitle {
  font-size: 10px;
  color: #8E8E93;
  font-weight: 500;
  margin-bottom: 6px;
}

.metric-trend {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

.metric-trend.up {
  background: rgba(48, 209, 88, 0.1);
  color: #30D158;
}

.metric-trend.down {
  background: rgba(255, 59, 48, 0.1);
  color: #FF3B30;
}

.metric-trend.stable {
  background: rgba(142, 142, 147, 0.1);
  color: #8E8E93;
}

/* 图表区域 */
.performance-charts {
  margin-bottom: 24px;
}

.chart-container {
  margin-bottom: 16px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #1D1D1F;
  margin: 0 0 8px 0;
}

.chart-wrapper {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 12px;
}

@media (prefers-color-scheme: dark) {
  .chart-title {
    color: #F5F5F7;
  }
  
  .chart-wrapper {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}

/* 统计区域 */
.performance-stats {
  margin-bottom: 24px;
}

.stats-title {
  font-size: 14px;
  font-weight: 600;
  color: #1D1D1F;
  margin: 0 0 12px 0;
}

@media (prefers-color-scheme: dark) {
  .stats-title {
    color: #F5F5F7;
  }
}

/* 建议区域 */
.performance-suggestions {
  margin-bottom: 16px;
}

.suggestions-title {
  font-size: 14px;
  font-weight: 600;
  color: #1D1D1F;
  margin: 0 0 12px 0;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.suggestion-item:hover {
  background: rgba(255, 255, 255, 0.6);
  transform: translateY(-1px);
}

.suggestion-item.warning {
  border-left: 3px solid #FF9500;
}

.suggestion-item.info {
  border-left: 3px solid #007AFF;
}

.suggestion-icon {
  font-size: 16px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.suggestion-text {
  flex: 1;
  font-size: 12px;
  color: #1D1D1F;
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .suggestions-title {
    color: #F5F5F7;
  }
  
  .suggestion-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .suggestion-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  .suggestion-text {
    color: #F5F5F7;
  }
}

.performance-monitor.expanded {
  width: 400px;
}

.performance-monitor.liquid-glass {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(25px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.05);
}

@media (prefers-color-scheme: dark) {
  .performance-monitor {
    background: rgba(28, 28, 30, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  
  .performance-monitor.liquid-glass {
    background: rgba(28, 28, 30, 0.9);
    backdrop-filter: blur(25px) saturate(1.2);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 
      0 12px 40px rgba(0, 0, 0, 0.4),
      0 4px 16px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  }
}

/* 头部区域 */
.monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.monitor-header:hover {
  background: rgba(0, 0, 0, 0.02);
}

@media (prefers-color-scheme: dark) {
  .monitor-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .monitor-header:hover {
    background: rgba(255, 255, 255, 0.03);
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.status-indicator.excellent {
  background: #30D158;
  box-shadow: 0 0 8px rgba(48, 209, 88, 0.4);
}

.status-indicator.good {
  background: #007AFF;
  box-shadow: 0 0 8px rgba(0, 122, 255, 0.4);
}

.status-indicator.fair {
  background: #FF9500;
  box-shadow: 0 0 8px rgba(255, 149, 0, 0.4);
}

.status-indicator.poor {
  background: #FF3B30;
  box-shadow: 0 0 8px rgba(255, 59, 48, 0.4);
}

.monitor-title {
  font-size: 16px;
  font-weight: 600;
  color: #1D1D1F;
  margin: 0;
  letter-spacing: -0.01em;
}

@media (prefers-color-scheme: dark) {
  .monitor-title {
    color: #F5F5F7;
  }
}

.performance-badge {
  padding: 4px 8px;
  background: rgba(0, 122, 255, 0.1);
  color: #007AFF;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}



/* 指标网格 */
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px 20px;
}

.metric-card {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 10px;
}

.metric-card:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  .metric-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .metric-card:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.metric-icon {
  font-size: 18px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-content {
  flex: 1;
  min-width: 0;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: #1D1D1F;
  line-height: 1.2;
}

.metric-label {
  font-size: 11px;
  color: #8E8E93;
  margin-top: 2px;
  font-weight: 500;
}

@media (prefers-color-scheme: dark) {
  .metric-value {
    color: #F5F5F7;
  }
}

/* 展开内容 */
.expanded-content {
  padding: 0 20px 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1D1D1F;
  margin: 0 0 12px 0;
  letter-spacing: -0.01em;
}

@media (prefers-color-scheme: dark) {
  .section-title {
    color: #F5F5F7;
  }
}

/* 图表区域 */
.chart-section {
  margin-bottom: 24px;
}

.performance-chart {
  width: 100%;
  height: 120px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@media (prefers-color-scheme: dark) {
  .performance-chart {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}

/* 统计区域 */
.stats-section {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@media (prefers-color-scheme: dark) {
  .stat-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.stat-label {
  font-size: 12px;
  color: #8E8E93;
  font-weight: 500;
}

.stat-value {
  font-size: 12px;
  font-weight: 600;
  color: #1D1D1F;
}

.stat-value.error {
  color: #FF3B30;
}

.stat-value.success {
  color: #30D158;
}

@media (prefers-color-scheme: dark) {
  .stat-value {
    color: #F5F5F7;
  }
}

/* 建议区域 */
.suggestions-section {
  margin-bottom: 24px;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
}

.suggestion-item:hover {
  background: rgba(255, 255, 255, 0.6);
  transform: translateY(-1px);
}

.suggestion-item.high {
  border-left: 3px solid #FF3B30;
}

.suggestion-item.medium {
  border-left: 3px solid #FF9500;
}

.suggestion-item.low {
  border-left: 3px solid #30D158;
}

@media (prefers-color-scheme: dark) {
  .suggestion-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .suggestion-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

.suggestion-icon {
  font-size: 16px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.suggestion-content {
  flex: 1;
  min-width: 0;
}

.suggestion-title {
  font-size: 13px;
  font-weight: 600;
  color: #1D1D1F;
  margin-bottom: 4px;
  line-height: 1.3;
}

.suggestion-description {
  font-size: 11px;
  color: #8E8E93;
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .suggestion-title {
    color: #F5F5F7;
  }
}

/* 操作按钮 */
.actions-section {
  display: flex;
  gap: 8px;
}

.action-button {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.action-button.primary {
  background: #007AFF;
  color: white;
}

.action-button.primary:hover {
  background: #0056CC;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.action-button.secondary {
  background: rgba(0, 0, 0, 0.05);
  color: #1D1D1F;
}

.action-button.secondary:hover {
  background: rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

@media (prefers-color-scheme: dark) {
  .action-button.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #F5F5F7;
  }
  
  .action-button.secondary:hover {
    background: rgba(255, 255, 255, 0.15);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .performance-monitor {
    position: fixed;
    top: 10px;
    right: 10px;
    left: 10px;
    width: auto;
    max-width: none;
  }
  
  .performance-monitor.expanded {
    width: auto;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .metric-card {
    padding: 10px;
  }
}

/* 滚动条样式 */
.performance-monitor::-webkit-scrollbar {
  width: 4px;
}

.performance-monitor::-webkit-scrollbar-track {
  background: transparent;
}

.performance-monitor::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.performance-monitor::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  .performance-monitor::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .performance-monitor::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}

/* 无障碍支持 */
@media (prefers-reduced-motion: reduce) {
  .performance-monitor,
  .metric-card,
  .suggestion-item,
  .action-button,
  .expand-button,
  .close-button {
    transition: none;
  }
  
  .slide-fade-enter-active,
  .slide-fade-leave-active,
  .expand-enter-active,
  .expand-leave-active {
    transition: none;
  }
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .performance-monitor {
    border: 2px solid #000;
  }
  
  .metric-card,
  .stat-item,
  .suggestion-item {
    border: 1px solid #000;
  }
  
  @media (prefers-color-scheme: dark) {
    .performance-monitor {
      border: 2px solid #fff;
    }
    
    .metric-card,
    .stat-item,
    .suggestion-item {
      border: 1px solid #fff;
    }
  }
}
</style>