export interface PromptSection {
  title?: string
  lines?: string[]
  jsonTitle?: string
  json?: string | Record<string, unknown>
}

function toSectionLines(section: PromptSection): string[] {
  const lines: string[] = []

  if (section.title) {
    lines.push(section.title)
  }

  if (section.jsonTitle) {
    lines.push(section.jsonTitle)
  }

  if (section.json !== undefined) {
    lines.push(typeof section.json === 'string' ? section.json : JSON.stringify(section.json, null, 2))
  }

  if (section.lines && section.lines.length > 0) {
    lines.push(...section.lines.filter((line) => line !== undefined && line !== null))
  }

  return lines
}

/**
 * Build a structured prompt from semantic sections.
 * Adds one blank line between non-empty sections.
 */
export function getPrompt(sections: Array<PromptSection | null | undefined | false>): string {
  const output: string[] = []

  for (const section of sections) {
    if (!section) continue

    const sectionLines = toSectionLines(section)
    if (sectionLines.length === 0) continue

    if (output.length > 0 && output[output.length - 1] !== '') {
      output.push('')
    }

    output.push(...sectionLines)
  }

  while (output.length > 0 && output[output.length - 1] === '') {
    output.pop()
  }

  return output.join('\n')
}

