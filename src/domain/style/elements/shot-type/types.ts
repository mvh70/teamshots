import type { ElementSetting } from '../base/element-types'

/**
 * Shot type value options (without 'user-choice' - that's handled by the wrapper)
 */
export type ShotTypeValue =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium-close-up'
  | 'medium-shot'
  | 'three-quarter'
  | 'full-length'
  | 'wide-shot'
  | 'headshot'
  | 'midchest'
  | 'full-body'

/**
 * Shot type settings using the ElementSetting wrapper pattern
 *
 * @example
 * // Admin predefined
 * { mode: 'predefined', value: { type: 'medium-shot' } }
 *
 * // User choice (not selected yet)
 * { mode: 'user-choice', value: undefined }
 */
export type ShotTypeSettings = ElementSetting<{ type: ShotTypeValue }>

/**
 * Legacy format for backward compatibility
 */
export interface LegacyShotTypeSettings {
  type: ShotTypeValue | 'user-choice'
}

export type FocalLengthSetting =
  | '24mm'
  | '35mm'
  | '50mm'
  | '70mm'
  | '85mm'
  | '105mm'
  | '135mm'
  | '70-200mm'
  | 'user-choice'

export type ApertureSetting =
  | 'f/1.2'
  | 'f/1.4'
  | 'f/1.8'
  | 'f/2.0'
  | 'f/2.8'
  | 'f/4.0'
  | 'f/5.6'
  | 'f/8.0'
  | 'f/11'
  | 'user-choice'

export type LightingQualitySetting =
  | 'soft-diffused'
  | 'hard-direct'
  | 'natural-golden-hour'
  | 'natural-overcast'
  | 'studio-softbox'
  | 'rembrandt'
  | 'butterfly'
  | 'split'
  | 'rim-backlight'
  | 'loop'
  | 'user-choice'

export type ShutterSpeedSetting =
  | '1/100'
  | '1/125'
  | '1/160'
  | '1/200'
  | '1/250'
  | '1/320'
  | '1/500'
  | '1/1000+'
  | 'user-choice'

