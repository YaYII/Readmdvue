/**
 * mermaid UMD 全量包（dist/mermaid.min.js）类型声明：
 * 与官方包类型一致（default export 为 Mermaid API 对象）
 */
declare module 'mermaid/dist/mermaid.min.js' {
  const mermaid: typeof import('mermaid')['default']
  export default mermaid
}
