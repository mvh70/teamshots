import type { ElementMode } from '../base/element-types'
import type { BeautificationSettings } from './types'
import { normalizeBeautificationValue } from './schema'

export function deserializeBeautification(
  raw: Record<string, unknown>
): BeautificationSettings | undefined {
  if (!Object.prototype.hasOwnProperty.call(raw, 'beautification')) {
    return undefined
  }

  const candidate = raw.beautification
  if (!candidate || typeof candidate !== 'object') {
    return undefined
  }

  const source = candidate as Record<string, unknown>
  const mode: ElementMode = source.mode === 'predefined' ? 'predefined' : 'user-choice'
  const rawValue = Object.prototype.hasOwnProperty.call(source, 'value') ? source.value : candidate

  if (rawValue === undefined) {
    return { mode }
  }

  return {
    mode,
    value: normalizeBeautificationValue(rawValue),
  }
}
