/**
 * Markdown状态管理 - Pinia Store
 * 基于苹果设计哲学的状态管理架构
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { 
  MarkdownConfig, 
  RenderState, 
  DocumentInfo, 
  PerformanceMetrics,
  RenderError
} from '../types'
import { defaultConfig } from '../types'
import { MarkdownRenderer } from '../utils/markdownRenderer'

export const useMarkdownStore = defineStore('markdown', () => {
  // 状态定义
  const config = ref<MarkdownConfig>({ ...defaultConfig })
  const renderState = ref<RenderState>({
    isRendering: false,
    lastRenderTime: 0,
    renderCount: 0,
    errors: []
  })
  const documentInfo = ref<DocumentInfo | null>(null)
  const performanceMetrics = ref<PerformanceMetrics>({
    renderTime: 0,
    averageRenderTime: 0,
    chartCount: 0,
    mathCount: 0,
    imageCount: 0,
    codeBlockCount: 0,
    memoryUsage: 0,
    peakMemory: 0,
    domNodes: 0,
    totalElements: 0,
    chartsRendered: 0,
    chartRenderTime: 0,
    totalRenders: 0,
    errorCount: 0,
    cacheHitRate: 0,
    networkRequests: 0,
    documentSize: 0,
    uptime: 0
  })
  const errors = ref<RenderError[]>([])
  const renderer = ref<MarkdownRenderer | null>(null)
  
  // 计算属性
  const isReady = computed(() => renderer.value !== null)
  const hasErrors = computed(() => errors.value.length > 0)
  const averageRenderTime = computed(() => {
    if (renderState.value.renderCount === 0) return 0
    return performanceMetrics.value.renderTime / renderState.value.renderCount
  })
  const totalElements = computed(() => {
    const metrics = performanceMetrics.value
    return metrics.chartCount + metrics.mathCount + metrics.imageCount + metrics.codeBlockCount
  })
  
  // 主题相关计算属性
  const isDarkMode = computed(() => {
    if (config.value.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return config.value.theme === 'dark'
  })
  
  const currentThemeClass = computed(() => {
    return isDarkMode.value ? 'theme-dark' : 'theme-light'
  })
  
  // 动作方法
  const initializeRenderer = () => {
    try {
      renderer.value = new MarkdownRenderer(config.value)
      console.log('Markdown渲染器初始化成功')
    } catch (error) {
      console.error('Markdown渲染器初始化失败:', error)
      addError({
        type: 'general',
        message: '渲染器初始化失败',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: Date.now(),
        context: { config: config.value }
      })
    }
  }
  
  const updateConfig = (newConfig: Partial<MarkdownConfig>) => {
    const oldConfig = { ...config.value }
    config.value = { ...config.value, ...newConfig }
    
    // 更新渲染器配置
    if (renderer.value) {
      renderer.value.updateConfig(config.value)
    }
    
    // 如果强调色发生变化，应用到DOM
    if (newConfig.accentColor && newConfig.accentColor !== oldConfig.accentColor) {
      applyAccentColor(newConfig.accentColor)
    }
    
    // 保存到本地存储
    saveConfigToStorage()
    
    console.log('配置已更新:', { old: oldConfig, new: config.value })
  }
  
  const applyAccentColor = (accentColor: string) => {
    // 移除之前的强调色类
    const allAccentClasses = ['accent-blue', 'accent-purple', 'accent-pink', 'accent-red', 'accent-orange', 'accent-yellow', 'accent-green', 'accent-graphite']
    document.documentElement.classList.remove(...allAccentClasses)
    
    // 添加新的强调色类
    document.documentElement.classList.add(`accent-${accentColor}`)
    
    console.log(`强调色已应用: ${accentColor}`)
  }
  
  const renderMarkdown = async (content: string): Promise<string> => {
    if (!renderer.value) {
      throw new Error('渲染器未初始化')
    }
    
    const startTime = performance.now()
    renderState.value.isRendering = true
    renderState.value.errors = []
    
    try {
      const result = await renderer.value.render(content)
      
      if (!result.success) {
        throw new Error(result.error || '渲染失败')
      }
      
      // 更新文档信息
      updateDocumentInfo(content, result.content || '')
      
      // 更新性能指标
      const renderTime = performance.now() - startTime
      updatePerformanceMetrics(renderTime, result.content || '')
      
      // 更新渲染状态
      renderState.value.lastRenderTime = Date.now()
      renderState.value.renderCount++
      
      console.log(`Markdown渲染完成，耗时: ${renderTime.toFixed(2)}ms`)
      
      return result.content || ''
      
    } catch (error) {
      const errorInfo: RenderError = {
        type: 'general',
        message: error instanceof Error ? error.message : '未知渲染错误',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: Date.now(),
        context: { contentLength: content.length }
      }
      
      addError(errorInfo)
      renderState.value.errors.push(errorInfo.message)
      
      throw error
      
    } finally {
      renderState.value.isRendering = false
    }
  }
  
  const renderCharts = async (): Promise<void> => {
    // 图表渲染现在由MarkdownRenderer统一处理，无需单独调用
    console.log('图表渲染由MarkdownRenderer自动处理')
  }
  
  const updateDocumentInfo = (content: string, _renderedHtml: string) => {
    const wordCount = content.replace(/\s+/g, ' ').trim().split(' ').length
    const readingTime = Math.ceil(wordCount / 200) // 假设每分钟200字
    
    // 提取标题
    const headings = extractHeadings(content)
    
    documentInfo.value = {
      title: extractTitle(content) || '未命名文档',
      url: window.location.href,
      content,
      lastModified: Date.now(),
      wordCount,
      readingTime,
      headings
    }
  }
  
  const updatePerformanceMetrics = (renderTime: number, html: string) => {
    const chartCount = (html.match(/class="[^"]*chart[^"]*"/g) || []).length
    const mathCount = (html.match(/class="[^"]*math[^"]*"/g) || []).length
    const imageCount = (html.match(/<img/g) || []).length
    const codeBlockCount = (html.match(/<pre/g) || []).length
    
    // 更新性能指标
    const currentMetrics = performanceMetrics.value
    const newTotalRenders = currentMetrics.totalRenders + 1
    const newAverageRenderTime = (currentMetrics.averageRenderTime * currentMetrics.totalRenders + renderTime) / newTotalRenders
    
    performanceMetrics.value = {
      ...currentMetrics,
      renderTime,
      averageRenderTime: newAverageRenderTime,
      chartCount,
      mathCount,
      imageCount,
      codeBlockCount,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      totalElements: chartCount + mathCount + imageCount + codeBlockCount,
      chartsRendered: currentMetrics.chartsRendered + chartCount,
      totalRenders: newTotalRenders,
      documentSize: html.length,
      domNodes: document.querySelectorAll('*').length
    }
  }
  
  const extractHeadings = (content: string) => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm
    const headings = []
    let match
    
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      
      headings.push({
        level,
        text,
        id,
        position: match.index
      })
    }
    
    return headings
  }
  
  const extractTitle = (content: string): string | null => {
    const titleMatch = content.match(/^#\s+(.+)$/m)
    return titleMatch ? titleMatch[1].trim() : null
  }
  
  const addError = (error: RenderError) => {
    errors.value.push(error)
    
    // 限制错误数量，避免内存泄漏
    if (errors.value.length > 50) {
      errors.value = errors.value.slice(-25)
    }
  }
  
  const clearErrors = () => {
    errors.value = []
    renderState.value.errors = []
  }
  
  const toggleTheme = () => {
    const themes: Array<'light' | 'dark' | 'auto' | 'eyecare'> = ['light', 'dark', 'auto', 'eyecare']
    const currentIndex = themes.indexOf(config.value.theme)
    const nextIndex = (currentIndex + 1) % themes.length
    updateConfig({ theme: themes[nextIndex] })
  }
  
  const resetConfig = () => {
    config.value = { ...defaultConfig }
    if (renderer.value) {
      renderer.value.updateConfig(config.value)
    }
    saveConfigToStorage()
  }
  
  const saveConfigToStorage = () => {
    try {
      localStorage.setItem('markdown-config', JSON.stringify(config.value))
    } catch (error) {
      console.warn('无法保存配置到本地存储:', error)
    }
  }
  
  const loadConfigFromStorage = () => {
    try {
      const saved = localStorage.getItem('markdown-config')
      if (saved) {
        const savedConfig = JSON.parse(saved)
        config.value = { ...defaultConfig, ...savedConfig }
      }
    } catch (error) {
      console.warn('无法从本地存储加载配置:', error)
    }
  }
  
  const exportConfig = (): string => {
    return JSON.stringify(config.value, null, 2)
  }
  
  const importConfig = (configJson: string): boolean => {
    try {
      const importedConfig = JSON.parse(configJson)
      updateConfig(importedConfig)
      return true
    } catch (error) {
      console.error('配置导入失败:', error)
      return false
    }
  }
  
  // 监听器
  watch(
    () => config.value.theme,
    (newTheme) => {
      // 应用主题到文档
      document.documentElement.setAttribute('data-theme', newTheme)
      
      // 监听系统主题变化
      if (newTheme === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
          document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light')
        }
        mediaQuery.addEventListener('change', handleChange)
        handleChange() // 立即应用
      }
    },
    { immediate: true }
  )
  
  // 初始化
  const initialize = () => {
    loadConfigFromStorage()
    initializeRenderer()
    
    // 应用当前强调色
    if (config.value.accentColor) {
      applyAccentColor(config.value.accentColor)
    }
  }
  
  return {
    // 状态
    config,
    renderState,
    documentInfo,
    performanceMetrics,
    errors,
    
    // 计算属性
    isReady,
    hasErrors,
    averageRenderTime,
    totalElements,
    isDarkMode,
    currentThemeClass,
    
    // 动作
    initialize,
    updateConfig,
    renderMarkdown,
    renderCharts,
    addError,
    clearErrors,
    toggleTheme,
    resetConfig,
    exportConfig,
    importConfig
  }
})