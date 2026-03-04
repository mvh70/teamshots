import type { ElementSetting } from '../base/element-types'

export type RetouchingLevel = 'none' | 'light' | 'medium' | 'high'
export type AccessoryAction = 'keep' | 'remove'

export interface BeautificationAccessorySettings {
  glasses?: { action: AccessoryAction }
  facialHair?: { action: AccessoryAction }
  jewelry?: { action: AccessoryAction }
  piercings?: { action: AccessoryAction }
  tattoos?: { action: AccessoryAction }
}

export interface BeautificationValue {
  retouching: RetouchingLevel
  accessories?: BeautificationAccessorySettings
}

export type BeautificationSettings = ElementSetting<BeautificationValue>

export const DEFAULT_BEAUTIFICATION_VALUE: BeautificationValue = {
  retouching: 'light',
  accessories: {
    glasses: { action: 'keep' },
    facialHair: { action: 'keep' },
    jewelry: { action: 'keep' },
    piercings: { action: 'keep' },
    tattoos: { action: 'keep' },
  },
}
