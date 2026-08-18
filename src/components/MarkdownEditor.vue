<template>
  <div class="editor-overlay" ref="overlayRef" @click.self="onClose?.()">
    <div class="editor-panel animate-scale-up">
      <!-- 头部 -->
      <div class="editor-header">
        <div class="editor-header-text">
          <h2 class="editor-title">编辑文档</h2>
          <p class="editor-subtitle">
            原文件：{{ originalFilename }}
            <span class="editor-arrow">→</span>
            保存为：<strong class="editor-target">{{ targetFilename }}</strong>
          </p>
        </div>
        <button class="editor-close-btn" @click="onClose?.()" title="关闭编辑器 (Esc)" aria-label="关闭编辑器">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- 双屏主体：左编辑 + 右预览（内容实时同步、滚动双向联动） -->
      <div class="editor-split">
        <div class="editor-pane editor-code" ref="editorHostRef"></div>
        <div class="editor-pane editor-preview" ref="previewHostRef"></div>
      </div>

      <!-- 底部状态栏 -->
      <div class="editor-footer">
        <span class="editor-status">{{ charCount }} 字符</span>
        <span class="editor-hint">左侧编辑实时渲染到右侧预览，滚动双向联动；保存为新的版本文件，不覆盖原文件</span>
        <button class="editor-format-btn" @click="formatMarkdown" :disabled="isFormatting" title="规范 Markdown 书写（标题/列表/引用符号间隔、表格对齐、多余空行）">
          {{ isFormatting ? '格式化中…' : '格式化' }}
        </button>
        <button class="editor-save-btn" @click="save" :disabled="isSaving">
          {{ isSaving ? '保存中…' : `保存为 ${targetFilename}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { showSuccess, showError } from '../utils/appleNotification'
import { generateVersionedFilename } from '../utils/versionedFilename'
import { MarkdownRenderer, type TocItem } from '../utils/markdownRenderer'
import { normalizeMarkdown } from '../utils/markdownNormalizer'
import { asyncChartRenderer } from '../utils/asyncChartRenderer'
import katex from 'katex'
import type { MarkdownConfig } from '../types'
import { defaultConfig } from '../types'

interface Props {
  originalContent: string
  originalFilename: string
  config?: MarkdownConfig
  onClose?: () => void
}

const props = defineProps<Props>()

const editorHostRef = ref<HTMLElement>()
const previewHostRef = ref<HTMLElement>()
const overlayRef = ref<HTMLElement>()
const isSaving = ref(false)
const isFormatting = ref(false)
const charCount = ref(0)

let view: EditorView | null = null
/** 最近一次预览渲染的目录（标题定位用） */
let lastTocItems: TocItem[] | null = null
/** 预览防抖渲染定时器 */
let renderTimer: ReturnType<typeof setTimeout> | null = null
/** 渲染序号：并发保护，只应用最新一次渲染结果 */
let renderSeq = 0
/** 滚动同步防循环标志 */
let syncing = false
/** 编辑侧标题（行号 + 文本），docChanged 时重建 */
let editHeadings: Array<{ line: number; text: string }> = []
/** TOC 菜单显隐观察器（弹窗避让菜单空间） */
let tocObserver: MutationObserver | null = null
/** TOC 跟随动画帧（菜单 0.3s 过渡期间逐帧跟随，稳定后停止） */
let tocFollowRaf: number | null = null
/** TOC 跟随窗口定时器（覆盖 0.3s 过渡动画后停止） */
let tocFollowTimer: ReturnType<typeof setTimeout> | null = null

// 目标文件名：基于原文件名的版本号规则（README.md → README-v0.01.md）
const targetFilename = computed(() => generateVersionedFilename(props.originalFilename))

// 预览渲染配置：页面配置 + 默认值兜底
const previewConfig: MarkdownConfig = { ...defaultConfig, ...(props.config ?? {}) }

// 当前主题是否为深色（CodeMirror 用 oneDark；浅色用默认主题）
function isDarkMode(): boolean {
  const rootTheme = document.documentElement.getAttribute('data-theme')
  const systemTheme = document.documentElement.getAttribute('data-system-theme')
  return rootTheme === 'dark' || (rootTheme === 'auto' && systemTheme === 'dark')
}

onMounted(() => {
  if (!editorHostRef.value) return
  view = new EditorView({
    doc: props.originalContent,
    extensions: [
      basicSetup,
      markdown(),
      ...(isDarkMode() ? [oneDark] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          charCount.value = update.state.doc.length
          rebuildEditHeadings()
          schedulePreviewRender()
        }
      })
    ],
    parent: editorHostRef.value
  })
  charCount.value = props.originalContent.length

  // 双向滚动联动：编辑滚动 → 预览跟随；预览滚动 → 编辑跟随
  view.scrollDOM.addEventListener('scroll', () => syncEditToPreview())
  previewHostRef.value?.addEventListener('scroll', () => syncPreviewToEdit())
  // TOC 目录导航：点击目录项 → 弹窗预览+编辑区定位到对应标题
  window.addEventListener('tocNavigate', handleTocNavigate)

  rebuildEditHeadings()
  applyTocOffset()
  startTocFollow()
  observeTocPanel()
  void renderPreview()
})

onBeforeUnmount(() => {
  window.removeEventListener('tocNavigate', handleTocNavigate)
  tocObserver?.disconnect()
  tocObserver = null
  if (tocFollowTimer !== null) {
    clearTimeout(tocFollowTimer)
    tocFollowTimer = null
  }
  if (tocFollowRaf !== null) {
    cancelAnimationFrame(tocFollowRaf)
    tocFollowRaf = null
  }
  view?.destroy()
  view = null
})

/**
 * TOC 目录点击导航（编辑弹窗内）：
 * 点击左侧目录项 → 预览滚动到对应标题 + 编辑区同步定位，
 * 让「预览位置 ↔ 编辑内容位置」构成可见对应区域，方便快速定位长文档
 */
function handleTocNavigate(event: Event): void {
  const detail = (event as CustomEvent<{ id?: string }>).detail
  const id = detail?.id
  const host = previewHostRef.value
  if (!id || !view || !host) return

  // 1) 预览侧：滚动到对应标题元素
  const targetEl = host.querySelector(`#${CSS.escape(id)}`)
  if (targetEl) {
    beginSync()
    host.scrollTop = Math.max(0, (targetEl as HTMLElement).offsetTop - 12)
  }

  // 2) 编辑侧：滚动到对应标题行（通过 tocItems 文本匹配 editHeadings）
  const tocItem = lastTocItems?.find((t) => t.id === id)
  if (tocItem) {
    const hIdx = editHeadings.findIndex((h) => h.text === tocItem.text)
    if (hIdx >= 0) {
      const line = editHeadings[hIdx].line
      const top = view.lineBlockAt(view.state.doc.line(line).from).top
      beginSync()
      view.scrollDOM.scrollTop = Math.max(0, top - 20)
    }
  }
}

/**
 * 弹窗避让 TOC 目录菜单：
 * 菜单显示（占据视口左侧）→ 弹窗从菜单右边缘开始；
 * 菜单隐藏（屏幕外）→ 弹窗占满全屏
 * @returns 菜单右边缘当前值（0 = 不避让）
 */
function applyTocOffset(): number {
  const overlay = overlayRef.value
  if (!overlay) return 0

  const panel = document.querySelector('.toc-panel')
  let target = 0
  if (panel) {
    // 显示/隐藏以 class 为准（show/pinned = 显示；双保险，不依赖坐标符号判断）
    const shown = panel.classList.contains('show') || panel.classList.contains('pinned')
    if (shown) {
      const rect = panel.getBoundingClientRect()
      // 面板在视口内且确实占据左侧空间才避让
      if (rect.right > 0 && rect.right < window.innerWidth) {
        target = rect.right
      }
    }
  }
  overlay.style.left = `${target}px`
  return target
}

/**
 * 动态区域捕捉：菜单展开/收起有 0.3s 过渡动画，
 * 用固定 600ms 跟随窗口（覆盖 0.3s 动画 + 余量）内 rAF 逐帧读取实际位置，
 * 避免「两帧差值误判稳定」导致提前停止、弹窗卡在错误宽度
 */
function startTocFollow(): void {
  // 立即对齐一次（菜单未在动画时直接到位）
  applyTocOffset()

  // 重置跟随窗口
  if (tocFollowTimer !== null) clearTimeout(tocFollowTimer)
  tocFollowTimer = setTimeout(() => {
    tocFollowTimer = null
    if (tocFollowRaf !== null) {
      cancelAnimationFrame(tocFollowRaf)
      tocFollowRaf = null
    }
    applyTocOffset() // 动画结束后最终对齐
  }, 600)

  // 窗口内 rAF 逐帧跟随（不依赖差值判断，动画期间必然被覆盖）
  if (tocFollowRaf !== null) return
  const tick = (): void => {
    if (!overlayRef.value) {
      tocFollowRaf = null
      return
    }
    applyTocOffset()
    tocFollowRaf = requestAnimationFrame(tick)
  }
  tocFollowRaf = requestAnimationFrame(tick)
}

/** 监听 TOC 面板 class（show/collapsed/pinned）变化，启动逐帧跟随 */
function observeTocPanel(): void {
  const panel = document.querySelector('.toc-panel')
  if (!panel) return
  tocObserver = new MutationObserver(() => startTocFollow())
  tocObserver.observe(panel, { attributes: true, attributeFilter: ['class'] })
}

/** 防抖调度预览渲染（编辑停顿 400ms 后渲染，避免输入卡顿） */
function schedulePreviewRender(): void {
  if (renderTimer !== null) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    renderTimer = null
    void renderPreview()
  }, 400)
}

/**
 * Markdown 格式化：
 * 自研规范化器修复符号间隔（#标题→# 标题、-项目→- 项目、>引用→> 引用、行尾空白、多余空行）
 * → Prettier 收尾（表格列对齐、引用、块间空行规范）
 * Prettier 动态加载（standalone + markdown parser，仅首次点击时加载，不影响初始包体）
 */
async function formatMarkdown(): Promise<void> {
  if (!view || isFormatting.value) return
  const original = view.state.doc.toString()
  if (!original.trim()) return

  isFormatting.value = true
  try {
    const [prettierModule, markdownParser] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/markdown')
    ])

    // 1) 规范化器修复符号间隔（代码块内不动）
    const normalized = normalizeMarkdown(original)
    // 2) Prettier 收尾
    const formatted = await prettierModule.format(normalized, {
      parser: 'markdown',
      plugins: [markdownParser],
      proseWrap: 'preserve' // 不重排段落文本，避免大改动
    })

    if (formatted === original) {
      showSuccess('格式化完成', '文档格式已经很规范，无需调整')
      return
    }

    // 3) 替换编辑器内容（光标按字符偏移近似保留），预览防抖自动更新
    const cursor = view.state.selection.main.head
    view.dispatch({
      changes: { from: 0, to: original.length, insert: formatted },
      selection: { anchor: Math.min(cursor, formatted.length) }
    })
    showSuccess('格式化完成', '已规范标题/列表/引用间隔、表格对齐与空行')
  } catch (err) {
    console.error('[编辑器] 格式化失败:', err)
    showError('格式化失败', err instanceof Error ? err.message : '无法格式化该文档（请检查代码块等语法）')
  } finally {
    isFormatting.value = false
  }
}

/**
 * 双屏实时预览：
 * 编辑内容变化 → 防抖 → 全量渲染到右侧预览
 * 渲染后保持用户当前阅读锚点（避免打断预览阅读），无锚点时跟随编辑位置
 */
async function renderPreview(): Promise<void> {
  const host = previewHostRef.value
  if (!host || !view) return

  const seq = ++renderSeq
  const content = view.state.doc.toString()
  const before = capturePreviewAnchor()

  const renderer = new MarkdownRenderer(previewConfig)
  const result = await renderer.render(content)
  if (seq !== renderSeq) return // 有更新的渲染在途，丢弃本次结果

  if (!result.success) {
    lastTocItems = null
    host.innerHTML = `
      <div class="chart-error" style="display:block;padding:24px;text-align:center;color:var(--md-text-secondary,#6e6e73)">
        <div class="error-icon">⚠️</div>
        <div class="error-message">渲染失败：${result.error || '未知错误'}</div>
      </div>
    `
    return
  }

  lastTocItems = result.success ? renderer.getTocItems() : null

  // 复用正式渲染的 DOM 结构与皮肤属性，全局 CSS（content.css 等）自动生效。
  // ⚠️ 必须包 .markdown-reader-container 外层：content-variables.css 的标题/链接/列表/段落
  // 等全部基础排版样式都以 .markdown-reader-container 为前缀，缺这层预览就是浏览器默认排版
  //（字号/行距/标题颜色全不对，与正式阅读不一致）。
  host.innerHTML = `
    <div class="markdown-reader-container" data-skin="${previewConfig.skin || 'gov'}">
      <div class="markdown-reader-content">
        ${result.content}
      </div>
    </div>
  `

  await renderChartsInPreview(host)
  renderMathInPreview(host)
  // 表格字号自适应（与 content/main.ts autoFitTableFont 同逻辑）：
  // 内容放不下时自动缩小字号（最小 9px），减少大量换行——同一套渲染规则
  autoFitPreviewTableFont(host)

  // 恢复位置：优先保持用户阅读锚点；无锚点（从未在预览滚动）时跟随编辑位置
  if (before) {
    restorePreviewAnchor(before)
  } else {
    syncEditToPreview()
  }
}

/** 编辑内容变化时重建编辑侧标题索引（滚动同步用） */
function rebuildEditHeadings(): void {
  if (!view) return
  const doc = view.state.doc.toString()
  const headings: Array<{ line: number; text: string }> = []
  const headingRegex = /^(#{1,6})\s+(.+?)\s*$/gm
  let m: RegExpExecArray | null
  while ((m = headingRegex.exec(doc)) !== null) {
    const line = doc.slice(0, m.index).split('\n').length
    headings.push({ line, text: m[2].trim() })
  }
  editHeadings = headings
}

/** 滚动同步防循环：设置对端 scrollTop 前锁定，下一帧释放 */
function beginSync(): void {
  syncing = true
  requestAnimationFrame(() => {
    syncing = false
  })
}

/**
 * 编辑滚动 → 预览跟随（纯百分比同步，业界 Joplin/SplitMark 同款）：
 * ratio = scrollTop / (scrollHeight − clientHeight)，两端天然对齐——
 * 编辑到底 → 预览必到底；编辑在顶 → 预览在顶
 */
function syncEditToPreview(): void {
  const host = previewHostRef.value
  if (!view || !host || syncing) return

  const editScrollTop = view.scrollDOM.scrollTop
  const editEnd = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight
  const pEnd = host.scrollHeight - host.clientHeight
  if (editEnd <= 0 || pEnd <= 0) return
  beginSync()
  host.scrollTop = Math.min(Math.max((editScrollTop / editEnd) * pEnd, 0), pEnd)
}

/** 预览滚动 → 编辑跟随（纯百分比同步，与正向对称） */
function syncPreviewToEdit(): void {
  const host = previewHostRef.value
  if (!view || !host || syncing) return

  const st = host.scrollTop
  const pEnd = host.scrollHeight - host.clientHeight
  const editEnd = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight
  if (pEnd <= 0 || editEnd <= 0) return
  beginSync()
  view.scrollDOM.scrollTop = Math.min(Math.max((st / pEnd) * editEnd, 0), editEnd)
}

/** 捕获预览当前阅读锚点（百分比 0-1），渲染后用于恢复相对位置 */
function capturePreviewAnchor(): number | null {
  const host = previewHostRef.value
  if (!host) return null
  const pEnd = host.scrollHeight - host.clientHeight
  if (pEnd <= 0) return null
  return host.scrollTop / pEnd
}

/** 渲染后按百分比锚点恢复预览滚动位置 */
function restorePreviewAnchor(anchor: number): void {
  const host = previewHostRef.value
  if (!host) return
  const pEnd = host.scrollHeight - host.clientHeight
  if (pEnd <= 0) return
  beginSync()
  host.scrollTop = Math.min(Math.max(anchor * pEnd, 0), pEnd)
}


/** 预览内图表渲染（与 content/main.ts renderChartsInContainer 同逻辑） */
async function renderChartsInPreview(container: HTMLElement): Promise<void> {
  const chartContainers = container.querySelectorAll<HTMLElement>('.chart-container[data-chart-type][data-chart-id]')
  await Promise.all(
    Array.from(chartContainers).map(async (chartElement) => {
      const chartType = chartElement.getAttribute('data-chart-type')
      const chartId = chartElement.getAttribute('data-chart-id')
      const contentElement = chartElement.querySelector<HTMLElement>('.chart-content[data-content]')
      if (!chartType || !chartId || !contentElement) return
      const encodedContent = contentElement.getAttribute('data-content')
      if (!encodedContent) return

      try {
        await asyncChartRenderer.renderChart({
          type: chartType,
          content: decodeURIComponent(encodedContent),
          containerId: chartId,
          timeout: 15000,
          retryCount: 3,
          cacheEnabled: true
        })
      } catch (err) {
        console.warn('预览图表渲染失败:', err)
      }
    })
  )
}

/** 预览内公式渲染（与 content/main.ts renderMathInContainer 同逻辑） */
function renderMathInPreview(container: HTMLElement): void {
  if (!previewConfig.enableMath || previewConfig.mathRenderer !== 'katex') return

  container.querySelectorAll<HTMLElement>('.math-inline, .math-block').forEach((el) => {
    const displayMode = el.classList.contains('math-block')
    const tex = (el.textContent || '').trim()
    // 保留 LaTeX 源码供 Word 导出（katex.render 替换内容后无 annotation，textContent 为拍平乱码）
    el.dataset.latex = tex
    try {
      katex.render(tex, el, {
        displayMode,
        throwOnError: false,
        output: 'html',
        strict: false
      })
    } catch {
      el.classList.add('math-error')
      el.textContent = tex
    }
  })
}

/** 预览内表格字号自适应（与 content/main.ts autoFitTableFont 同逻辑，同一套渲染规则） */
function autoFitPreviewTableFont(container: HTMLElement): void {
  try {
    const MIN_FONT = 9
    const MAX_ROUNDS = 4
    const tables = container.querySelectorAll<HTMLTableElement>('table')
    if (tables.length === 0) return
    tables.forEach((table) => {
      const cells = Array.from(table.querySelectorAll<HTMLElement>('th, td'))
      if (cells.length === 0) return
      let current = parseFloat(window.getComputedStyle(table).fontSize) || 16
      let guard = 0
      while (guard < MAX_ROUNDS) {
        const originals = cells.map((cell) => cell.style.whiteSpace)
        cells.forEach((cell) => { cell.style.whiteSpace = 'nowrap' })
        const overflow = table.scrollWidth > table.clientWidth + 1
        cells.forEach((cell, index) => { cell.style.whiteSpace = originals[index] })
        if (!overflow || current <= MIN_FONT) break
        current = Math.max(MIN_FONT, current - 1)
        table.style.fontSize = `${current}px`
        guard++
      }
    })
  } catch {
    // 忽略表格自适应失败（预览不阻塞）
  }
}

/**
 * 保存为新的版本文件（不覆盖原文件）：
 * 1. 主通道：消息转发 background 执行（downloads/tabs API 仅 background 可用）
 *    → saveAs 弹系统保存框 → 拿最终路径 → 自动打开（file:// 页签 → 系统程序降级）
 * 2. 兜底 File System Access API（showSaveFilePicker，无自动打开能力）
 * 3. 最后兜底 a[download] + Blob URL
 */
async function save(): Promise<void> {
  if (!view || isSaving.value) return
  const content = view.state.doc.toString()
  const filename = targetFilename.value
  isSaving.value = true

  try {
    // 1) 主通道：background 保存+打开（content script 无 downloads/tabs 权限）
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_FILE',
        payload: { content, filename }
      })
      console.log('[编辑器] SAVE_FILE 响应:', JSON.stringify(response))
      if (response?.success) {
        const savedPath = response.data?.path
        showSuccess('保存成功', savedPath ? `已保存为 ${filename}\n位置：${savedPath}` : `已保存为 ${filename}`)
        props.onClose?.()
        return
      }
      // 用户取消保存框 → 静默；其他错误 → 降级
      if (response?.data?.canceled) {
        console.log('[编辑器] 用户取消保存框')
        return
      }
      console.warn('[编辑器] background 保存失败，降级 showSaveFilePicker:', response?.error)
    } catch (err: unknown) {
      console.warn('[编辑器] SAVE_FILE 消息异常，降级 showSaveFilePicker:', err)
    }

    // 2) File System Access API（Chrome/Edge，直接写入本地文件；无路径无法自动打开）
    const picker = (window as unknown as { showSaveFilePicker?: (...args: unknown[]) => Promise<unknown> }).showSaveFilePicker
    if (typeof picker === 'function') {
      try {
        const handle = (await picker.call(window, {
          suggestedName: filename,
          types: [{ description: 'Markdown 文档', accept: { 'text/markdown': ['.md', '.markdown'] } }]
        })) as {
          createWritable: () => Promise<{
            write: (data: string) => Promise<void>
            close: () => Promise<void>
          }>
        }
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        showSuccess('保存成功', `已保存为 ${filename}`)
        props.onClose?.()
        return
      } catch (err: unknown) {
        // 用户取消保存框 → 静默返回；其他错误 → 降级
        if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') {
          return
        }
        console.warn('showSaveFilePicker 保存失败，降级 a[download]:', err)
      }
    }

    // 3) a[download] + Blob URL 兜底
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    showSuccess('保存成功', `已保存为 ${filename}`)
    props.onClose?.()
  } catch (err) {
    console.error('保存失败:', err)
    showError('保存失败', '无法保存文件，请检查浏览器权限设置')
  } finally {
    isSaving.value = false
  }
}

</script>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.editor-panel {
  /* 占满 overlay 全部可用区域（overlay 四周留 24px 边距），编辑/预览空间最大化 */
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  /* 毛玻璃效果自实现：不依赖全局 .liquid-glass（其 hover 规则会把背景盖成白色，
     深色模式下导致白底白字不可见——颜色互斥修复） */
  background: color-mix(in srgb, var(--md-bg-primary, #ffffff) 82%, transparent);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  color: var(--md-text-primary, #1d1d1f);
  border: 1px solid var(--md-border-primary, rgba(0, 0, 0, 0.1));
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
  transition: none;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--md-border-primary, rgba(0, 0, 0, 0.1));
  flex-shrink: 0;
}

.editor-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 2px 0;
}

.editor-subtitle {
  font-size: 12px;
  color: var(--md-text-secondary, #6e6e73);
  margin: 0;
}

.editor-arrow {
  margin: 0 6px;
  opacity: 0.6;
}

.editor-target {
  color: var(--md-accent-primary, #007aff);
  font-weight: 600;
}

.editor-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--md-text-secondary, #6e6e73);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.editor-close-btn:hover {
  background: var(--md-border-primary, rgba(0, 0, 0, 0.1));
}

.editor-split {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.editor-pane {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.editor-preview {
  overflow-y: auto;
  background: var(--md-bg-primary, #ffffff);
  border-left: 1px solid var(--md-border-primary, rgba(0, 0, 0, 0.1));
  /* position: relative 让标题 offsetTop 相对本容器计算（滚动同步依赖） */
  position: relative;
}

.editor-preview :deep(.markdown-reader-content) {
  padding: 20px 24px;
  max-width: 100%;
  margin: 0 auto;
}

/* 预览内 .markdown-reader-container：结构与正式阅读一致（排版样式生效），
   但覆盖容器级外观——不撑满视口、不叠加大 padding（min-height 100vh / padding 由
   content-variables.css 定义，预览里由 .editor-preview 自身滚动承担） */
.editor-preview :deep(.markdown-reader-container) {
  min-height: auto;
  padding: 0;
  max-width: 100%;
}

.editor-preview .chart-source-code {
  margin: 8px 16px;
  padding: 12px;
  background: var(--md-bg-secondary, rgba(0, 0, 0, 0.06));
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 预览区选中样式：与主文档一致的颜色互斥（半透明强调色背景 + 主文字色），
   任意主题/强调色下选中文字都清晰可见 */
.editor-preview ::selection {
  background: color-mix(in srgb, var(--md-accent-primary, #007aff) 35%, transparent);
  color: var(--md-text-primary, #1d1d1f);
}

.editor-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--md-border-primary, rgba(0, 0, 0, 0.1));
  flex-shrink: 0;
}

.editor-status {
  font-size: 12px;
  color: var(--md-text-secondary, #6e6e73);
  flex-shrink: 0;
}

.editor-hint {
  flex: 1;
  font-size: 12px;
  color: var(--md-text-secondary, #6e6e73);
  opacity: 0.8;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-format-btn {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid var(--md-border-primary, rgba(0, 0, 0, 0.15));
  background: var(--md-bg-secondary, rgba(0, 0, 0, 0.05));
  color: var(--md-text-primary, #1d1d1f);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.editor-format-btn:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.editor-format-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor-save-btn {
  padding: 8px 18px;
  border-radius: 10px;
  border: none;
  background: var(--md-accent-primary, #007aff);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.editor-save-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.editor-save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

<!-- CodeMirror 内部 DOM 不在组件根下，需非 scoped 样式（用前缀限定范围避免污染页面） -->
<style>
.editor-panel .cm-editor {
  height: 100%;
  font-size: 14px;
}

.editor-panel .cm-editor.cm-focused {
  outline: none;
}

.editor-panel .cm-scroller {
  font-family: var(--md-font-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  line-height: 1.6;
  padding: 8px 0;
}
</style>
