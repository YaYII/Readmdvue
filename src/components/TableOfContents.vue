<template>
  <!-- 左侧触发区域 -->
  <div 
    class="toc-trigger-zone"
    @mouseenter="handleTriggerEnter"
    @mouseleave="handleTriggerLeave"
  ></div>

  <!-- 目录面板 -->
  <div 
    class="toc-panel" 
    :class="{ 
      'show': isVisible, 
      'collapsed': isCollapsed,
      'pinned': isPinned 
    }"
    @mouseenter="handlePanelEnter"
    @mouseleave="handlePanelLeave"
  >
    <!-- 顶部工具栏区域 -->
    <div class="toc-toolbar">
      <!-- 设置按钮 -->
      <button 
        class="toc-toolbar-btn" 
        @click="openSettings"
        title="设置"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <!-- 搜索按钮 -->
      <button 
        class="toc-toolbar-btn" 
        :class="{ 'active': showSearchBox }"
        @click="toggleSearch"
        title="搜索目录"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="M21 21l-4.35-4.35"></path>
        </svg>
      </button>

      <!-- 导出按钮 -->
      <button 
        class="toc-toolbar-btn" 
        @click="openExport"
        title="导出"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7,10 12,15 17,10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>

      <!-- 查看原始页面按钮 -->
      <button 
        class="toc-toolbar-btn" 
        @click="toggleOriginalContent"
        title="查看原始页面"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2-2z"></path>
          <polyline points="8,1 16,1 16,7 8,7 8,1"></polyline>
        </svg>
      </button>

      <!-- 爱心打赏按钮 -->
      <button 
        class="toc-toolbar-btn toc-heart-btn donation-btn" 
        @click="toggleDonation"
        title="支持开发者"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </button>

      <!-- 分隔线 -->
      <div class="toc-toolbar-divider"></div>

      <!-- 固定/取消固定按钮 -->
      <button 
        class="toc-toolbar-btn" 
        @click="togglePin"
        :title="isPinned ? '取消固定' : '固定面板'"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path v-if="!isPinned" d="M9 9V5a3 3 0 0 1 6 0v4"></path>
          <path v-if="!isPinned" d="M8 9h8l-1 9H9L8 9z"></path>
          <path v-if="isPinned" d="M12 17v5"></path>
          <path v-if="isPinned" d="M9 7.5l3-3 3 3"></path>
          <path v-if="isPinned" d="M6 13.5h12"></path>
        </svg>
      </button>

      <!-- 隐藏按钮 -->
      <button 
        class="toc-toolbar-btn toc-hide-btn" 
        @click="hidePanel"
        title="隐藏面板"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,18 9,12 15,6"></polyline>
        </svg>
      </button>
    </div>

    <!-- 搜索框区域 -->
    <div class="toc-search-container" v-show="showSearchBox && !isCollapsed">
      <div class="toc-search-wrapper">
        <div class="search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
        </div>
        <input 
          ref="searchInput"
          v-model="searchQuery"
          type="text" 
          class="toc-search-input"
          placeholder="搜索目录标题..."
          @input="handleSearchInput"
          @keydown.escape="clearSearch"
        />
        <button 
          v-if="searchQuery"
          class="clear-search-btn"
          @click="clearSearch"
          title="清除搜索"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="search-stats" v-if="searchQuery">
        找到 {{ filteredTocItems.length }} / {{ tocItems.length }} 个标题
      </div>
    </div>

    <!-- 目录标题区域 -->
    <div class="toc-header" v-show="!isCollapsed">
      <h3>目录导航</h3>
      <div class="toc-stats">
        <span v-if="!searchQuery">{{ tocItems.length }} 个标题</span>
        <span v-else>{{ filteredTocItems.length }} / {{ tocItems.length }} 个标题</span>
      </div>
    </div>

    <!-- 目录内容区域 -->
    <div class="toc-content" v-show="!isCollapsed">
      <ul class="toc-list" v-if="displayTocItems.length > 0">
        <li 
          v-for="item in displayTocItems" 
          :key="item.id"
          :class="[
            'toc-item', 
            `toc-level-${item.level}`,
            { 'active': activeId === item.id },
            { 'search-highlight': searchQuery && item.isHighlighted }
          ]"
        >
          <a 
            :href="`#${item.id}`" 
            @click="scrollToHeading(item.id, $event)"
            :title="item.text"
            v-html="item.highlightedText || item.text"
          >
          </a>
        </li>
      </ul>
      <div v-else-if="searchQuery && filteredTocItems.length === 0" class="toc-empty">
        <div class="empty-icon">🔍</div>
        <div class="empty-text">未找到匹配的标题</div>
        <div class="empty-hint">尝试使用其他关键词搜索</div>
      </div>
      <div v-else-if="tocItems.length === 0" class="toc-empty">
        <div class="empty-icon">📄</div>
        <div class="empty-text">暂无目录</div>
        <div class="empty-hint">页面中没有找到标题</div>
      </div>
    </div>

    <!-- 阅读进度指示器 -->
    <div class="toc-progress" v-show="!isCollapsed">
      <div class="progress-label">
        阅读进度
        <button 
          @click="handleScroll" 
          style="margin-left: 8px; padding: 2px 6px; font-size: 10px; background: rgba(0,122,255,0.1); border: 1px solid rgba(0,122,255,0.3); border-radius: 4px; cursor: pointer;"
          title="手动更新进度"
        >
          🔄
        </button>
      </div>
      <div class="progress-bar-container" @click="seekProgress" title="点击跳转到对应阅读位置">
        <div class="progress-bar" :style="{ width: `${readingProgress}%` }"></div>
        <div class="progress-text">{{ Math.round(readingProgress) }}%</div>
      </div>
      <div style="font-size: 10px; color: #8e8e93; margin-top: 4px;">
        当前进度: {{ readingProgress.toFixed(1) }}% ({{ Math.round(readingProgress) }}%)
      </div>
    </div>

    <!-- 折叠/展开按钮 -->
    <div class="toc-collapse-toggle" @click="toggleCollapse">
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2"
        :class="{ 'rotated': isCollapsed }"
      >
        <polyline points="6,9 12,15 18,9"></polyline>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { TocItem } from '../utils/markdownRenderer'

interface Props {
  tocItems: TocItem[]
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false
})

// 响应式状态
const isVisible = ref(false)
const isCollapsed = ref(false)
const isPinned = ref(false)
const activeId = ref<string>('')
const readingProgress = ref(0)

// 进度条平滑动画：target 为目标值，display 每帧向 target 逼近（rAF 补间），
// 使滚动时进度条连续流动而非 100ms 节流跳变
let targetProgress = 0
let displayProgress = 0
let progressRafId: number | null = null

const startProgressAnimation = () => {
  if (progressRafId !== null) return
  const animate = () => {
    displayProgress += (targetProgress - displayProgress) * 0.18
    if (Math.abs(targetProgress - displayProgress) < 0.1) {
      displayProgress = targetProgress
      progressRafId = null
    } else {
      progressRafId = requestAnimationFrame(animate)
    }
    readingProgress.value = displayProgress
  }
  progressRafId = requestAnimationFrame(animate)
}
const isHovering = ref(false)
const hideTimer = ref<number | null>(null)

// 搜索相关状态
const showSearchBox = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement>()

// 计算属性：过滤后的目录项
const filteredTocItems = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.tocItems
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return props.tocItems.filter(item => 
    item.text.toLowerCase().includes(query)
  )
})

// 计算属性：显示的目录项（带高亮）
const displayTocItems = computed(() => {
  const items = filteredTocItems.value
  
  if (!searchQuery.value.trim()) {
    return items.map(item => ({
      ...item,
      highlightedText: undefined,
      isHighlighted: false
    }))
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return items.map(item => {
    const text = item.text
    const lowerText = text.toLowerCase()
    const index = lowerText.indexOf(query)
    
    if (index === -1) {
      return {
        ...item,
        highlightedText: text,
        isHighlighted: false
      }
    }
    
    const before = text.substring(0, index)
    const match = text.substring(index, index + query.length)
    const after = text.substring(index + query.length)
    
    return {
      ...item,
      highlightedText: `${before}<mark class="search-highlight-text">${match}</mark>${after}`,
      isHighlighted: true
    }
  })
})

// 控制内容区域样式的函数
const updateContentLayout = () => {
  const container = document.querySelector('.markdown-reader-container')
  if (!container) return
  
  // 移除所有目录相关的类
  container.classList.remove('toc-visible', 'toc-collapsed')
  
  // 根据当前状态添加对应的类
  if (isVisible.value) {
    if (isCollapsed.value) {
      container.classList.add('toc-collapsed')
    } else {
      container.classList.add('toc-visible')
    }
  }
  // 如果目录不可见，则不添加任何类，内容区域占满全宽
}

// 触发区域和面板的鼠标事件处理
const handleTriggerEnter = () => {
  if (!isPinned.value) {
    clearHideTimer()
    isVisible.value = true
  }
}

const handleTriggerLeave = () => {
  if (!isPinned.value && !isHovering.value) {
    scheduleHide()
  }
}

const handlePanelEnter = () => {
  isHovering.value = true
  clearHideTimer()
}

const handlePanelLeave = () => {
  isHovering.value = false
  if (!isPinned.value) {
    scheduleHide()
  }
}

const clearHideTimer = () => {
  if (hideTimer.value) {
    clearTimeout(hideTimer.value)
    hideTimer.value = null
  }
}

const scheduleHide = () => {
  clearHideTimer()
  hideTimer.value = window.setTimeout(() => {
    if (!isPinned.value && !isHovering.value) {
      isVisible.value = false
    }
  }, 300) // 300ms 延迟隐藏
}

// 工具栏按钮事件处理
const openSettings = () => {
  // 触发全局设置事件
  const event = new CustomEvent('showSettingsPanel')
  window.dispatchEvent(event)
}

const openExport = () => {
  // 触发全局导出事件
  const event = new CustomEvent('showExportDialog')
  window.dispatchEvent(event)
}

// 搜索功能
const toggleSearch = async () => {
  showSearchBox.value = !showSearchBox.value
  
  if (showSearchBox.value) {
    // 展开搜索框时，自动聚焦输入框
    await nextTick()
    searchInput.value?.focus()
  } else {
    // 关闭搜索框时，清除搜索内容
    clearSearch()
  }
}

const handleSearchInput = () => {
  // 搜索输入处理，响应式数据会自动更新过滤结果
}

const clearSearch = () => {
  searchQuery.value = ''
  searchInput.value?.focus()
}

// 打赏功能
const toggleDonation = async () => {
  // 触发全局打赏事件，让主应用处理
  window.dispatchEvent(new CustomEvent('toggle-donation', {
    detail: { show: true }
  }))
}

const toggleOriginalContent = () => {
  // 触发全局切换原始内容事件
  const event = new CustomEvent('toggleOriginalContent')
  window.dispatchEvent(event)
}

const togglePin = () => {
  isPinned.value = !isPinned.value
  // 保存固定状态到本地存储
  localStorage.setItem('toc-pinned', isPinned.value.toString())
  
  if (isPinned.value) {
    isVisible.value = true
    clearHideTimer()
  }
  
  // 更新内容区域布局
  updateContentLayout()
}

const hidePanel = () => {
  isVisible.value = false
  isPinned.value = false
  showSearchBox.value = false
  clearSearch()
  localStorage.setItem('toc-pinned', 'false')
  clearHideTimer()
  
  // 更新内容区域布局
  updateContentLayout()
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  
  // 如果折叠了，也要关闭搜索框
  if (isCollapsed.value) {
    showSearchBox.value = false
    clearSearch()
  }
  
  // 保存折叠状态到本地存储
  localStorage.setItem('toc-collapsed', isCollapsed.value.toString())
  
  // 更新内容区域布局
  updateContentLayout()
}

const scrollToHeading = (id: string, event: Event) => {
  event.preventDefault()
  
  const element = document.getElementById(id)
  if (element) {
    // 平滑滚动到目标元素
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start',
      inline: 'nearest'
    })
    
    // 更新活跃状态
    activeId.value = id
    
    // 添加高亮效果
    element.classList.add('heading-highlight')
    setTimeout(() => {
      element.classList.remove('heading-highlight')
    }, 2000)
  }
}

// 监听滚动事件，更新活跃标题和阅读进度
const handleScroll = () => {
  console.log('🔄 handleScroll 被调用了！')
  
  // 获取滚动信息 - 兼容不同的滚动容器
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
  const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0
  const clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0
  const documentHeight = scrollHeight - clientHeight
  
  console.log('📊 滚动数据:', {
    scrollTop,
    scrollHeight,
    clientHeight,
    documentHeight,
    '页面是否可滚动': documentHeight > 0
  })
  
  // 计算阅读进度
  if (documentHeight <= 0 || scrollHeight <= clientHeight) {
    // 如果页面内容不足一屏，进度为100%
    targetProgress = 100
    startProgressAnimation()
    console.log('📄 页面内容不足一屏，进度设为100%')
  } else {
    // 正常计算进度百分比
    const progress = Math.min(Math.max((scrollTop / documentHeight) * 100, 0), 100)
    targetProgress = progress
    startProgressAnimation()
    
    console.log('📈 阅读进度更新:', {
      '原始进度': (scrollTop / documentHeight) * 100,
      '最终进度': Math.round(progress),
      'readingProgress.value': readingProgress.value
    })
  }
  
  // 查找当前可见的标题
  // 活跃标题改由 IntersectionObserver 更新（滚动零 JS 开销，不再每帧遍历全部标题）
}

// 点击进度条跳转到对应阅读位置（按点击位置比例平滑滚动）
const seekProgress = (event: MouseEvent) => {
  const container = event.currentTarget as HTMLElement | null
  if (!container) return
  const rect = container.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
  const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0
  const clientHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const documentHeight = scrollHeight - clientHeight
  if (documentHeight <= 0) return
  window.scrollTo({ top: documentHeight * ratio, behavior: 'smooth' })
}

// 节流函数
const throttle = <T extends (...args: any[]) => void>(func: T, delay: number): T => {
  let timeoutId: number | null = null
  let lastExecTime = 0
  
  return ((...args: any[]) => {
    const currentTime = Date.now()
    
    if (currentTime - lastExecTime > delay) {
      func(...args)
      lastExecTime = currentTime
    } else {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        func(...args)
        lastExecTime = Date.now()
      }, delay - (currentTime - lastExecTime))
    }
  }) as T
}

const throttledHandleScroll = throttle(handleScroll, 100)

// 活跃标题监听：IntersectionObserver 替代滚动时遍历全部标题（大文档 500+ 标题时每帧 getBoundingClientRect 会卡顿）
let headingObserver: IntersectionObserver | null = null

const setupHeadingObserver = () => {
  if (headingObserver) headingObserver.disconnect()
  const headingElements = props.tocItems
    .map(item => document.getElementById(item.id))
    .filter((el): el is HTMLElement => el !== null)
  if (headingElements.length === 0) return

  headingObserver = new IntersectionObserver((entries) => {
    // 只处理进入视口上部区域的标题，取最靠上的作为活跃项
    const visible = entries.filter(entry => entry.isIntersecting)
    if (visible.length === 0) return
    let best: Element | null = null
    let bestTop = Infinity
    for (const entry of visible) {
      const top = entry.boundingClientRect.top
      if (top < bestTop) {
        bestTop = top
        best = entry.target
      }
    }
    if (best && best.id !== activeId.value) {
      activeId.value = best.id
    }
  }, {
    // 触发区域：视口上部约 25%（顶部 80px 以下到 60% 处）
    rootMargin: '-80px 0px -60% 0px'
  })

  headingElements.forEach(el => headingObserver?.observe(el))
}

// 生命周期
onMounted(() => {
  console.log('🚀 TableOfContents 组件已挂载，开始初始化滚动监听')
  console.log('📋 当前目录项数量:', props.tocItems.length)
  console.log('🌐 当前环境信息:', {
    'window存在': typeof window !== 'undefined',
    'document存在': typeof document !== 'undefined',
    '页面标题': document.title,
    '页面URL': window.location.href
  })
  
  // 恢复保存的状态
  const savedCollapsed = localStorage.getItem('toc-collapsed')
  if (savedCollapsed !== null) {
    isCollapsed.value = savedCollapsed === 'true'
  }
  
  const savedPinned = localStorage.getItem('toc-pinned')
  if (savedPinned !== null) {
    isPinned.value = savedPinned === 'true'
    if (isPinned.value) {
      isVisible.value = true
    }
  }
  
  // 添加滚动监听 - 使用多种方式确保监听成功
  const addScrollListener = () => {
    console.log('🎯 正在添加滚动监听器...')
    
    // 监听window滚动
    window.addEventListener('scroll', throttledHandleScroll, { passive: true })
    console.log('✅ window滚动监听器已添加')
    
    // 监听document滚动
    document.addEventListener('scroll', throttledHandleScroll, { passive: true })
    console.log('✅ document滚动监听器已添加')
    
    // 监听document.documentElement滚动
    if (document.documentElement) {
      document.documentElement.addEventListener('scroll', throttledHandleScroll, { passive: true })
      console.log('✅ documentElement滚动监听器已添加')
    }
    
    console.log('🎉 所有滚动监听器添加完成')
  }
  
  // 立即添加监听器
  addScrollListener()

  // 活跃标题监听（IntersectionObserver）
  setTimeout(() => {
    setupHeadingObserver()
  }, 100) // 等 DOM 渲染完成后建立观察
  
  // 延迟再次添加，确保页面完全加载后也能监听
  setTimeout(() => {
    console.log('⏰ 延迟初始化开始...')
    addScrollListener()
    // 初始化活跃标题和进度
    handleScroll()
    console.log('✨ 延迟初始化完成，当前阅读进度:', readingProgress.value)
  }, 1000)
  
  // 立即初始化一次
  console.log('🔥 立即执行初始化...')
  handleScroll()
  console.log('🎯 初始化完成，当前阅读进度:', readingProgress.value)
  
  // 初始化内容区域布局
  setTimeout(() => {
    updateContentLayout()
    console.log('🎨 内容区域布局初始化完成')
  }, 100)
})

onUnmounted(() => {
  console.log('TableOfContents 组件卸载，清理滚动监听器')
  
  // 清理所有滚动监听器
  window.removeEventListener('scroll', throttledHandleScroll)
  document.removeEventListener('scroll', throttledHandleScroll)
  if (document.documentElement) {
    document.documentElement.removeEventListener('scroll', throttledHandleScroll)
  }
  
  // 清理定时器
  clearHideTimer()
  // 清理进度动画
  if (progressRafId !== null) {
    cancelAnimationFrame(progressRafId)
    progressRafId = null
  }
  // 清理标题观察器
  if (headingObserver) {
    headingObserver.disconnect()
    headingObserver = null
  }
})

// 监听props变化
watch(() => props.visible, (newValue) => {
  if (newValue && !isPinned.value) {
    isVisible.value = newValue
  }
})

// 监听isVisible状态变化，更新内容区域布局
watch(isVisible, () => {
  updateContentLayout()
})

// 监听isCollapsed状态变化，更新内容区域布局
watch(isCollapsed, () => {
  updateContentLayout()
})
</script>

<style scoped>
/* 引入目录组件专用样式文件 */
@import '../styles/table-of-contents.css';
</style>
