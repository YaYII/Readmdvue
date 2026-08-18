/**
 * 目录渲染独立模块（HTML → Word 的目录/嵌套列表/目录树转换）。
 * 单独成模块 + 单元测试：目录渲染对不对，一测便知。
 * 依赖：docxPure.ts（wrapLongLine 等纯函数）；列表结构提取只依赖标准 DOM API
 *（children/tagName/cloneNode/querySelectorAll），可用最小 DOM 模拟直接 node:test。
 */
import { wrapLongLine } from './docxPure.ts'

/** 列表缩进步长（twips）：一级 360，每深一层 +360 */
export const LIST_INDENT_STEP = 360

/** TEXT_NODE 类型常量（不用全局 Node：node:test 环境 Node 未定义，且 htmlToDocx.ts 浏览器环境只是另有引用） */
const TEXT_NODE_TYPE = 3

/** 列表项前缀（公文风格）：有序 `1. `，无序 `• ` */
export function listPrefix(ordered: boolean, index: number): string {
  return ordered ? `${index}. ` : '• '
}

/** 列表项缩进（twips）：层级越深越缩进 */
export function listIndent(depth: number): number {
  return LIST_INDENT_STEP + depth * LIST_INDENT_STEP
}

/** 单个列表项的结构描述（纯数据，不含 docx） */
export interface ListItemSpec {
  ordered: boolean
  index: number
  depth: number
  /** li 剥离嵌套 ul/ol 后的内容（DOM），由转换器再走 extractRuns 保留 inline 样式 */
  content: HTMLElement
}

/**
 * 递归收集列表项结构：深度优先，嵌套 ul/ol 的 li 逐层展开。
 * 等价于 convertList 的遍历逻辑——抽出来单独测"目录结构对不对"。
 */
export function collectListItems(el: HTMLElement, ordered: boolean, depth: number, out: ListItemSpec[]): void {
  let i = 0
  for (const child of Array.from(el.children)) {
    if (child.tagName.toLowerCase() !== 'li') continue
    i++
    const li = child as HTMLElement
    // 剥离 li 内嵌套列表（只取直接内容），嵌套列表单独递归
    const content = li.cloneNode(true) as HTMLElement
    content.querySelectorAll('ul, ol').forEach((n) => n.remove())
    // 清理残留的纯空白文本节点（marked 输出 <li><p>第一章</p>\n<ul>…：</p> 与 <ul> 之间的
    // 换行是独立文本节点，剥除嵌套列表后残留）。若不清理，extractRuns 会把 "\n" 转成
    // break → 父项段落后多一个空白行（"父子交界处多出空白行"根因）。
    Array.from(content.childNodes).forEach((n) => {
      if (n.nodeType === TEXT_NODE_TYPE && !(n.textContent || '').trim()) n.remove()
    })
    out.push({ ordered, index: i, depth, content })
    for (const nested of Array.from(li.children)) {
      const t = nested.tagName.toLowerCase()
      if (t === 'ul' || t === 'ol') {
        collectListItems(nested as HTMLElement, t === 'ol', depth + 1, out)
      }
    }
  }
}

/** 目录树/代码块的一行展示描述 */
export interface DisplayLine {
  text: string
  /** 该行前是否需要换行（连续空行合并后只有一行 break） */
  breakBefore: boolean
}

/**
 * 目录树/代码块文本 → 展示行序列（纯逻辑，可测）：
 * - 压缩超长连续空格（对齐用长空格 → 2 个）、去行尾空格
 * - 长行在空格处主动换行（不硬断单词）
 * - 连续空行合并（目录树不能出现空白行）
 */
export function processDirectoryLines(code: string, maxLen: number): DisplayLine[] {
  const out: DisplayLine[] = []
  let needsBreak = false // 前面的行（内容或空行）需要给下一个非空行加换行；连续空行只标记一次
  code.split('\n').forEach((line, i) => {
    const cleaned = line.replace(/ {3,}/g, '  ').replace(/ +$/g, '')
    if (cleaned === '') {
      // 空行：标记换行需求（首行空行不标记），连续空行不重复
      if (i > 0) needsBreak = true
      return
    }
    const wrapped = wrapLongLine(cleaned, maxLen)
    wrapped.forEach((seg, j) => {
      // 长行续行（j>0）必换行；否则看前面是否有换行需求（内容行/空行）
      const breakBefore = j > 0 ? true : needsBreak
      if (seg) {
        out.push({ text: seg, breakBefore })
      }
    })
    needsBreak = true // 本行输出后，下一行需要换行
  })
  return out
}

export function preserveCodeLines(code: string): DisplayLine[] {
  return code.replace(/\r\n?/g, '\n').split('\n').map((text, index) => ({
    text,
    breakBefore: index > 0,
  }))
}
