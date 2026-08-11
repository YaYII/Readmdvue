<template>
  <!-- 遮罩层 -->
  <div class="settings-overlay" @click="handleClose">
    <div class="settings-panel" :class="tocLayoutClass" @click.stop>
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
            <span class="label-text">渲染皮肤</span>
            <select 
              :value="config.skin" 
              @change="updateConfig({ skin: ($event.target as HTMLSelectElement).value as any })"
              class="control-select"
            >
              <option value="gov">政府公文（宋体/首行缩进/表头深色）</option>
              <option value="free">自由现代（强调色标题/无缩进）</option>
            </select>
          </label>
          <p class="control-description">政府皮肤按公文规范渲染；自由皮肤充分使用你的强调色设置</p>
        </div>

        <div class="control-item">
          <label class="control-label-full">
            <span class="label-text">强调色</span>
            <div class="accent-color-grid">
              <div 
                v-for="color in accentColors" 
                :key="color.value"
                class="accent-color-option"
                :class="[color.value, { active: config.accentColor === color.value, disabled: isDarkTheme && color.value === 'graphite' }]"
                @click="onAccentClick(color.value)"
                :title="color.value === 'graphite' && isDarkTheme ? color.name + '（深色模式不可用）' : color.name"
                :style="color.value === 'custom' ? { backgroundColor: config.customAccentColor } : {}"
              >
                <!-- 自定义颜色选项显示调色板图标 -->
                <svg v-if="color.value === 'custom'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="13.5" cy="6.5" r=".5"/>
                  <circle cx="17.5" cy="10.5" r=".5"/>
                  <circle cx="8.5" cy="7.5" r=".5"/>
                  <circle cx="6.5" cy="12.5" r=".5"/>
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                </svg>
              </div>
            </div>
          </label>
          
          <!-- 自定义颜色选择器 -->
          <div v-if="config.accentColor === 'custom'" class="custom-color-section">
            <div class="custom-color-picker">
              <span class="color-picker-text">选择自定义颜色</span>
              <div class="color-picker-container">
                <button 
                  type="button"
                  class="color-picker-button"
                  @click="openColorPicker"
                  :style="{ backgroundColor: config.customAccentColor }"
                  title="点击打开调色板"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="13.5" cy="6.5" r=".5"/>
                    <circle cx="17.5" cy="10.5" r=".5"/>
                    <circle cx="8.5" cy="7.5" r=".5"/>
                    <circle cx="6.5" cy="12.5" r=".5"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                  </svg>
                </button>
                <input 
                  v-if="showColorPicker"
                  type="color" 
                  :value="tempColor || config.customAccentColor"
                  @input="handleColorInput"
                  @blur="hideColorPicker"
                  @change="confirmColor"
                  class="color-picker-input"
                  ref="colorInput"
                  title="选择颜色后会自动应用"
                >
                <div class="color-info">
                  <div class="color-preview" :style="{ backgroundColor: config.customAccentColor }"></div>
                  <span class="color-value">{{ config.customAccentColor.toUpperCase() }}</span>
                </div>
              </div>
            </div>
            
            <!-- 常用颜色 -->
            <div class="preset-colors">
              <div class="preset-colors-header">
                <span class="preset-colors-label">常用颜色</span>
                <span class="preset-colors-limit">最多5个</span>
                <button 
                  v-if="favoriteColors.length > 0"
                  @click="clearFavoriteColors"
                  class="clear-favorites-btn"
                  title="清空常用颜色"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
                  </svg>
                </button>
              </div>
              <div class="preset-colors-grid">
                <!-- 常用颜色插槽 -->
                <div 
                  v-for="index in FAVORITE_COLORS_SLOTS" 
                  :key="index"
                  class="preset-color-slot"
                  :class="{ 'has-color': favoriteColors[index - 1] }"
                  @click="handleFavoriteColorClick(index - 1)"
                  @dblclick="handleFavoriteColorDoubleClick(index - 1)"
                  :style="{ backgroundColor: favoriteColors[index - 1] || 'transparent' }"
                  :title="getFavoriteColorSlotTitle(index - 1)"
                >
                  <span v-if="!favoriteColors[index - 1]" class="empty-slot-icon">+</span>
                </div>
              </div>
              <!-- 使用说明 -->
              <div class="preset-colors-help">
                <span class="help-text">💡 单击应用颜色，双击删除颜色</span>
              </div>
            </div>
          </div>
          
          <p class="control-description">选择界面的强调色主题，或自定义您喜欢的颜色</p>
        </div>

        <div class="control-item">
          <label class="control-label-full">
            <span class="label-text">字体大小</span>
            <div class="range-container">
              <input 
                type="range" 
                :value="config.fontSize" 
                @change="updateConfig({ fontSize: Number(($event.target as HTMLInputElement).value) })"
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
                @change="updateConfig({ lineHeight: Number(($event.target as HTMLInputElement).value) })"
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
              <label class="auto-width-toggle" style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--md-text-secondary); cursor: pointer; margin-bottom: 4px;">
                <input
                  type="checkbox"
                  :checked="config.maxWidth === 0"
                  @change="updateConfig({ maxWidth: ($event.target as HTMLInputElement).checked ? 0 : 1200 })"
                  style="accent-color: var(--md-accent-primary); cursor: pointer;"
                >
                自适应（按屏幕宽度自动选择最佳阅读宽度）
              </label>
              <input 
                type="range" 
                :value="config.maxWidth" 
                @change="updateConfig({ maxWidth: Number(($event.target as HTMLInputElement).value) })"
                min="600" 
                max="1200" 
                step="50"
                :disabled="config.maxWidth === 0"
                class="control-range"
              >
              <span class="range-value">{{ config.maxWidth === 0 ? '自适应' : config.maxWidth + 'px' }}</span>
            </div>
          </label>
        </div>
      </div>

      <!-- 渲染功能 -->
      <div class="control-group">
        <h4 class="group-title">渲染功能</h4>
        功能敬请期待  目前仅支持渲染Markdown语法
      </div>

      <!-- 内容功能 -->
      <div class="control-group">
        <h4 class="group-title">内容功能</h4>
        功能敬请期待 
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
        @click="handleDone"
        class="action-button primary"
      >
        完成
      </button>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMarkdownStore } from '../stores/markdown'
import { favoriteColorsManager } from '../utils/favoriteColorsManager'
import { favoriteColorsMigration } from '../utils/favoriteColorsMigration'
import type { MarkdownConfig, AccentColor } from '../types'

// 定义事件
const emit = defineEmits<{
  close: []
}>()

// 使用store
const markdownStore = useMarkdownStore()
const config = computed(() => markdownStore.config)

// 定义ref
const colorInput = ref<HTMLInputElement>()
const showColorPicker = ref(false)
const tempColor = ref('')

// 目录菜单状态监听（用于推拉式布局）
const tocVisible = ref(false)
const tocCollapsed = ref(false)

// 推拉式布局计算属性
const tocLayoutClass = computed(() => {
  const classes = []
  
  if (tocVisible.value) {
    classes.push('toc-visible')
    
    if (tocCollapsed.value) {
      classes.push('toc-collapsed')
    } else {
      classes.push('toc-expanded')
    }
  }
  
  return classes.join(' ')
})

// 常用颜色管理
const favoriteColors = ref<string[]>([])
const FAVORITE_COLORS_SLOTS = 5

// 常用颜色变化监听器
const onFavoriteColorsChange = (colors: string[]) => {
  favoriteColors.value = colors
  console.log('常用颜色已更新:', colors)
}

// 强调色选项
const accentColors = [
  { value: 'blue', name: '蓝色' },
  { value: 'purple', name: '紫色' },
  { value: 'pink', name: '粉色' },
  { value: 'red', name: '红色' },
  { value: 'orange', name: '橙色' },
  { value: 'yellow', name: '黄色' },
  { value: 'green', name: '绿色' },
  { value: 'graphite', name: '石墨色' },
  { value: 'custom', name: '自定义' }
] as const

// 隐藏颜色选择器
const hideColorPicker = () => {
  showColorPicker.value = false
}

// 打开颜色选择器并自动聚焦
const openColorPicker = async () => {
  showColorPicker.value = true
  // 等待DOM更新后自动聚焦颜色选择器
  await nextTick()
  if (colorInput.value) {
    colorInput.value.focus()
    colorInput.value.click() // 在某些浏览器中需要点击才能打开颜色选择器
  }
}

// 处理颜色输入（实时预览）
const handleColorInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  tempColor.value = target.value
  // 实时预览但不保存
  updateCustomColorPreview(target.value)
}

// 确定颜色（change事件时调用）
const confirmColor = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const color = target.value
  
  if (color) {
    await updateCustomColor(color)
    await addToFavoriteColors(color)
    tempColor.value = ''
    showColorPicker.value = false
  }
}

// 添加到常用颜色
const addToFavoriteColors = async (color: string) => {
  try {
    // 检查是否已达到最大限制
    if (favoriteColors.value.length >= FAVORITE_COLORS_SLOTS) {
      console.warn('常用颜色已达到最大限制 (5个)')
      // 可以在这里添加用户提示，比如toast通知
      return
    }
    
    const success = await favoriteColorsManager.addColor(color)
    if (success) {
      console.log('颜色已添加到常用颜色:', color)
    } else {
      console.warn('添加常用颜色失败，可能已存在或达到限制:', color)
    }
  } catch (error) {
    console.error('添加常用颜色时发生错误:', error)
  }
}

// 从常用颜色中移除
const removeFavoriteColor = async (color: string) => {
  try {
    const success = await favoriteColorsManager.removeColor(color)
    if (success) {
      console.log('颜色已从常用颜色中移除:', color)
    } else {
      console.warn('从常用颜色中移除颜色失败:', color)
    }
  } catch (error) {
    console.error('移除常用颜色时发生错误:', error)
  }
}

// 获取常用颜色插槽的标题提示
const getFavoriteColorSlotTitle = (index: number): string => {
  const color = favoriteColors.value[index]
  if (color) {
    return `${color} (双击删除)`
  } else {
    if (favoriteColors.value.length >= FAVORITE_COLORS_SLOTS) {
      return '已达到最大限制 (5个颜色)'
    } else {
      return '空位，点击打开调色板'
    }
  }
}

// 处理常用颜色插槽点击
const handleFavoriteColorClick = (index: number) => {
  const color = favoriteColors.value[index]
  if (color) {
    // 如果插槽有颜色，应用该颜色
    updateCustomColor(color)
  } else {
    // 如果插槽为空，检查是否已达到限制
    if (favoriteColors.value.length >= FAVORITE_COLORS_SLOTS) {
      console.warn('常用颜色已达到最大限制 (5个)')
      return
    }
    // 打开颜色选择器
    openColorPicker()
  }
}

// 处理常用颜色插槽双击
const handleFavoriteColorDoubleClick = (index: number) => {
  const color = favoriteColors.value[index]
  if (color) {
    // 如果插槽有颜色，删除该颜色
    removeFavoriteColor(color)
  }
  // 如果插槽为空，双击不执行任何操作
}

// 清空常用颜色
const clearFavoriteColors = async () => {
  try {
    const success = await favoriteColorsManager.clearColors()
    if (success) {
      console.log('常用颜色已清空')
    } else {
      console.warn('清空常用颜色失败')
    }
  } catch (error) {
    console.error('清空常用颜色时发生错误:', error)
  }
}

// 组件挂载时初始化
onMounted(async () => {
  try {
    // 确保store已初始化
    await markdownStore.initialize()
    
    // 检查并执行数据迁移
    const migrationCompleted = await favoriteColorsMigration.checkMigrationStatus()
    if (!migrationCompleted) {
      console.log('检测到旧的常用颜色数据，开始迁移...')
      const migrationSuccess = await favoriteColorsMigration.migrate(markdownStore.config)
      if (migrationSuccess) {
        console.log('常用颜色数据迁移成功')
        // 迁移成功后清理旧数据
        await favoriteColorsMigration.cleanupOldData(markdownStore.updateConfig)
      }
    }
    
    // 初始化常用颜色管理器
    await favoriteColorsManager.initialize()
    
    // 加载当前常用颜色
    favoriteColors.value = favoriteColorsManager.getFavoriteColors()
    
    // 添加常用颜色变化监听器
    favoriteColorsManager.addListener(onFavoriteColorsChange)
    
    // 设置目录菜单状态监听器（推拉式布局）
    setupTocStateListeners()
    
    // 应用当前配置
    updateAccentColor(markdownStore.config.accentColor)
    applyTheme(markdownStore.config.theme)
    applyTypography(markdownStore.config.fontSize, markdownStore.config.lineHeight)
    applyMaxWidth(markdownStore.config.maxWidth)
    applyFontFamily(markdownStore.config.fontFamily)
    applyStyleConfig(markdownStore.config)
    
    console.log('设置面板初始化完成')
    console.log('当前配置:', markdownStore.config)
    console.log('当前常用颜色:', favoriteColors.value)
  } catch (error) {
    console.error('设置面板初始化失败:', error)
  }
})

// 设置目录菜单状态监听器
const setupTocStateListeners = () => {
  try {
    // 检查目录面板是否存在
    const checkTocPanel = () => {
      const tocPanel = document.querySelector('.toc-panel')
      if (tocPanel) {
        // 检查目录是否可见
        tocVisible.value = tocPanel.classList.contains('show')
        // 检查目录是否折叠
        tocCollapsed.value = tocPanel.classList.contains('collapsed')
        
        console.log('目录状态更新:', {
          visible: tocVisible.value,
          collapsed: tocCollapsed.value,
          layoutClass: tocLayoutClass.value
        })
      } else {
        // 目录面板不存在，重置状态
        tocVisible.value = false
        tocCollapsed.value = false
      }
    }
    
    // 初始检查
    checkTocPanel()
    
    // 使用MutationObserver监听DOM变化
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false
      
      mutations.forEach((mutation) => {
        // 监听类名变化
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as Element
          if (target.classList.contains('toc-panel')) {
            shouldCheck = true
          }
        }
        
        // 监听DOM结构变化（目录面板的添加/移除）
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (element.classList?.contains('toc-panel') || element.querySelector?.('.toc-panel')) {
                shouldCheck = true
              }
            }
          })
          
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (element.classList?.contains('toc-panel') || element.querySelector?.('.toc-panel')) {
                shouldCheck = true
              }
            }
          })
        }
      })
      
      if (shouldCheck) {
        // 使用requestAnimationFrame确保DOM更新完成
        requestAnimationFrame(checkTocPanel)
      }
    })
    
    // 开始观察整个文档的变化
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    })
    
    // 保存observer引用以便清理
    ;(window as any).__settingsPanelTocObserver = observer
    
    console.log('目录菜单状态监听器已设置')
  } catch (error) {
    console.error('设置目录菜单状态监听器失败:', error)
  }
}

// 清理目录菜单状态监听器
const cleanupTocStateListeners = () => {
  try {
    const observer = (window as any).__settingsPanelTocObserver
    if (observer) {
      observer.disconnect()
      delete (window as any).__settingsPanelTocObserver
      console.log('目录菜单状态监听器已清理')
    }
  } catch (error) {
    console.error('清理目录菜单状态监听器失败:', error)
  }
}

// 组件卸载时清理
onUnmounted(() => {
  // 移除常用颜色变化监听器
  favoriteColorsManager.removeListener(onFavoriteColorsChange)
  
  // 清理目录菜单状态监听器
  cleanupTocStateListeners()
})
// 配置更新（temp）：仅临时生效预览，不写入持久化存储；点击"保存设置"后持久化
const updateConfig = async (updates: Partial<MarkdownConfig>) => {
  console.log('更新配置(temp):', updates)
  // 修改即保存（立即生效并持久化）——用户无需点击确定，避免渲染导致面板退出时设置丢失
  await markdownStore.updateConfig(updates, true)
  
  // 广播完整配置到 content script：实时同步主配置（temp），
  // 避免点击设置/重渲染时恢复设置前的旧值
  window.dispatchEvent(new CustomEvent('settingsConfigChange', {
    detail: { config: markdownStore.config }
  }))
  
  // 立即应用样式更新到当前页面
  if (updates.accentColor) {
    updateAccentColor(updates.accentColor)
  }
  
  if (updates.theme) {
    applyTheme(updates.theme)
  }
  
  if (updates.fontSize || updates.lineHeight) {
    applyTypography(updates.fontSize || markdownStore.config.fontSize, updates.lineHeight || markdownStore.config.lineHeight)
  }
  
  if (updates.maxWidth !== undefined) {
    applyMaxWidth(updates.maxWidth)
  }
  
  if (updates.fontFamily) {
    applyFontFamily(updates.fontFamily)
  }
  
  // 应用样式配置到content script
  applyStyleConfig(markdownStore.config)

}


// 点击面板外 = 完成：保存临时配置并关闭（一个操作完成，无需保存/关闭按钮）
const handleClose = async () => {
  try {
    await markdownStore.saveConfig()
  } catch (error) {
    console.error('保存设置失败:', error)
  }
  emit('close')
}

// 点击"完成" = 保存配置 + 刷新页面：
// 直接刷新一次解决所有重渲染问题（SVG 图表主题色渲染时写死、内容错位等），
// 避免页面不刷新时图表停留在旧主题导致内容看不清楚
const handleDone = async () => {
  try {
    await markdownStore.saveConfig()
  } catch (error) {
    console.error('保存设置失败:', error)
  }
  // 先关闭面板（移除遮罩），再刷新页面
  emit('close')
  window.setTimeout(() => {
    location.reload()
  }, 50)
}

// 深色主题判断（用于禁用深色强调色）
const isDarkTheme = computed(() => {
  const theme = markdownStore.config.theme
  if (theme === 'dark') return true
  if (theme === 'auto') {
    return document.documentElement.getAttribute('data-system-theme') === 'dark'
  }
  return false
})

// 强调色点击：深色模式下禁止选择石墨色（黑色强调色在深色模式会看不见）
const onAccentClick = (value: string) => {
  if (value === 'graphite' && isDarkTheme.value) {
    if (typeof window.showNotification === 'function') {
      window.showNotification({ type: 'warning', title: '深色模式不可用', message: '石墨色（黑）在深色模式下会导致文字不可见，请选择其他强调色' })
    }
    return
  }
  updateConfig({ accentColor: value as any })
}

const applyStyleConfig = (config: MarkdownConfig) => {
  console.log('应用样式配置:', config)
  
  // 方案1: 尝试通过chrome.tabs API发送到content script
  try {
    // 检查chrome.tabs是否可用
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.log('Chrome tabs query error:', chrome.runtime.lastError)
          // 如果tabs API失败，触发备选方案
          applyStyleConfigFallback(config)
          return
        }
        
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'UPDATE_STYLE_CONFIG',
            config: config
          }).then(() => {
            console.log('样式配置已通过tabs API发送成功')
          }).catch(error => {
            console.log('发送样式配置消息失败:', error)
            // 如果消息发送失败，触发备选方案
            applyStyleConfigFallback(config)
          })
        } else {
          console.log('未找到活动标签页，使用备选方案')
          applyStyleConfigFallback(config)
        }
      })
    } else {
      console.log('Chrome tabs API 不可用，使用备选方案')
      applyStyleConfigFallback(config)
    }
  } catch (error) {
    console.log('无法发送样式配置消息:', error)
    applyStyleConfigFallback(config)
  }
}

// 备选方案：直接通过runtime消息或localStorage通知
const applyStyleConfigFallback = (config: MarkdownConfig) => {
  console.log('使用备选方案应用样式配置')
  
  try {
    // 方案2: 尝试通过chrome.runtime发送广播消息
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_STYLE_CONFIG',
        config: config
      }).then(() => {
        console.log('样式配置已通过runtime API发送成功')
      }).catch(error => {
        console.log('Runtime API发送失败:', error)
        // 方案3: 使用localStorage + 自定义事件
        applyStyleConfigLocalStorage(config)
      })
    } else {
      // 方案3: 使用localStorage + 自定义事件
      applyStyleConfigLocalStorage(config)
    }
  } catch (error) {
    console.log('Runtime API不可用，使用localStorage方案:', error)
    applyStyleConfigLocalStorage(config)
  }
}

// 方案3：通过localStorage + 自定义事件通知content script
const applyStyleConfigLocalStorage = (config: MarkdownConfig) => {
  console.log('使用localStorage + 自定义事件方案')
  
  try {
    // 保存配置到localStorage，带时间戳
    const configWithTimestamp = {
      ...config,
      _timestamp: Date.now(),
      _source: 'settings-panel'
    }
    
    localStorage.setItem('markdown-style-config-update', JSON.stringify(configWithTimestamp))
    
    // 触发自定义事件通知content script
    window.dispatchEvent(new CustomEvent('markdown-style-config-changed', {
      detail: configWithTimestamp
    }))
    
    console.log('样式配置已通过localStorage + 自定义事件发送')
    
    // 清理临时配置（避免重复触发）
    setTimeout(() => {
      localStorage.removeItem('markdown-style-config-update')
    }, 1000)
    
  } catch (error) {
    console.error('localStorage方案也失败了:', error)
    // 最后的备选：直接在当前页面应用（如果是在content script环境中）
    if (typeof window !== 'undefined' && window.location.href.includes('.md')) {
      console.log('尝试直接在当前页面应用样式配置')
      applyStyleConfigDirect(config)
    }
  }
}

// 方案4：直接在当前页面应用样式（最后的备选方案）
const applyStyleConfigDirect = (config: MarkdownConfig) => {
  console.log('直接在当前页面应用样式配置')
  
  try {
    // 应用强调色
    if (config.accentColor) {
      const customColor = config.accentColor === 'custom' ? config.customAccentColor : undefined
      // 如果有全局的cssVariableManager，使用它
      if (typeof window !== 'undefined' && (window as any).cssVariableManager) {
        (window as any).cssVariableManager.setAccentColor(config.accentColor, customColor)
      } else {
        // 否则直接设置CSS变量
        const colorMap = {
          blue: '#007AFF',
          purple: '#AF52DE',
          pink: '#FF2D92',
          red: '#FF3B30',
          orange: '#FF9500',
          yellow: '#FFCC00',
          green: '#30D158',
          graphite: '#8E8E93',
          custom: config.customAccentColor
        }
        const color = colorMap[config.accentColor] || config.customAccentColor
        if (color) {
          document.documentElement.style.setProperty('--accent-color', color)
          document.documentElement.style.setProperty('--accent-color-rgb', hexToRgb(color))
          document.documentElement.setAttribute('data-accent', config.accentColor)
        }
      }
    }
    
    // 应用其他样式配置
    if (config.theme) {
      document.documentElement.setAttribute('data-theme', config.theme)
    }
    
    if (config.fontSize) {
      document.documentElement.style.setProperty('--md-font-size', `${config.fontSize}px`)
    }
    
    if (config.lineHeight) {
      document.documentElement.style.setProperty('--md-line-height', config.lineHeight.toString())
    }
    
    if (config.maxWidth) {
      document.documentElement.style.setProperty('--md-max-width', `${config.maxWidth}px`)
    }
    
    if (config.fontFamily) {
      document.documentElement.style.setProperty('--md-font-family', config.fontFamily)
    }
    
    console.log('样式配置已直接应用到当前页面')
    
  } catch (error) {
    console.error('直接应用样式配置失败:', error)
  }
}

const updateAccentColor = (accentColor: AccentColor) => {
  console.log('应用强调色:', accentColor)
  
  // 移除之前的强调色类
  document.documentElement.classList.remove(
    'accent-blue', 'accent-purple', 'accent-pink', 'accent-red',
    'accent-orange', 'accent-yellow', 'accent-green', 'accent-graphite', 'accent-custom'
  )
  
  // 添加新的强调色类
  document.documentElement.classList.add(`accent-${accentColor}`)
  
  // 设置data-accent属性（这是关键！）
  document.documentElement.setAttribute('data-accent', accentColor)
  
  // 更新CSS变量
  const colorMap = {
    blue: '#007AFF',
    purple: '#AF52DE',
    pink: '#FF2D92',
    red: '#FF3B30',
    orange: '#FF9500',
    yellow: '#FFCC00',
    green: '#30D158',
    graphite: '#8E8E93',
    custom: markdownStore.config.customAccentColor // 使用自定义颜色
  }
  
  const color = colorMap[accentColor] || markdownStore.config.customAccentColor
  if (color) {
    document.documentElement.style.setProperty('--accent-color', color)
    document.documentElement.style.setProperty('--accent-color-rgb', hexToRgb(color))
  }
}

// 实时预览自定义颜色（不保存到配置）
const updateCustomColorPreview = (color: string) => {
  console.log('预览自定义颜色:', color)
  
  // 如果当前选中的是自定义颜色，立即预览
  if (markdownStore.config.accentColor === 'custom') {
    document.documentElement.style.setProperty('--accent-color', color)
    document.documentElement.style.setProperty('--accent-color-rgb', hexToRgb(color))
  }
}

// 更新自定义颜色
const updateCustomColor = async (color: string) => {
  console.log('更新自定义颜色:', color)
  
  // 更新配置中的自定义颜色
  await updateConfig({ customAccentColor: color })
  
  // 如果当前选中的是自定义颜色，立即应用
  if (markdownStore.config.accentColor === 'custom') {
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

const applyTypography = (fontSize: number, lineHeight: number) => {
  console.log('应用字体设置:', { fontSize, lineHeight })
  document.documentElement.setAttribute('data-font-size', fontSize.toString())
  document.documentElement.setAttribute('data-line-height', lineHeight.toString())
}

const applyMaxWidth = (maxWidth: number) => {
  console.log('应用最大宽度:', maxWidth)
  document.documentElement.setAttribute('data-max-width', maxWidth.toString())
}

const applyFontFamily = (fontFamily: string) => {
  console.log('应用字体家族:', fontFamily)
  document.documentElement.style.setProperty('--md-font-family', fontFamily)
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
/* 遮罩层样式 */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  z-index: 999998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

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
  /* 添加过渡动画 */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 推拉式布局样式 - 增加20px右偏移优化间距 */
.settings-panel.toc-visible {
  /* 当目录可见时，设置面板向右偏移 */
  left: calc(50% + 140px) !important;
}

.settings-panel.toc-visible.toc-collapsed {
  /* 当目录折叠时，设置面板偏移较少 */
  left: calc(50% + 80px) !important;
}

.settings-panel.toc-visible.toc-expanded {
  /* 当目录完全展开时，设置面板偏移更多 */
  left: calc(50% + 140px) !important;
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

.save-button {
  background: var(--md-accent-primary, #007AFF);
  border: none;
  border-radius: 8px;
  height: 32px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
}

.save-button:hover {
  opacity: 0.88;
  transform: scale(1.03);
}

.accent-color-option.disabled {
  opacity: 0.35;
  cursor: not-allowed;
  filter: grayscale(0.6);
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

/* 自定义颜色选项样式 */
.accent-color-option.custom {
  background: linear-gradient(45deg, 
    #ff0000 0%, #ff8000 12.5%, #ffff00 25%, #80ff00 37.5%, 
    #00ff00 50%, #00ff80 62.5%, #00ffff 75%, #0080ff 87.5%, #0000ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* 自定义颜色选择区域 */
.custom-color-section {
  margin-top: 16px;
  padding: 16px;
  background: rgba(248, 248, 248, 0.8);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.custom-color-picker {
  margin-bottom: 16px;
}

.color-picker-text {
  font-size: 12px;
  font-weight: 500;
  color: #1d1d1f;
  margin-bottom: 8px;
  display: block;
}

.custom-color-section {
  margin-top: 80px;
  padding-top: 16px;
}

.color-picker-container {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.color-picker-button {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  cursor: pointer;
  outline: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
}

.color-picker-button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 1);
}

.color-picker-button svg {
  color: rgba(255, 255, 255, 0.9);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  z-index: 1;
}

.custom-color-picker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker-button {
  width: 40px;
  height: 40px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
}

.color-picker-button:hover {
  border-color: var(--accent-color);
  transform: scale(1.05);
}

.color-picker-button svg {
  color: var(--text-color);
  opacity: 0.8;
}

.color-picker-input {
  position: absolute;
  top: -70px;
  left: 0;
  width: 60px;
  height: 60px;
  border: 2px solid var(--accent-color);
  border-radius: 12px;
  cursor: pointer;
  z-index: 50;
  background: transparent;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.color-picker-input:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.color-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.color-value {
  font-size: 12px;
  font-weight: 600;
  color: #1d1d1f;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

/* 预设颜色 */
.preset-colors {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 12px;
}

.preset-colors-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.preset-colors-label {
  font-size: 11px;
  font-weight: 500;
  color: #8e8e93;
}

.preset-colors-limit {
  font-size: 10px;
  font-weight: 400;
  color: #ff9500;
  background: rgba(255, 149, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 149, 0, 0.2);
}

.clear-favorites-btn {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: #8e8e93;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-favorites-btn:hover {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

.preset-colors-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.preset-color-slot {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: rgba(0, 0, 0, 0.05);
}

.preset-color-slot.has-color {
  background: var(--slot-color, rgba(0, 0, 0, 0.05));
  border-color: rgba(255, 255, 255, 0.8);
}

.preset-color-slot:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.preset-color-slot:not(.has-color) {
  border: 2px dashed rgba(0, 0, 0, 0.2);
}

.preset-color-slot:not(.has-color):hover {
  border-color: rgba(0, 0, 0, 0.3);
}

.empty-slot-icon {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.3);
  font-weight: 300;
}

.preset-colors-help {
  margin-top: 8px;
  text-align: center;
}

.help-text {
  font-size: 10px;
  color: #8e8e93;
  line-height: 1.3;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(142, 142, 147, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(142, 142, 147, 0.2);
}

.preset-colors-tip {
  font-size: 10px;
  color: #8e8e93;
  margin: 0;
  text-align: center;
  line-height: 1.3;
}

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
