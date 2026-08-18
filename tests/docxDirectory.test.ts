/**
 * 目录渲染模块单元测试（docxDirectory.ts）
 * 验证：目录/嵌套列表/目录树渲染对不对——前缀、缩进、层级结构、空行合并、长行换行。
 * 运行：npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  listPrefix,
  listIndent,
  collectListItems,
  processDirectoryLines,
  preserveCodeLines,
  type ListItemSpec,
} from '../src/utils/docxDirectory.ts'

// ===== 最小 DOM 模拟（只实现 collectListItems 用到的 API）=====
class MiniElement {
  tagName: string
  children: MiniElement[]
  text = ''
  parent: MiniElement | null = null
  constructor(tag: string, children: MiniElement[] = [], text = '') {
    this.tagName = tag
    this.text = text
    this.children = children
    for (const c of children) c.parent = this
  }
  get nodeType(): number {
    return this.tagName === '#text' ? 3 : 1
  }
  get childNodes(): MiniElement[] {
    return this.children
  }
  cloneNode(deep: boolean): MiniElement {
    if (!deep) return new MiniElement(this.tagName)
    return new MiniElement(this.tagName, this.children.map((c) => c.cloneNode(true)), this.text)
  }
  remove(): void {
    if (!this.parent) return
    const i = this.parent.children.indexOf(this)
    if (i >= 0) this.parent.children.splice(i, 1)
  }
  querySelectorAll(sel: string): MiniElement[] {
    const targets = sel.split(',').map((s) => s.trim().toLowerCase())
    const res: MiniElement[] = []
    const walk = (n: MiniElement): void => {
      for (const c of n.children) {
        if (targets.includes(c.tagName.toLowerCase())) res.push(c)
        walk(c)
      }
    }
    walk(this)
    return res
  }
  get textContent(): string {
    if (this.children.length === 0) return this.text
    return this.children.map((c) => c.textContent).join('')
  }
}
const li = (text: string, children: MiniElement[] = []): MiniElement =>
  new MiniElement('li', [new MiniElement('#text', [], text), ...children])
const textNode = (t: string): MiniElement => new MiniElement('#text', [], t)
const ul = (items: MiniElement[]): MiniElement => new MiniElement('ul', items)
const ol = (items: MiniElement[]): MiniElement => new MiniElement('ol', items)
const p = (text: string): MiniElement => new MiniElement('p', [new MiniElement('#text', [], text)])

// ===== 1. listPrefix / listIndent =====
test('listPrefix 无序/有序', () => {
  assert.equal(listPrefix(false, 1), '• ')
  assert.equal(listPrefix(true, 1), '1. ')
  assert.equal(listPrefix(true, 12), '12. ')
})
test('listIndent 层级递进', () => {
  assert.equal(listIndent(0), 360)
  assert.equal(listIndent(1), 720)
  assert.equal(listIndent(2), 1080)
})

// ===== 2. collectListItems：目录结构提取 =====
test('collectListItems 无序嵌套列表（目录大纲）', () => {
  const el = ul([li('第一章', [ul([li('1.1 背景'), li('1.2 目標')])]), li('第二章')])
  const specs: ListItemSpec[] = []
  collectListItems(el, false, 0, specs)
  assert.deepEqual(
    specs.map((s) => ({ ordered: s.ordered, index: s.index, depth: s.depth, text: s.content.textContent })),
    [
      { ordered: false, index: 1, depth: 0, text: '第一章' },
      { ordered: false, index: 1, depth: 1, text: '1.1 背景' },
      { ordered: false, index: 2, depth: 1, text: '1.2 目標' },
      { ordered: false, index: 2, depth: 0, text: '第二章' },
    ],
  )
})
test('collectListItems 有序列表前缀编号', () => {
  const el = ol([li('甲'), li('乙')])
  const specs: ListItemSpec[] = []
  collectListItems(el, true, 0, specs)
  assert.deepEqual(specs.map((s) => ({ index: s.index, prefix: listPrefix(s.ordered, s.index) })), [
    { index: 1, prefix: '1. ' },
    { index: 2, prefix: '2. ' },
  ])
})
test('collectListItems li 内包 p（带空行嵌套写法）', () => {
  // marked 输出 <li><p>第一章</p><ul>…（列表项与嵌套列表之间有空行）
  const el = ul([li('', [p('第一章'), ul([li('1.1 背景')])])])
  const specs: ListItemSpec[] = []
  collectListItems(el, false, 0, specs)
  assert.deepEqual(specs.map((s) => ({ depth: s.depth, text: s.content.textContent })), [
    { depth: 0, text: '第一章' }, // li 剥离嵌套 ul 后只剩 <p> 内容
    { depth: 1, text: '1.1 背景' },
  ])
})
test('collectListItems 任务列表 checkbox 文本保留', () => {
  const el = ul([li('', [new MiniElement('input', [], ''), new MiniElement('#text', [], '已完成')])])
  const specs: ListItemSpec[] = []
  collectListItems(el, false, 0, specs)
  assert.equal(specs[0].content.textContent, '已完成')
})
test('collectListItems 剥除嵌套列表后清理残留换行（父子交界空白行根因）', () => {
  // marked loose 输出：<li><p>第一章</p>\n<ul>…</ul></li> —— </p> 与 <ul> 之间的 \n 是独立文本节点，
  // 剥除嵌套列表后若无清理，extractRuns 会把 "\n" 转成 break → 父项段落后多一个空白行
  const el = ul([li('', [p('第一章'), textNode('\n'), ul([li('1.1 背景')])]), li('第二章')])
  const specs: ListItemSpec[] = []
  collectListItems(el, false, 0, specs)
  // 父项 content 不残留任何纯空白文本节点
  assert.deepEqual(specs[0].content.childNodes, [specs[0].content.children[0]])
  assert.equal(specs[0].content.childNodes.length, 1)
  assert.equal(specs[0].content.textContent, '第一章')
  assert.deepEqual(specs.map((s) => ({ depth: s.depth, text: s.content.textContent })), [
    { depth: 0, text: '第一章' },
    { depth: 1, text: '1.1 背景' },
    { depth: 0, text: '第二章' },
  ])
})
test('collectListItems 紧凑嵌套列表无空白节点不受影响', () => {
  // marked 紧凑输出 <li>第一章<ul>…：无独立空文本节点，剥离后原样保留
  const el = ul([li('第一章', [ul([li('1.1 背景')])])])
  const specs: ListItemSpec[] = []
  collectListItems(el, false, 0, specs)
  assert.equal(specs[0].content.textContent, '第一章')
  assert.equal(specs[0].content.childNodes.length, 1)
})

// ===== 3. processDirectoryLines：目录树/代码块行处理 =====
test('processDirectoryLines 多行', () => {
  assert.deepEqual(processDirectoryLines('A\nB', 70), [
    { text: 'A', breakBefore: false },
    { text: 'B', breakBefore: true },
  ])
})
test('processDirectoryLines 空行合并（目录不能有空行）', () => {
  assert.deepEqual(processDirectoryLines('A\n\nB', 70), [
    { text: 'A', breakBefore: false },
    { text: 'B', breakBefore: true },
  ])
  assert.deepEqual(processDirectoryLines('A\n\n\nB', 70), [
    { text: 'A', breakBefore: false },
    { text: 'B', breakBefore: true },
  ])
})
test('processDirectoryLines 末尾空行删除', () => {
  assert.deepEqual(processDirectoryLines('A\n\n', 70), [{ text: 'A', breakBefore: false }])
})
test('processDirectoryLines 压缩连续空格 + 去尾空格', () => {
  assert.deepEqual(processDirectoryLines('├── a    b   \n', 70), [
    { text: '├── a  b', breakBefore: false },
  ])
})
test('processDirectoryLines 长行在空格处换行', () => {
  const long = 'A'.repeat(20) + ' ' + 'B'.repeat(60)
  const lines = processDirectoryLines(long, 40)
  assert.ok(lines.length >= 2)
  assert.equal(lines[0].breakBefore, false)
  assert.ok(lines.slice(1).every((l) => l.breakBefore))
  // wrapLongLine 丢弃分隔空格：拼接（去所有空格）还原原文
  assert.equal(lines.map((l) => l.text).join(''), long.replace(/ /g, ''))
})

test('preserveCodeLines 保留代码缩进、连续空格和空行', () => {
  assert.deepEqual(preserveCodeLines('  const value = 1\n\n├── child    node'), [
    { text: '  const value = 1', breakBefore: false },
    { text: '', breakBefore: true },
    { text: '├── child    node', breakBefore: true },
  ])
})

test('preserveCodeLines 统一 CRLF 并保留末尾换行', () => {
  assert.deepEqual(preserveCodeLines('A\r\nB\r\n'), [
    { text: 'A', breakBefore: false },
    { text: 'B', breakBefore: true },
    { text: '', breakBefore: true },
  ])
})
