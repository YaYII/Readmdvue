import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MarkdownConfig, PluginState, LogEntry } from '../types'
import { defaultConfig } from '../types'
import { configThrottleManager } from '../utils/configThrottle'

export const usePluginStore = defineStore('plugin', () => {
  // 状态定义
  const state = ref<PluginState>({
    isActive: false,
    isMarkdownFile: false,
    config: { ...defaultConfig },
    lastError: null
  })

  const logs = ref<LogEntry[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const currentConfig = computed(() => state.value.config)
  const isMarkdownActive = computed(() => state.value.isActive && state.value.isMarkdownFile)
  const recentLogs = computed(() => logs.value.slice(-50)) // 只保留最近50条日志

  // 扩展上下文检查
  const checkExtensionContext = (): boolean => {
    try {
      return !!(chrome?.runtime?.id)
    } catch {
      return false
    }
  }

  // 实际的配置更新函数
  const performConfigUpdate = async (configUpdates: Partial<MarkdownConfig>) => {
    if (!checkExtensionContext()) {
      throw new Error('扩展上下文无效，无法更新配置')
    }

    // 更新本地状态
    state.value.config = { ...state.value.config, ...configUpdates }
    
    // 保存到chrome.storage
    try {
      await chrome.storage.sync.set({ 'markdown-config': state.value.config })
    } catch (err) {
      addLog('warn', '保存配置到存储失败', err)
      // 不抛出错误，允许继续执行
    }
    
    // 通知content script更新配置
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_CONFIG',
          payload: state.value.config
        })
      }
    } catch (err) {
      addLog('warn', '发送配置更新消息失败', err)
      // 不抛出错误，配置已更新到本地状态
    }
    
    addLog('info', '配置已更新', configUpdates)
  }

  // 动作
  const updateConfig = async (newConfig: Partial<MarkdownConfig>) => {
    try {
      if (!checkExtensionContext()) {
        throw new Error('扩展上下文无效，请重新加载扩展')
      }

      isLoading.value = true
      
      // 使用节流管理器来处理配置更新
      await configThrottleManager.throttleUpdate(newConfig, performConfigUpdate)
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '更新配置失败'
      error.value = errorMsg
      addLog('error', errorMsg, err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const loadConfig = async () => {
    try {
      if (!checkExtensionContext()) {
        addLog('warn', '检测到扩展上下文失效，你的配置列表中没有主题选项。使用默认配置')
        // 即使扩展上下文失效，也要确保有基本配置
        state.value.config = { ...defaultConfig }
        return
      }

      isLoading.value = true
      const result = await chrome.storage.sync.get('markdown-config')
      if (result['markdown-config']) {
        // 确保加载的配置包含所有必要字段，特别是主题选项
        state.value.config = { 
          ...defaultConfig, 
          ...result['markdown-config'],
          // 确保主题字段存在
          theme: result['markdown-config'].theme || defaultConfig.theme
        }
      } else {
        // 如果没有保存的配置，使用默认配置
        state.value.config = { ...defaultConfig }
      }
      addLog('info', '配置已加载', { theme: state.value.config.theme })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载配置失败'
      error.value = errorMsg
      addLog('error', errorMsg, err)
      // 确保即使加载失败也有基本配置
      state.value.config = { ...defaultConfig }
    } finally {
      isLoading.value = false
    }
  }

  const updateState = (newState: Partial<PluginState>) => {
    state.value = { ...state.value, ...newState }
  }

  const addLog = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data
    }
    logs.value.push(logEntry)
    
    // 限制日志数量，避免内存泄漏
    if (logs.value.length > 100) {
      logs.value = logs.value.slice(-50)
    }
  }

  const clearLogs = () => {
    logs.value = []
  }

  const clearError = () => {
    error.value = null
  }

  const checkCurrentTab = async () => {
    try {
      if (!checkExtensionContext()) {
        addLog('warn', '扩展上下文无效，无法检查当前标签页')
        return
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]) {
        const url = tabs[0].url || ''
        const isMarkdown = /\.(md|markdown)$/i.test(url) || 
                          url.includes('github.com') && url.includes('.md')
        
        updateState({
          isMarkdownFile: isMarkdown,
          isActive: isMarkdown
        })
        
        addLog('info', `检查当前标签页: ${isMarkdown ? 'Markdown文件' : '非Markdown文件'}`, { url })
      }
    } catch (err) {
      addLog('error', '检查当前标签页失败', err)
    }
  }

  // 强制立即更新配置（用于关键操作）
  const forceUpdateConfig = async (newConfig: Partial<MarkdownConfig>) => {
    try {
      if (!checkExtensionContext()) {
        throw new Error('扩展上下文无效，请重新加载扩展')
      }

      isLoading.value = true
      await configThrottleManager.forceUpdate(performConfigUpdate)
      await performConfigUpdate(newConfig)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '强制更新配置失败'
      error.value = errorMsg
      addLog('error', errorMsg, err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 初始化
  const initialize = async () => {
    try {
      if (!checkExtensionContext()) {
        addLog('error', '检测到扩展上下文失效，你的配置列表中没有主题选项。无法修改')
        error.value = '扩展上下文失效，请重新加载扩展或刷新页面'
        // 即使上下文失效，也要加载基本配置
        await loadConfig()
        return
      }

      await loadConfig()
      await checkCurrentTab()
      addLog('info', 'Plugin store 初始化完成')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '初始化失败'
      addLog('error', errorMsg, err)
      error.value = errorMsg
      // 确保有基本配置
      state.value.config = { ...defaultConfig }
    }
  }

  return {
    // 状态
    state,
    logs,
    isLoading,
    error,
    
    // 计算属性
    currentConfig,
    isMarkdownActive,
    recentLogs,
    
    // 动作
    updateConfig,
    loadConfig,
    updateState,
    addLog,
    clearLogs,
    clearError,
    checkCurrentTab,
    forceUpdateConfig,
    initialize,
    checkExtensionContext
  }
})