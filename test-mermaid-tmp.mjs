import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mermaid = require('mermaid/dist/mermaid.min.js')

const code = `sequenceDiagram
    participant U as 用户
    participant B as 浏览器
    participant P as 插件(Content Script)
    participant E as 编辑器(双屏)
    participant R as 渲染管线

    U->>B: 打开 .md / .markdown 文件
    B->>P: 页面加载完成（document_end 注入）
    P->>P: 智能检测 Markdown 文档
    alt 是 Markdown 文档
        P->>R: 提取原始内容并渲染
        R-->>B: 替换页面内容（公文风格排版）
        P->>E: 点击 ✏️ 进入双屏编辑
        E->>R: 编辑内容变化（400ms 防抖）
        R-->>E: 实时渲染到右侧预览
        E->>E: 滚动联动 / 一键格式化 / 目录导航
        E-->>U: 保存为版本号新文件（自动打开）
    else 非 Markdown 页面
        P-->>B: 不干预页面
    end`

try {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', sequence: { useMaxWidth: true, wrap: true } })
  const { svg } = await mermaid.render('test-seq', code)
  console.log('RENDER_OK svg_len=' + svg.length + ' has_foreignObject=' + svg.includes('foreignObject'))
} catch (e) {
  console.log('RENDER_FAIL: ' + e.message)
  console.log('CAUSE: ' + (e.cause ? (e.cause.message || JSON.stringify(e.cause)) : '(none)'))
}
