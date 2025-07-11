<template>
  <div class="search-panel liquid-glass animate-slide-down">
    <!-- 搜索输入 -->
    <div class="search-input-container">
      <div class="search-input-wrapper">
        <div class="search-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <input 
          ref="searchInput"
          type="text" 
          v-model="searchQuery"
          @input="handleSearch"
          @keydown="handleKeydown"
          class="search-input"
          placeholder="搜索文档内容..."
          autocomplete="off"
        >
        <div class="search-actions">
          <!-- 搜索选项 -->
          <button 
            class="search-option-btn"
            @click="toggleCaseSensitive"
            :class="{ active: caseSensitive }"
            title="区分大小写"
          >
            Aa
          </button>
          <button 
            class="search-option-btn"
            @click="toggleWholeWord"
            :class="{ active: wholeWord }"
            title="全词匹配"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 7V4a1 1 0 011-1h3M4 17v3a1 1 0 001 1h3M20 7V4a1 1 0 00-1-1h-3M20 17v3a1 1 0 01-1 1h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button 
            class="search-option-btn"
            @click="toggleRegex"
            :class="{ active: useRegex }"
            title="正则表达式"
          >
            .*
          </button>
          <!-- 清除按钮 -->
          <button 
            v-if="searchQuery"
            class="clear-btn"
            @click="clearSearch"
            title="清除搜索"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- 搜索结果统计 -->
      <div class="search-stats" v-if="searchQuery">
        <span class="stats-text">
          {{ searchResults.length > 0 ? `${currentResultIndex + 1} / ${searchResults.length}` : '无结果' }}
        </span>
        <div class="navigation-buttons">
          <button 
            class="nav-btn"
            @click="previousResult"
            :disabled="searchResults.length === 0"
            title="上一个结果"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button 
            class="nav-btn"
            @click="nextResult"
            :disabled="searchResults.length === 0"
            title="下一个结果"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 高级搜索选项 -->
    <div class="advanced-options" v-if="showAdvanced">
      <div class="option-group">
        <label class="option-label">
          <input type="checkbox" v-model="searchInHeaders" @change="handleSearch">
          <span>仅搜索标题</span>
        </label>
        <label class="option-label">
          <input type="checkbox" v-model="searchInCode" @change="handleSearch">
          <span>包含代码块</span>
        </label>
        <label class="option-label">
          <input type="checkbox" v-model="searchInLinks" @change="handleSearch">
          <span>包含链接文本</span>
        </label>
      </div>
    </div>

    <!-- 搜索结果列表 -->
    <div class="search-results" v-if="searchQuery && searchResults.length > 0">
      <div class="results-header">
        <h4 class="results-title">搜索结果</h4>
        <button 
          class="toggle-advanced-btn"
          @click="showAdvanced = !showAdvanced"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M9 12h6M11 18h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      
      <div class="results-list">
        <div 
          v-for="(result, index) in searchResults.slice(0, maxDisplayResults)"
          :key="index"
          :class="[
            'result-item',
            { 'active': index === currentResultIndex }
          ]"
          @click="jumpToResult(index)"
        >
          <div class="result-content">
            <div class="result-context" v-html="result.highlightedText"></div>
            <div class="result-meta">
              <span class="result-type">{{ getResultTypeLabel(result.type) }}</span>
              <span class="result-position">第 {{ result.line }} 行</span>
            </div>
          </div>
        </div>
        
        <div v-if="searchResults.length > maxDisplayResults" class="more-results">
          还有 {{ searchResults.length - maxDisplayResults }} 个结果...
        </div>
      </div>
    </div>

    <!-- 无结果提示 -->
    <div class="no-results" v-if="searchQuery && searchResults.length === 0">
      <div class="no-results-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="no-results-text">未找到匹配的内容</p>
      <p class="no-results-suggestion">尝试使用不同的关键词或调整搜索选项</p>
    </div>

    <!-- 关闭按钮 -->
    <button 
      class="close-search-btn"
      @click="$emit('close')"
      title="关闭搜索"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import type { SearchResult, SearchOptions } from '../types'

// 定义事件
const emit = defineEmits<{
  close: []
  search: [query: string, options: SearchOptions]
  jumpTo: [result: SearchResult]
}>()

// 定义props
defineProps<{
  documentContent?: string
}>()

// 响应式数据
const searchInput = ref<HTMLInputElement>()
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const currentResultIndex = ref(0)
const showAdvanced = ref(false)
const maxDisplayResults = ref(50)

// 搜索选项
const caseSensitive = ref(false)
const wholeWord = ref(false)
const useRegex = ref(false)
const searchInHeaders = ref(false)
const searchInCode = ref(true)
const searchInLinks = ref(true)

// 计算属性
const searchOptions = computed<SearchOptions>(() => ({
  caseSensitive: caseSensitive.value,
  wholeWord: wholeWord.value,
  regex: useRegex.value,
  useRegex: useRegex.value,
  searchInHeaders: searchInHeaders.value,
  searchInCode: searchInCode.value,
  searchInLinks: searchInLinks.value
}))

// 方法
const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    currentResultIndex.value = 0
    return
  }

  try {
    // 这里应该调用实际的搜索逻辑
    // 模拟搜索结果
    const mockResults: SearchResult[] = [
      {
        id: '1',
        text: searchQuery.value,
        highlightedText: `这是包含 <mark>${searchQuery.value}</mark> 的文本内容`,
        line: 10,
        column: 5,
        index: 0,
        length: searchQuery.value.length,
        type: 'text',
        context: '这是上下文内容',
        element: null
      },
      {
        id: '2',
        text: searchQuery.value,
        highlightedText: `另一个包含 <mark>${searchQuery.value}</mark> 的段落`,
        line: 25,
        column: 12,
        index: 0,
        length: searchQuery.value.length,
        type: 'header',
        context: '标题上下文',
        element: null
      }
    ]
    
    searchResults.value = mockResults
    currentResultIndex.value = 0
    
    // 触发搜索事件
    emit('search', searchQuery.value, searchOptions.value)
  } catch (error) {
    console.error('搜索失败:', error)
    searchResults.value = []
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
  currentResultIndex.value = 0
}

const toggleCaseSensitive = () => {
  caseSensitive.value = !caseSensitive.value
  handleSearch()
}

const toggleWholeWord = () => {
  wholeWord.value = !wholeWord.value
  handleSearch()
}

const toggleRegex = () => {
  useRegex.value = !useRegex.value
  handleSearch()
}

const previousResult = () => {
  if (searchResults.value.length === 0) return
  currentResultIndex.value = currentResultIndex.value > 0 
    ? currentResultIndex.value - 1 
    : searchResults.value.length - 1
  jumpToCurrentResult()
}

const nextResult = () => {
  if (searchResults.value.length === 0) return
  currentResultIndex.value = currentResultIndex.value < searchResults.value.length - 1 
    ? currentResultIndex.value + 1 
    : 0
  jumpToCurrentResult()
}

const jumpToResult = (index: number) => {
  currentResultIndex.value = index
  jumpToCurrentResult()
}

const jumpToCurrentResult = () => {
  const result = searchResults.value[currentResultIndex.value]
  if (result) {
    emit('jumpTo', result)
  }
}

const getResultTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    text: '正文',
    header: '标题',
    code: '代码',
    link: '链接',
    list: '列表',
    table: '表格'
  }
  return labels[type] || '其他'
}

const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
      event.preventDefault()
      if (event.shiftKey) {
        previousResult()
      } else {
        nextResult()
      }
      break
    case 'Escape':
      emit('close')
      break
  }
}

// 生命周期
onMounted(() => {
  nextTick(() => {
    searchInput.value?.focus()
  })
})

// 键盘快捷键
const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'f':
        event.preventDefault()
        searchInput.value?.focus()
        break
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.search-panel {
  position: fixed;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  width: 400px;
  max-height: 70vh;
  z-index: 1500;
  display: flex;
  flex-direction: column;
  font-family: var(--apple-font-family);
  overflow: hidden;
}

.search-input-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--liquid-glass-border);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--liquid-glass-light);
  border: 2px solid var(--liquid-glass-border);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--ease-in-out);
}

.search-input-wrapper:focus-within {
  border-color: var(--apple-blue);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.search-icon {
  padding: 0 var(--spacing-md);
  color: var(--apple-secondary-label);
  display: flex;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: var(--spacing-md) 0;
  background: transparent;
  border: none;
  font-size: var(--font-size-md);
  color: var(--apple-label);
  outline: none;
}

.search-input::placeholder {
  color: var(--apple-tertiary-label);
}

.search-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding-right: var(--spacing-sm);
}

.search-option-btn {
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--apple-secondary-label);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-in-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-option-btn:hover {
  background: var(--apple-gray-6);
  color: var(--apple-label);
}

.search-option-btn.active {
  background: var(--apple-blue);
  color: white;
  border-color: var(--apple-blue);
}

.clear-btn {
  width: 24px;
  height: 24px;
  background: var(--apple-gray-5);
  border: none;
  border-radius: 50%;
  color: var(--apple-secondary-label);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-in-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn:hover {
  background: var(--apple-gray-4);
  color: var(--apple-label);
}

.search-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--apple-secondary-label);
}

.stats-text {
  font-weight: var(--font-weight-medium);
}

.navigation-buttons {
  display: flex;
  gap: var(--spacing-xs);
}

.nav-btn {
  width: 24px;
  height: 24px;
  background: transparent;
  border: 1px solid var(--liquid-glass-border);
  border-radius: var(--radius-sm);
  color: var(--apple-secondary-label);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-in-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover:not(:disabled) {
  background: var(--apple-gray-6);
  color: var(--apple-label);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.advanced-options {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--liquid-glass-border);
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.option-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--apple-label);
  cursor: pointer;
}

.option-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--apple-blue);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--liquid-glass-border);
}

.results-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--apple-label);
  margin: 0;
}

.toggle-advanced-btn {
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--liquid-glass-border);
  border-radius: var(--radius-sm);
  color: var(--apple-secondary-label);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-in-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-advanced-btn:hover {
  background: var(--apple-gray-6);
  color: var(--apple-label);
}

.results-list {
  flex: 1;
  overflow-y: auto;
}

.result-item {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--liquid-glass-border);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-in-out);
}

.result-item:hover {
  background: var(--liquid-glass-light);
}

.result-item.active {
  background: rgba(0, 122, 255, 0.1);
  border-left: 3px solid var(--apple-blue);
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.result-context {
  font-size: var(--font-size-sm);
  color: var(--apple-label);
  line-height: 1.4;
}

.result-context :deep(mark) {
  background: var(--apple-yellow);
  color: var(--apple-label);
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: var(--font-weight-semibold);
}

.result-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-xs);
  color: var(--apple-tertiary-label);
}

.result-type {
  background: var(--apple-gray-6);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-weight: var(--font-weight-medium);
}

.more-results {
  padding: var(--spacing-md);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--apple-secondary-label);
  font-style: italic;
}

.no-results {
  padding: var(--spacing-xl);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.no-results-icon {
  color: var(--apple-tertiary-label);
  opacity: 0.6;
}

.no-results-text {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--apple-secondary-label);
  margin: 0;
}

.no-results-suggestion {
  font-size: var(--font-size-sm);
  color: var(--apple-tertiary-label);
  margin: 0;
}

.close-search-btn {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  width: 28px;
  height: 28px;
  background: var(--liquid-glass-light);
  border: 1px solid var(--liquid-glass-border);
  border-radius: 50%;
  color: var(--apple-secondary-label);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-in-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-search-btn:hover {
  background: var(--apple-gray-5);
  color: var(--apple-label);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search-panel {
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    left: var(--spacing-sm);
    width: auto;
    max-height: 60vh;
  }
  
  .search-actions {
    flex-wrap: wrap;
  }
  
  .option-group {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>