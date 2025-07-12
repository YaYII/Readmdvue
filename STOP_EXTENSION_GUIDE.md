# 🛑 Markdown Reader Vue 插件停止运行指南

## 概述

本指南详细说明了如何在任何位置停止 Markdown Reader Vue 浏览器插件的运行。我们提供了多种停止方式，以满足不同场景的需求。

## 🎯 停止方式一览

### 1. 通过 Popup 界面停止（推荐）

**适用场景：** 日常使用，最简单直观的方式

**操作步骤：**
1. 点击浏览器工具栏中的插件图标
2. 在弹出的 Popup 界面中，找到红色的"停止运行"按钮
3. 点击按钮即可停止当前标签页的插件运行

**特点：**
- ✅ 操作简单，用户友好
- ✅ 有视觉反馈和确认
- ✅ 安全可靠
- ✅ 只影响当前标签页

### 2. 通过浏览器控制台停止（开发者推荐）

**适用场景：** 开发调试、快速停止、批量操作

#### 2.1 停止当前页面的插件
```javascript
// 方法一：直接停止（推荐）
stopMarkdownReader()

// 方法二：禁用插件（保留DOM但停止功能）
disableMarkdownReader()

// 方法三：清理资源（彻底清理）
cleanupMarkdownReader()

// 方法四：通过消息系统停止
stopMarkdownReaderViaMessage()
```

#### 2.2 全局停止插件（所有标签页）
```javascript
// 在任意标签页的控制台执行
chrome.runtime.sendMessage({
  type: 'STOP_EXTENSION',
  payload: { reason: 'global_stop' }
})
```

**操作步骤：**
1. 按 `F12` 或右键选择"检查"打开开发者工具
2. 切换到 "Console"（控制台）标签
3. 输入上述任一命令并按回车执行

**特点：**
- ✅ 快速执行
- ✅ 支持批量操作
- ✅ 适合开发调试
- ✅ 可以选择不同的停止级别

### 3. 通过扩展管理页面停止

**适用场景：** 完全禁用插件，影响所有标签页

**操作步骤：**
1. 在地址栏输入 `chrome://extensions/`
2. 找到 "Markdown Reader Vue" 插件
3. 关闭插件开关

**特点：**
- ✅ 完全禁用插件
- ✅ 影响所有标签页
- ⚠️ 需要重新启用才能使用

## 🔧 技术实现详情

### 停止级别说明

#### Level 1: Stop Extension（停止运行）
- **功能：** 停止插件的主要功能，但保留基础结构
- **影响：** Markdown 渲染停止，交互功能禁用
- **恢复：** 需要刷新页面或重新启动插件

#### Level 2: Disable Extension（禁用插件）
- **功能：** 禁用所有插件功能，保留 DOM 结构
- **影响：** 所有功能停止，但页面元素保留
- **恢复：** 可以通过重新启用恢复

#### Level 3: Cleanup Extension（清理资源）
- **功能：** 彻底清理所有插件相关资源
- **影响：** 移除所有 DOM 元素、样式、事件监听器
- **恢复：** 需要刷新页面

### 消息传递机制

插件使用 Chrome Extension 的消息传递 API 实现跨组件通信：

```typescript
// 消息类型定义
interface StopMessage {
  type: 'STOP_EXTENSION' | 'DISABLE_EXTENSION' | 'CLEANUP_EXTENSION'
  payload: {
    tabId?: number
    reason: string
  }
}
```

### 全局方法导出

在每个注入了插件的页面，都会导出以下全局方法：

```javascript
// 全局可用的停止方法
window.stopMarkdownReader()           // 停止运行
window.disableMarkdownReader()        // 禁用插件
window.cleanupMarkdownReader()        // 清理资源
window.stopMarkdownReaderViaMessage() // 通过消息系统停止
```

## 🚨 注意事项

### 安全提醒
- ✅ 所有停止方法都是安全的，不会影响页面的其他功能
- ✅ 停止插件不会丢失页面数据或用户输入
- ✅ 可以随时重新启用插件

### 性能考虑
- 🔄 停止插件会立即释放相关资源，提升页面性能
- 🔄 清理方法会彻底移除所有插件痕迹
- 🔄 建议在不需要 Markdown 渲染时及时停止插件

### 兼容性说明
- ✅ 支持 Chrome 88+
- ✅ 支持 Edge 88+
- ✅ 支持其他基于 Chromium 的浏览器

## 🛠️ 故障排除

### 常见问题

#### Q: 控制台提示"stopMarkdownReader is not defined"
**A:** 这说明当前页面没有注入插件脚本，可能原因：
- 页面不是 Markdown 文件
- 插件已经被停止
- 页面加载时插件未启用

**解决方案：** 刷新页面或检查插件是否启用

#### Q: 停止后页面样式异常
**A:** 这可能是因为插件的样式被移除导致的

**解决方案：** 使用 `disableMarkdownReader()` 而不是 `cleanupMarkdownReader()`

#### Q: 无法通过 Popup 停止插件
**A:** 可能是权限问题或插件状态异常

**解决方案：** 使用控制台方法或重新加载插件

### 调试方法

```javascript
// 检查插件状态
console.log('插件实例:', window.__MARKDOWN_READER_APP__)

// 获取调试信息
window.__MARKDOWN_READER_DEBUG__()

// 获取性能指标
window.__MARKDOWN_READER_PERFORMANCE__()
```

## 📞 技术支持

如果遇到无法解决的问题，请：

1. 查看浏览器控制台的错误信息
2. 尝试不同的停止方法
3. 重新加载插件或刷新页面
4. 联系开发团队获取支持

---

**版本：** 2.1.0  
**更新日期：** 2025-01-09  
**兼容性：** Chrome 88+, Edge 88+, Chromium-based browsers