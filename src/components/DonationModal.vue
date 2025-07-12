<template>
  <div class="donation-modal-overlay" @click="handleOverlayClick">
    <div class="donation-modal" @click.stop>
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
import { onMounted, onUnmounted, computed } from 'vue'
// 直接导入图片文件，让Vite自动处理路径
import wechatPayImgUrl from '../assets/pay/24d4be73eecb41422cacfedef3002456.jpg'
import alipayImgUrl from '../assets/pay/8832d512343a8573d8bb212463ae15a9.jpg'

// 处理浏览器插件环境中的图片路径
const getPluginImageUrl = (importedUrl: string): string => {
  // 检查是否在浏览器插件环境中
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    // 如果是 file:// 协议，需要转换为 chrome-extension:// 协议
    if (importedUrl.startsWith('file://')) {
      // 提取文件名部分
      const fileName = importedUrl.split('/').pop() || ''
      return chrome.runtime.getURL(`assets/${fileName}`)
    }
    // 如果已经是相对路径，直接使用 chrome.runtime.getURL
    if (importedUrl.startsWith('/assets/') || importedUrl.startsWith('assets/')) {
      return chrome.runtime.getURL(importedUrl.replace(/^\//, ''))
    }
  }
  // 开发环境或其他环境直接返回原路径
  return importedUrl
}

// 计算属性，确保图片路径在插件环境中正确
const wechatPayImg = computed(() => getPluginImageUrl(wechatPayImgUrl))
const alipayImg = computed(() => getPluginImageUrl(alipayImgUrl))

interface Props {
  onClose?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  onClose: undefined
})

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
  document.addEventListener('keydown', handleKeydown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* 引入打赏弹窗样式表 */
@import '../styles/donation-modal.css';
</style>