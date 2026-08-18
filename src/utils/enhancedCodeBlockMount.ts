import { createApp, type App } from 'vue'
import EnhancedCodeBlock from '../components/EnhancedCodeBlock.vue'

const mountedCodeBlocks = new Map<HTMLElement, App>()

function getCodeBlockHosts(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-enhanced-code-block-host]'))
}

export function mountEnhancedCodeBlocks(root: ParentNode): void {
  getCodeBlockHosts(root).forEach((host) => {
    if (mountedCodeBlocks.has(host)) return

    const template = host.querySelector<HTMLTemplateElement>('[data-enhanced-code-template]')
    const codeElement = template?.content.querySelector('code')
    if (!codeElement) return

    const app = createApp(EnhancedCodeBlock, {
      codeId: host.dataset.codeId || `code-${Date.now()}`,
      language: host.dataset.language || 'text',
      code: codeElement.textContent || '',
      highlightedCode: codeElement.innerHTML
    })

    app.mount(host)
    mountedCodeBlocks.set(host, app)
  })
}

export function unmountEnhancedCodeBlocks(root: ParentNode): void {
  mountedCodeBlocks.forEach((app, host) => {
    if (root.contains(host) || !host.isConnected) {
      app.unmount()
      mountedCodeBlocks.delete(host)
    }
  })
}
