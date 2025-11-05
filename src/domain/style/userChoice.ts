export function hasUserDefinedFields(obj: unknown): boolean {
  const seen = new Set<unknown>()
  const normalize = (s: unknown) =>
    typeof s === 'string' ? s.toLowerCase().replace(/[\u2010-\u2015]/g, '-').trim() : ''

  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    if (seen.has(node)) return false
    seen.add(node)

    const record = node as Record<string, unknown>
    const t = (record as { type?: unknown }).type
    if (normalize(t) === 'user-choice') return true

    for (const value of Object.values(record)) {
      if (Array.isArray(value)) {
        if (value.some(walk)) return true
      } else if (typeof value === 'object' && value !== null) {
        if (walk(value)) return true
      } else if (typeof value === 'string') {
        if (normalize(value) === 'user-choice') return true
      }
    }
    return false
  }

  return walk(obj)
}
