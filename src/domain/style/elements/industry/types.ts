import type { ElementSetting } from '../base/element-types'

export type IndustryType =
  | 'law-firms'
  | 'medical'
  | 'real-estate'
  | 'financial-services'
  | 'actively-hiring'
  | 'consulting'
  | 'accounting'

export interface IndustryValue {
  type: IndustryType
}

export type IndustrySettings = ElementSetting<IndustryValue>
