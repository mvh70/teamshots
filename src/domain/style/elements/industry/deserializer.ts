import type { IndustrySettings, IndustryType, IndustryValue } from './types'
import { predefined, userChoice } from '../base/element-types'

const VALID_INDUSTRIES: IndustryType[] = [
  'law-firms',
  'medical',
  'real-estate',
  'financial-services',
  'actively-hiring',
  'consulting',
  'accounting',
]

export function deserialize(
  raw: Record<string, unknown>,
  defaultValue?: IndustrySettings
): IndustrySettings {
  const industryRaw = raw.industry as Record<string, unknown> | string | undefined

  // Handle string format (just the industry type)
  if (typeof industryRaw === 'string') {
    if (VALID_INDUSTRIES.includes(industryRaw as IndustryType)) {
      return predefined({ type: industryRaw as IndustryType })
    }
    return defaultValue || userChoice()
  }

  // Handle object format
  if (industryRaw && typeof industryRaw === 'object') {
    const mode = industryRaw.mode as string | undefined
    const value = industryRaw.value as IndustryValue | undefined
    const type = industryRaw.type as IndustryType | undefined

    // New format with mode
    if (mode === 'predefined' && value?.type && VALID_INDUSTRIES.includes(value.type)) {
      return predefined({ type: value.type })
    }
    if (mode === 'user-choice') {
      return userChoice(value)
    }

    // Legacy format with just type
    if (type && VALID_INDUSTRIES.includes(type)) {
      return predefined({ type })
    }
  }

  return defaultValue || userChoice()
}
