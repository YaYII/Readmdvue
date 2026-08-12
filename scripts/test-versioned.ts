/**
 * versionedFilename 规则单测（node --experimental-strip-types 直接运行）
 * 用法：node --experimental-strip-types scripts/test-versioned.ts
 */
import { generateVersionedFilename } from '../src/utils/versionedFilename.ts'

const cases: Array<[string, string]> = [
  // 无版本号 → 追加 v0.01
  ['README.md', 'README-v0.01.md'],
  ['README.markdown', 'README-v0.01.markdown'],
  ['no-ext', 'no-ext-v0.01'],
  // 有版本号 → 最后一段 +1（保留位数）
  ['README-v2.0.0.md', 'README-v2.0.1.md'],
  ['README-v0.01.md', 'README-v0.02.md'],
  ['README-v2.md', 'README-v3.md'],
  ['README-v0.09.md', 'README-v0.10.md'],
  ['README-v1.2.3.md', 'README-v1.2.4.md'],
  // 边界：v 前缀必须有；多版本号取最后一个；版本号前分隔符保留；版本号后文本保留
  ['README-2.0.0.md', 'README-2.0.0-v0.01.md'],
  ['README-v1.0-final.md', 'README-v1.1-final.md'],
  ['README v2.0.0.md', 'README v2.0.1.md'],
  ['v2.0.0.md', 'v2.0.1.md'],
  ['a-v1.0-b-v2.0.md', 'a-v1.0-b-v2.1.md'],
]

let failed = 0
for (const [input, expected] of cases) {
  const actual = generateVersionedFilename(input)
  const ok = actual === expected
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${input} -> ${actual}${ok ? '' : ` (期望 ${expected})`}`)
}

console.log(`\n${cases.length - failed}/${cases.length} 通过`)
process.exit(failed === 0 ? 0 : 1)
