export interface EnhancedCodeBlockPlaceholderOptions {
  codeId: string
  language: string
  highlightedCode: string
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }
    return entities[character]
  })
}

export function normalizeCodeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase().replace(/[^a-z0-9_+-]/g, '')
  return normalized || 'text'
}

export function buildEnhancedCodeBlockPlaceholder({
  codeId,
  language,
  highlightedCode
}: EnhancedCodeBlockPlaceholderOptions): string {
  const safeLanguage = normalizeCodeLanguage(language)
  const safeCodeId = escapeAttribute(codeId)
  const safeLanguageAttribute = escapeAttribute(safeLanguage)

  return `<div class="enhanced-code-block-host" data-enhanced-code-block-host data-code-id="${safeCodeId}" data-language="${safeLanguageAttribute}"><template data-enhanced-code-template><code class="hljs language-${safeLanguageAttribute}">${highlightedCode}</code></template></div>`
}
