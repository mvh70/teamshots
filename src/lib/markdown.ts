interface MarkdownToHtmlOptions {
  stripLeadingH1?: boolean
  paragraphClassName?: string
}

/**
 * Convert markdown to HTML for blog content rendering.
 */
export function markdownToHtml(markdown: string, options: MarkdownToHtmlOptions = {}): string {
  const { stripLeadingH1 = true, paragraphClassName = 'mb-4' } = options

  // Normalize line endings
  let result = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Strip leading H1 - the template already renders the title as H1
  if (stripLeadingH1) {
    result = result.replace(/^# .+\n+/, '')
  }

  // Remove schema markup comments and scripts (they shouldn't be rendered)
  result = result.replace(/<!--\s*COMPARISON_SCHEMA_START\s*-->[\s\S]*?<\/script>\s*/g, '')
  result = result.replace(/<!--\s*COMPARISON_SCHEMA_END\s*-->/g, '')

  // Convert markdown tables to HTML tables first (before other processing)
  result = result.replace(
    /^\|(.+)\|\s*\n\|[\s\-:|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm,
    (_match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map((h: string) => h.trim()).filter(Boolean)
      const rows = bodyRows.trim().split('\n').map((row: string) =>
        row.split('|').map((cell: string) => cell.trim()).filter(Boolean)
      )

      let table = '<table class="w-full border-collapse my-6 text-sm"><thead><tr>'
      headers.forEach((h: string) => {
        table += `<th class="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold">${h}</th>`
      })
      table += '</tr></thead><tbody>'
      rows.forEach((row: string[]) => {
        table += '<tr>'
        row.forEach((cell: string) => {
          table += `<td class="border border-gray-300 px-4 py-2">${cell}</td>`
        })
        table += '</tr>'
      })
      table += '</tbody></table>'
      return table + '\n'
    }
  )

  // Convert horizontal rules (--- on its own line) to <hr>
  result = result.replace(/^---$/gm, '<hr class="my-8 border-gray-300" />')

  const escapeAttribute = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Before/after image pairs (two consecutive images with before:/after: alt text)
  result = result.replace(
    /!\[before:\s*([^\]]+)\]\(([^)]+)\)\s*\n!\[after:\s*([^\]]+)\]\(([^)]+)\)/gi,
    (_match, beforeAlt, beforeSrc, afterAlt, afterSrc) =>
      `\n\n<div data-before-src=\"${escapeAttribute(beforeSrc.trim())}\" data-after-src=\"${escapeAttribute(afterSrc.trim())}\" data-before-alt=\"${escapeAttribute(beforeAlt.trim())}\" data-after-alt=\"${escapeAttribute(afterAlt.trim())}\"></div>\n\n`
  )

  // Single images
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt, src) =>
      `<img src=\"${escapeAttribute(src.trim())}\" alt=\"${escapeAttribute(alt.trim())}\" class=\"w-full rounded-lg border border-gray-200 mb-6\" />`
  )

  const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const paragraphAttr = paragraphClassName ? ` class="${paragraphClassName}"` : ''

  return result
    // Headers
    .replace(/^### (.*$)/gm, (_, t) => `<h3 id="${slugify(t)}" class="text-xl font-semibold mt-6 mb-3">${t}</h3>`)
    .replace(/^## (.*$)/gm, (_, t) => `<h2 id="${slugify(t)}" class="text-2xl font-bold mt-8 mb-4">${t}</h2>`)
    .replace(/^# (.*$)/gm, (_, t) => `<h1 id="${slugify(t)}" class="text-3xl font-bold mt-8 mb-4">${t}</h1>`)
    // Bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-sm">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-600 hover:underline">$1</a>')
    // Lists (markdown "- " and unicode "• " bullets)
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^• (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-6 mb-4">$&</ul>')
    // Blockquotes
    .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-indigo-500 pl-4 italic text-gray-600">$1</blockquote>')
    // Paragraphs (lines that don't start with tags)
    .split('\n\n')
    .map((block) => {
      if (block.trim().startsWith('<')) return block
      if (block.trim() === '') return ''
      return `<p${paragraphAttr}>${block}</p>`
    })
    .join('\n')
}

/**
 * Convert one markdown snippet into inline-friendly HTML for components like TL;DR.
 */
export function markdownToInlineHtml(markdown: string): string {
  return markdownToHtml(markdown, {
    stripLeadingH1: false,
    paragraphClassName: '',
  })
}
