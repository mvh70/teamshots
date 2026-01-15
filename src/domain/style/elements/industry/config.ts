import type { ElementConfig } from '../registry'
import type { IndustrySettings, IndustryType } from './types'
import { deserialize } from './deserializer'
import { predefined, userChoice } from '../base/element-types'

export interface IndustryConfig {
  value: IndustryType
  label: string
  description: string
  icon?: string
}

export const INDUSTRY_CONFIGS: IndustryConfig[] = [
  {
    value: 'law-firms',
    label: 'Law Firms',
    description: 'Traditional professional look with law library background',
  },
  {
    value: 'medical',
    label: 'Medical & Healthcare',
    description: 'Clean clinical appearance with lab coat and stethoscope',
  },
  {
    value: 'real-estate',
    label: 'Real Estate',
    description: 'Polished professional with modern office backdrop',
  },
  {
    value: 'financial-services',
    label: 'Financial Services',
    description: 'Executive presence with sophisticated corporate setting',
  },
  {
    value: 'actively-hiring',
    label: 'Tech & Startups',
    description: 'Approachable tech professional in modern workspace',
  },
  {
    value: 'consulting',
    label: 'Consulting',
    description: 'Sharp professional in collaborative environment',
  },
  {
    value: 'accounting',
    label: 'Accounting',
    description: 'Trustworthy professional in organized office setting',
  },
]

export function getIndustryConfig(type: IndustryType): IndustryConfig | undefined {
  return INDUSTRY_CONFIGS.find((c) => c.value === type)
}

/**
 * Element registry config for industry
 */
export const industryElementConfig: ElementConfig<IndustrySettings> = {
  getDefaultPredefined: (packageDefaults) => {
    if (packageDefaults?.value?.type) {
      return predefined({ type: packageDefaults.value.type })
    }
    return predefined({ type: 'law-firms' })
  },
  getDefaultUserChoice: () => userChoice(),
  deserialize,
}
