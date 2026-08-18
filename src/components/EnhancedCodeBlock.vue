<template>
  <div class="enhanced-code-block" :data-language="language">
    <div class="code-content" :id="codeId">
      <button
        type="button"
        class="code-hover-copy"
        :class="{ 'copy-success': copyState === 'success', 'copy-fail': copyState === 'fail' }"
        :title="copyTitle"
        :aria-label="copyTitle"
        @click="copyCode"
      >
        <svg v-if="copyState === 'idle'" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
          <rect x="6" y="6" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
        <span v-else aria-hidden="true">{{ copyState === 'success' ? '✓' : '!' }}</span>
      </button>
      <pre><code :class="codeClass" v-html="highlightedCode"></code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { showError, showSuccess } from '../utils/appleNotification'
import { normalizeCodeLanguage } from '../utils/enhancedCodeBlockMarkup'

interface Props {
  codeId: string
  language: string
  code: string
  highlightedCode: string
}

const props = defineProps<Props>()
const copyState = ref<'idle' | 'success' | 'fail'>('idle')
let resetTimer: ReturnType<typeof setTimeout> | null = null

const language = computed(() => normalizeCodeLanguage(props.language))
const codeClass = computed(() => `hljs language-${language.value}`)
const copyTitle = computed(() => {
  if (copyState.value === 'success') return '已复制'
  if (copyState.value === 'fail') return '复制失败'
  return '复制代码'
})

function copyViaExecCommand(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  } catch {
    return false
  }
}

function setCopyState(state: 'success' | 'fail'): void {
  copyState.value = state
  if (resetTimer !== null) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copyState.value = 'idle'
    resetTimer = null
  }, 1600)
}

async function copyCode(): Promise<void> {
  const text = props.code.trim()
  if (!text) return

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else if (!copyViaExecCommand(text)) {
      throw new Error('execCommand 复制失败')
    }
    setCopyState('success')
    showSuccess('复制成功', '代码已复制到剪贴板')
  } catch (error) {
    if (copyViaExecCommand(text)) {
      setCopyState('success')
      showSuccess('复制成功', '代码已复制到剪贴板')
      return
    }
    setCopyState('fail')
    showError('复制失败', error instanceof Error ? error.message : '无法复制到剪贴板')
  }
}

onBeforeUnmount(() => {
  if (resetTimer !== null) clearTimeout(resetTimer)
})
</script>

<style scoped>
.enhanced-code-block {
  width: 100%;
  min-width: 0;
  margin: 0;
}

.code-content {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  font-family: var(--md-font-family-mono, var(--apple-font-mono));
  font-size: var(--font-size-sm, 13px);
  line-height: 1.6;
}

.code-content pre {
  box-sizing: border-box;
  width: max-content;
  min-width: 100%;
  margin: 0;
  padding: 10px;
  overflow: visible;
  background: var(--md-bg-code, transparent);
  border: 0;
  border-radius: var(--md-radius-md, 8px);
}

.code-content code {
  display: block;
  min-width: max-content;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  color: var(--md-text-code, currentColor);
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  white-space: pre;
}

.code-hover-copy {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  display: flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: rgba(28, 28, 30, 0.8);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.2s ease, transform 0.15s ease, background 0.2s ease;
}

.code-content:hover .code-hover-copy,
.code-hover-copy:focus-visible {
  opacity: 1;
  transform: translateY(0);
}

.code-hover-copy:hover {
  background: rgba(28, 28, 30, 0.95);
  transform: scale(1.08);
}

.code-hover-copy.copy-success {
  background: #2ea44f;
  opacity: 1;
  transform: translateY(0);
}

.code-hover-copy.copy-fail {
  background: #d73a49;
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .code-hover-copy {
    transition: none;
  }
}
</style>
