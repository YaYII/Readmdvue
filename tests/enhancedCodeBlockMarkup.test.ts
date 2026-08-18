import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEnhancedCodeBlockPlaceholder, normalizeCodeLanguage } from '../src/utils/enhancedCodeBlockMarkup.ts'

test('normalizeCodeLanguage falls back to text and removes unsafe characters', () => {
  assert.equal(normalizeCodeLanguage(''), 'text')
  assert.equal(normalizeCodeLanguage(' TypeScript '), 'typescript')
  assert.equal(normalizeCodeLanguage('text\"><script>'), 'textscript')
})

test('buildEnhancedCodeBlockPlaceholder keeps code inert until the component mounts', () => {
  const html = buildEnhancedCodeBlockPlaceholder({
    codeId: 'code-1',
    language: 'text',
    highlightedCode: 'first\nsecond'
  })

  assert.match(html, /class="enhanced-code-block-host"/)
  assert.match(html, /data-enhanced-code-block-host/)
  assert.match(html, /data-enhanced-code-template/)
  assert.match(html, /<code class="hljs language-text">first\nsecond<\/code>/)
  assert.doesNotMatch(html, /class="enhanced-code-block"/)
  assert.doesNotMatch(html, /data-action="copy-code"/)
})

test('buildEnhancedCodeBlockPlaceholder escapes host attributes', () => {
  const html = buildEnhancedCodeBlockPlaceholder({
    codeId: 'code-"1"',
    language: 'text',
    highlightedCode: '&lt;tag&gt;'
  })

  assert.match(html, /data-code-id="code-&quot;1&quot;"/)
  assert.match(html, /&lt;tag&gt;/)
})
