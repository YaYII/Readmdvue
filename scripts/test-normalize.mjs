/**
 * Markdown 规范化 + Prettier 组合测试（node scripts/test-normalize.mjs）
 */
import { normalizeMarkdown } from '../src/utils/markdownNormalizer.ts'
import * as prettier from 'prettier/standalone'
import * as parserMarkdown from 'prettier/plugins/markdown'

let failed = 0
async function check(name, input, expected, mode = 'raw') {
  let actual = normalizeMarkdown(input)
  if (mode === 'full') {
    actual = await prettier.format(actual, { parser: 'markdown', plugins: [parserMarkdown], proseWrap: 'preserve' })
  }
  const ok = actual === expected
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) {
    console.log(`  --- 实际 ---\n${actual.replace(/\n/g, '\\n')}\n  --- 期望 ---\n${expected.replace(/\n/g, '\\n')}`)
  }
}

// 规范化器单测
check('标题空格', '#标题', '# 标题')
check('多级标题空格', '###标题', '### 标题')
check('标题已有空格不动', '# 标题', '# 标题')
check('无序列表空格', '-项目', '- 项目')
check('无序列表*号', '*项目', '* 项目')
check('分隔线不动', '---', '---')
check('列表已空格不动', '- 项目', '- 项目')
check('有序列表空格', '1.第一项', '1. 第一项')
check('版本号不误伤', '1.2版本说明', '1.2版本说明')
check('引用空格', '>引用', '> 引用')
check('嵌套引用', '>>引用', '>> 引用')
check('引用已空格不动', '> 引用', '> 引用')
check('行尾空白去除', '文本   \n下一行', '文本\n下一行')
check('空行压缩', 'a\n\n\n\nb', 'a\n\nb')
check('代码块内不动', '```\n#标题\n-项目\n```', '```\n#标题\n-项目\n```')

// 组合（normalize + prettier）端到端
await check(
  '组合：糟糕文档',
  '#标题\n##没有空格\n\n-项目1\n*项目2\n\n>引用\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n',
  // prettier 标准输出：标题间空行、混合符号列表视为不同块加空行、表格列对齐
  '# 标题\n\n## 没有空格\n\n- 项目1\n\n* 项目2\n\n> 引用\n\n| a   | b   |\n| --- | --- |\n| 1   | 2   |\n',
  'full'
)

console.log(`\n${failed === 0 ? '全部通过' : failed + ' 个失败'}`)
process.exit(failed === 0 ? 0 : 1)
