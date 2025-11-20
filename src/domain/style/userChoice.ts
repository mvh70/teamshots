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

export function hasUneditedEditableFields(
  current: Record<string, unknown>,
  original: Record<string, unknown>
): boolean {
  // First check if there are any editable fields at all
  if (!hasUserDefinedFields(current)) {
    return false
  }

  const seen = new Set<unknown>()
  const normalize = (s: unknown) =>
    typeof s === 'string' ? s.toLowerCase().replace(/[\u2010-\u2015]/g, '-').trim() : ''

  const walk = (node: unknown, originalNode: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    if (!originalNode || typeof originalNode !== 'object') return false
    if (seen.has(node)) return false
    seen.add(node)

    const currentRecord = node as Record<string, unknown>
    const originalRecord = originalNode as Record<string, unknown>
    const currentType = (currentRecord as { type?: unknown }).type

    // If this is a user-choice field, check if it has been modified
    if (normalize(currentType) === 'user-choice') {
      // Compare the current and original objects
      return JSON.stringify(currentRecord) === JSON.stringify(originalRecord)
    }

    // Recursively check nested objects
    for (const key of Object.keys(currentRecord)) {
      const currentValue = currentRecord[key]
      const originalValue = originalRecord[key]

      if (Array.isArray(currentValue)) {
        if (Array.isArray(originalValue)) {
          for (let i = 0; i < currentValue.length; i++) {
            if (walk(currentValue[i], originalValue[i])) return true
          }
        }
      } else if (typeof currentValue === 'object' && currentValue !== null) {
        if (typeof originalValue === 'object' && originalValue !== null) {
          if (walk(currentValue, originalValue)) return true
        }
      } else if (typeof currentValue === 'string') {
        if (normalize(currentValue) === 'user-choice' && currentValue === originalValue) {
          return true
        }
      }
    }
    return false
  }

  return walk(current, original)
}
