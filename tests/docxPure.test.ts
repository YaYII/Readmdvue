/**
 * docxPure.ts 单元测试（node:test，测真代码而非副本）
 * 运行：npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  wrapLongLine,
  mimeToDocxType,
  dataUrlToBytes,
  clampCanvasSize,
  clampDisplaySize,
  DOCX_CODE_FONT,
  DOCX_LATIN_FONT,
  resolveDocxPageLayout,
  textToRuns,
  type BreakMergeState,
} from '../src/utils/docxPure.ts'

test('DOCX 使用标准英数字体，代码使用等宽字体', () => {
  assert.equal(DOCX_LATIN_FONT, 'Calibri')
  assert.equal(DOCX_CODE_FONT, 'Consolas')
})

// 0. Word 页面布局：默认政府文书为 A3 纵向，图片宽度跟随实际版心
test('resolveDocxPageLayout 默认返回 A3 纵向', () => {
  const layout = resolveDocxPageLayout()
  assert.deepEqual({
    pageWidth: layout.pageWidth,
    pageHeight: layout.pageHeight,
    orientation: layout.orientation,
  }, { pageWidth: 16838, pageHeight: 23811, orientation: 'portrait' })
  assert.equal(layout.maxImageWidthPx, 863)
  assert.equal(layout.maxImageHeightPx, 1284)
})

test('resolveDocxPageLayout 横向时交换实际版心并扩大图片宽度', () => {
  const portrait = resolveDocxPageLayout('A3', 'portrait')
  const landscape = resolveDocxPageLayout('A3', 'landscape')
  assert.equal(landscape.orientation, 'landscape')
  assert.equal(landscape.pageWidth, 16838)
  assert.equal(landscape.pageHeight, 23811)
  assert.ok(landscape.maxImageWidthPx > portrait.maxImageWidthPx)
  assert.ok(landscape.maxImageHeightPx < portrait.maxImageHeightPx)
})

test('resolveDocxPageLayout 非法纸张回退 A3', () => {
  const layout = resolveDocxPageLayout('unknown', 'portrait')
  assert.equal(layout.pageWidth, 16838)
  assert.equal(layout.pageHeight, 23811)
  assert.equal(layout.orientation, 'portrait')
})

test('resolveDocxPageLayout 支持导出对话框的全部纸张', () => {
  assert.deepEqual(
    ['A3', 'Letter', 'Legal'].map((pageSize) => {
      const layout = resolveDocxPageLayout(pageSize, 'portrait')
      return [layout.pageWidth, layout.pageHeight]
    }),
    [[16838, 23811], [12240, 15840], [12240, 20160]],
  )
})

// 1. wrapLongLine：长行在空格处换行
test('wrapLongLine 短行不拆', () => {
  assert.deepEqual(wrapLongLine('hello', 70), ['hello'])
})
test('wrapLongLine 长行空格处拆', () => {
  const line = 'a'.repeat(30) + ' ' + 'b'.repeat(50)
  const parts = wrapLongLine(line, 40)
  assert.ok(parts.length >= 2)
  // 有空格段在空格处拆（可 ≤40 含空格），无空格段 ≤40；拼接（去分隔空格）还原原文
  assert.ok(parts.every((p) => p.length <= 40 || !p.includes(' ')))
  assert.equal(parts.join(''), line.replace(/ /g, ''))
})
test('wrapLongLine 无空格长串硬截断', () => {
  const parts = wrapLongLine('x'.repeat(100), 40)
  assert.ok(parts.length >= 2)
  assert.ok(parts.every((p) => p.length <= 40))
})
test('wrapLongLine 空行返回空串', () => {
  assert.deepEqual(wrapLongLine('', 70), [''])
})

// 2. mimeToDocxType
test('mimeToDocxType 映射', () => {
  assert.equal(mimeToDocxType('png'), 'png')
  assert.equal(mimeToDocxType('jpeg'), 'jpg')
  assert.equal(mimeToDocxType('jpg'), 'jpg')
  assert.equal(mimeToDocxType('gif'), 'gif')
  assert.equal(mimeToDocxType('bmp'), 'bmp')
  assert.equal(mimeToDocxType('webp'), 'png') // webp 需 canvas 重编码
  assert.equal(mimeToDocxType(undefined), 'png')
  assert.equal(mimeToDocxType(''), 'png')
})

// 3. dataUrlToBytes
test('dataUrlToBytes 合法 base64', () => {
  const b64 = Buffer.from([1, 2, 3, 255]).toString('base64')
  const bytes = dataUrlToBytes(`data:image/png;base64,${b64}`)
  assert.ok(bytes)
  assert.deepEqual(Array.from(bytes!), [1, 2, 3, 255])
})
test('dataUrlToBytes 非法返回 null', () => {
  assert.equal(dataUrlToBytes('not-a-data-url'), null)
  assert.equal(dataUrlToBytes('data:image/png;base64,!!!invalid'), null)
})

// 4. clampCanvasSize：canvas 最大边限制
test('clampCanvasSize 超大图缩到 maxSide', () => {
  const r = clampCanvasSize(8000, 6000, 2600)
  assert.equal(r.width, 2600)
  assert.equal(r.height, 1950)
})
test('clampCanvasSize 常规不缩', () => {
  assert.deepEqual(clampCanvasSize(1920, 1080, 2600), { width: 1920, height: 1080 })
})
test('clampCanvasSize 宽图按比例', () => {
  const r = clampCanvasSize(3000, 1000, 2600)
  assert.equal(r.width, 2600)
  assert.equal(r.height, 867)
})

// 5. clampDisplaySize：显示尺寸约束
test('clampDisplaySize 超宽缩到 maxWidth', () => {
  const r = clampDisplaySize(5000, 3000, 1300)
  assert.equal(r.width, 1300)
  assert.equal(r.height, 780)
})
test('clampDisplaySize 常规不缩', () => {
  assert.deepEqual(clampDisplaySize(800, 600, 1300), { width: 800, height: 600 })
})
test('clampDisplaySize 0 兜底 400x300', () => {
  assert.deepEqual(clampDisplaySize(0, 0, 1300), { width: 400, height: 300 })
})
test('clampDisplaySize 超高超版心裁剪（竖图生成一半根因）', () => {
  // 800x1200 竖图：宽 ≤1300 不缩，但高 1200 > 830 版心 → 必须等比缩高
  const r = clampDisplaySize(800, 1200, 1300, 830)
  assert.equal(r.height, 830)
  assert.equal(r.width, 553)
})
test('clampDisplaySize 宽高双超按两步等比约束', () => {
  const r = clampDisplaySize(1500, 1200, 1300, 830)
  assert.deepEqual(r, { width: 1038, height: 830 }) // 先宽 1500→1300(高 1040)，再高 1040→830(宽 1038)
})
test('clampDisplaySize 不传 maxHeight 兼容旧行为（只限宽）', () => {
  assert.deepEqual(clampDisplaySize(800, 1200, 1300), { width: 800, height: 1200 })
})

// 6. textToRuns：连续换行合并（目录/列表不能有空行）
test('textToRuns 普通单换行', () => {
  const state: BreakMergeState = { lastWasBreak: false }
  const runs = textToRuns('A\nB', (l) => `T:${l}`, () => 'BR', state)
  assert.deepEqual(runs, ['T:A', 'BR', 'T:B'])
})
test('textToRuns 连续换行合并为单 break', () => {
  const state: BreakMergeState = { lastWasBreak: false }
  const runs = textToRuns('A\n\nB', (l) => `T:${l}`, () => 'BR', state)
  assert.deepEqual(runs, ['T:A', 'BR', 'T:B']) // \n\n 只产一个 break
})
test('textToRuns 多个连续换行合并', () => {
  const state: BreakMergeState = { lastWasBreak: false }
  const runs = textToRuns('A\n\n\nB', (l) => `T:${l}`, () => 'BR', state)
  assert.deepEqual(runs, ['T:A', 'BR', 'T:B'])
})
test('textToRuns 空行只产 break 无文本', () => {
  const state: BreakMergeState = { lastWasBreak: false }
  const runs = textToRuns('A\n\n', (l) => `T:${l}`, () => 'BR', state)
  assert.deepEqual(runs, ['T:A', 'BR'])
})
test('textToRuns 跨节点状态共享（br 后 \n 合并）', () => {
  // 模拟 extractRuns：br 输出 break 后，文本首行前不再重复 break
  const state: BreakMergeState = { lastWasBreak: true } // 前一个子节点是 br
  const runs = textToRuns('\nB', (l) => `T:${l}`, () => 'BR', state)
  assert.deepEqual(runs, ['T:B']) // 前导 \n 被 br 的 break 合并
})
