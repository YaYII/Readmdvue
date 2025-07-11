/**
 * 强调色管理组合式函数
 * 基于苹果设计系统的动态强调色切换
 */

import { ref, watch, onMounted } from 'vue'
import type { AccentColor } from '../types'
import { accentColors } from '../types'

export function useAccentColor() {
  const currentAccentColor = ref<AccentColor>('blue')

  /**
   * 更新强调色
   * @param accentColor 新的强调色
   */
  const updateAccentColor = (accentColor: AccentColor) => {
    // 移除之前的强调色类
    const allAccentClasses = Object.keys(accentColors).map(color => `accent-${color}`)
    document.documentElement.classList.remove(...allAccentClasses)
    
    // 添加新的强调色类
    document.documentElement.classList.add(`accent-${accentColor}`)
    
    // 更新当前强调色
    currentAccentColor.value = accentColor
    
    // 保存到本地存储
    localStorage.setItem('markdown-reader-accent-color', accentColor)
    
    console.log(`强调色已切换为: ${accentColors[accentColor].displayName}`)
  }

  /**
   * 从本地存储加载强调色
   */
  const loadAccentColor = () => {
    const savedAccentColor = localStorage.getItem('markdown-reader-accent-color') as AccentColor
    if (savedAccentColor && accentColors[savedAccentColor]) {
      updateAccentColor(savedAccentColor)
    } else {
      updateAccentColor('blue') // 默认蓝色
    }
  }

  /**
   * 获取当前强调色信息
   */
  const getCurrentAccentColorInfo = () => {
    return accentColors[currentAccentColor.value]
  }

  /**
   * 获取强调色的CSS变量值
   */
  const getAccentColorValue = (accentColor: AccentColor) => {
    return accentColors[accentColor].primaryColor
  }

  /**
   * 应用强调色到特定元素
   * 通过CSS类而非直接设置CSS变量
   */
  const applyAccentColorToElement = (element: HTMLElement, accentColor: AccentColor) => {
    // 移除现有的强调色类
    const allAccentClasses = Object.keys(accentColors).map(color => `accent-${color}`)
    element.classList.remove(...allAccentClasses)
    
    // 添加新的强调色类
    element.classList.add(`accent-${accentColor}`)
    
    // 设置data属性供CSS选择器使用
    element.setAttribute('data-accent-color', accentColor)
  }

  // 监听强调色变化
  watch(currentAccentColor, (newColor) => {
    // 触发自定义事件，通知其他组件强调色已变化
    const event = new CustomEvent('accent-color-changed', {
      detail: {
        accentColor: newColor,
        colorInfo: accentColors[newColor]
      }
    })
    window.dispatchEvent(event)
  })

  // 组件挂载时加载强调色
  onMounted(() => {
    loadAccentColor()
  })

  return {
    currentAccentColor,
    updateAccentColor,
    loadAccentColor,
    getCurrentAccentColorInfo,
    getAccentColorValue,
    applyAccentColorToElement,
    accentColors
  }
}