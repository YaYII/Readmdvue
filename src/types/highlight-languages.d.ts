/**
 * highlight.js v11 的语言子模块没有附带 d.ts 声明，
 * 这里为按需引入的语言文件提供类型声明（LanguageFn 由主包类型提供）。
 */
declare module 'highlight.js/lib/languages/*' {
  import type { LanguageFn } from 'highlight.js'
  const language: LanguageFn
  export default language
}
