import { BackgroundElement } from '../element'
import type { PhotoStyleSettings } from '@/types/photo-style'

describe('BackgroundElement.validate', () => {
  const element = new BackgroundElement()

  it('returns no errors for valid office background', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'office' } },
    }
    expect(element.validate(settings)).toEqual([])
  })

  it('returns error for neutral without color', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'neutral' } },
    }
    const errors = element.validate(settings)
    expect(errors).toContain('neutral background requires a color')
  })

  it('returns error for gradient without color', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'gradient' } },
    }
    const errors = element.validate(settings)
    expect(errors).toContain('gradient background requires a color')
  })

  it('returns error for solid without color', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'solid' } },
    }
    const errors = element.validate(settings)
    expect(errors).toContain('solid background requires a color')
  })

  it('returns error for dark_studio without color', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'dark_studio' } },
    }
    const errors = element.validate(settings)
    expect(errors).toContain('dark_studio background requires a color')
  })

  it('returns error for team_bright without color', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'team_bright' } },
    }
    const errors = element.validate(settings)
    expect(errors).toContain('team_bright background requires a color')
  })

  it('returns no error for neutral with color', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'neutral', color: '#fff' } },
    }
    expect(element.validate(settings)).toEqual([])
  })

  it('returns error for custom without key or assetId', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'custom' } },
    }
    const errors = element.validate(settings)
    expect(errors).toContain('Custom background requires key or assetId')
  })

  it('returns no error for custom with key', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'custom', key: 'bg/test.jpg' } },
    }
    expect(element.validate(settings)).toEqual([])
  })

  it('returns no error for custom with assetId', () => {
    const settings: PhotoStyleSettings = {
      background: { mode: 'predefined', value: { type: 'custom', assetId: 'asset-123' } },
    }
    expect(element.validate(settings)).toEqual([])
  })

  it('returns no errors when background is not set', () => {
    expect(element.validate({})).toEqual([])
  })
})
