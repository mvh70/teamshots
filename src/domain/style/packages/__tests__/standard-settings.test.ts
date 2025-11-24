import { describe, expect, it } from 'vitest'

import { applyStandardPreset } from '../standard-settings'
import { STANDARD_PRESETS } from '../defaults'
import type { PhotoStyleSettings } from '@/types/photo-style'

describe('applyStandardPreset', () => {
  it('aligns three-quarter shot type to 3:4 aspect ratio', () => {
    const input: PhotoStyleSettings = {
      shotType: { type: 'three-quarter' },
      aspectRatio: '1:1'
    }

    const { settings } = applyStandardPreset('corporate-headshot', input, STANDARD_PRESETS)

    expect(settings.shotType?.type).toBe('three-quarter')
    expect(settings.aspectRatio).toBe('3:4')
  })

  it('aligns full-length shot type to 9:16 aspect ratio', () => {
    const input: PhotoStyleSettings = {
      shotType: { type: 'full-length' },
      aspectRatio: '3:4'
    }

    const { settings } = applyStandardPreset('corporate-headshot', input, STANDARD_PRESETS)

    expect(settings.shotType?.type).toBe('full-length')
    expect(settings.aspectRatio).toBe('9:16')
  })
})

