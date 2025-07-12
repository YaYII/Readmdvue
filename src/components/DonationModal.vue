<template>
  <div class="donation-modal-overlay" @click="handleOverlayClick">
    <div class="donation-modal" :class="tocLayoutClass" @click.stop>
      <!-- 关闭按钮 -->
      <button @click="close" class="donation-modal-close" title="关闭" data-close-btn>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- 标题区域 -->
      <div class="donation-header">
        <div class="donation-icon">💝</div>
        <h2 class="donation-title">支持开发者</h2>
        <p class="donation-subtitle">如果这个插件对您有帮助，欢迎扫码支持开发者继续改进！</p>
      </div>

      <!-- 二维码区域 -->
      <div class="donation-qr-container">
        <div class="donation-qr-item">
          <div class="donation-qr-wrapper">
            <img 
              :src="wechatPayImg" 
              alt="微信支付" 
              class="donation-qr-img"
            />
          </div>
          <span class="donation-qr-label">微信支付</span>
        </div>
        
        <div class="donation-qr-item">
          <div class="donation-qr-wrapper">
            <img 
              :src="alipayImg" 
              alt="支付宝" 
              class="donation-qr-img"
            />
          </div>
          <span class="donation-qr-label">支付宝</span>
        </div>
      </div>

      <!-- 感谢语 -->
      <div class="donation-footer">
        <p class="donation-thanks">感谢您的支持！❤️</p>
        <p class="donation-note">您的支持是我们持续改进的动力</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
// 直接导入图片文件，让Vite自动处理路径
import wechatPayImgUrl from '../assets/pay/24d4be73eecb41422cacfedef3002456.jpg'
import alipayImgUrl from '../assets/pay/8832d512343a8573d8bb212463ae15a9.jpg'

// 处理浏览器插件环境中的图片路径
const getPluginImageUrl = (importedUrl: string): string => {
  // 检查是否在浏览器插件环境中
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    // 如果是 file:// 协议，需要转换为 chrome-extension:// 协议
    if (importedUrl.startsWith('file://')) {
      // 提取文件名
      const filename = importedUrl.split('/').pop() || ''
      return chrome.runtime.getURL(`assets/${filename}`)
    }
    // 如果已经是相对路径，直接使用 chrome.runtime.getURL
    if (!importedUrl.startsWith('http') && !importedUrl.startsWith('chrome-extension://')) {
      return chrome.runtime.getURL(importedUrl)
    }
  }
  return importedUrl
}

const wechatPayImg = computed(() => getPluginImageUrl(wechatPayImgUrl))
const alipayImg = computed(() => getPluginImageUrl(alipayImgUrl))

interface Props {
  onClose?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  onClose: undefined
})

// 推拉式布局相关状态
const tocVisible = ref(false)
const tocCollapsed = ref(false)
let tocObserver: MutationObserver | null = null

// 推拉式布局计算属性
const tocLayoutClass = computed(() => {
  if (!tocVisible.value) return ''
  return tocCollapsed.value ? 'toc-collapsed' : 'toc-expanded'
})

// 设置目录菜单状态监听器
const setupTocStateListeners = () => {
  try {
    // 检查目录面板状态
    const checkTocPanel = () => {
      const tocPanel = document.querySelector('.toc-panel')
      if (tocPanel) {
        // 检查目录是否可见
        const isVisible = tocPanel.classList.contains('show')
        const isCollapsed = tocPanel.classList.contains('collapsed')
        
        // 更新状态
        tocVisible.value = isVisible
        tocCollapsed.value = isCollapsed
        
        console.log('赞赏弹窗 - 目录状态更新:', {
          visible: tocVisible.value,
          collapsed: tocCollapsed.value,
          layoutClass: tocLayoutClass.value
        })
      } else {
        // 目录面板不存在，重置状态
        tocVisible.value = false
        tocCollapsed.value = false
        console.log('赞赏弹窗 - 目录面板不存在，重置状态')
      }
    }
    
    // 初始检查
    requestAnimationFrame(() => {
      checkTocPanel()
    })
    
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
    
    // 保存observer引用
    tocObserver = observer
    
    console.log('赞赏弹窗 - 目录菜单状态监听器已设置')
  } catch (error) {
    console.error('赞赏弹窗 - 设置目录菜单状态监听器失败:', error)
  }
}

// 清理目录菜单状态监听器
const cleanupTocStateListeners = () => {
  if (tocObserver) {
    tocObserver.disconnect()
    tocObserver = null
  }
}

// 隐藏模态框
const close = () => {
  if (props.onClose) {
    props.onClose()
  }
}

// 点击遮罩层关闭
const handleOverlayClick = () => {
  close()
}

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  setupTocStateListeners()
  document.addEventListener('keydown', handleKeydown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  cleanupTocStateListeners()
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* 引入打赏弹窗样式表 */
@import '../styles/donation-modal.css';
</style>