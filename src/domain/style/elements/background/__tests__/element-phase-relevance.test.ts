import { BackgroundElement } from '../element'
import type { ElementContext } from '@/domain/style/elements/base/StyleElement'
import type { PhotoStyleSettings } from '@/types/photo-style'

function makeContext(
  phase: ElementContext['phase'],
  styleSettings: PhotoStyleSettings,
): ElementContext {
  return {
    phase,
    settings: styleSettings,
    generationContext: { selfieS3Keys: ['selfies/1.jpg'] },
    existingContributions: [],
  }
}

describe('BackgroundElement.isRelevantForPhase', () => {
  const element = new BackgroundElement()

  const baseSettings: PhotoStyleSettings = {
    background: { mode: 'predefined', value: { type: 'office' } },
  }

  it('returns false when background is missing', () => {
    expect(element.isRelevantForPhase(makeContext('person-generation', {}))).toBe(false)
  })

  it('returns false for person-generation', () => {
    expect(element.isRelevantForPhase(makeContext('person-generation', baseSettings))).toBe(false)
  })

  it('returns true for composition', () => {
    expect(element.isRelevantForPhase(makeContext('composition', baseSettings))).toBe(true)
  })

  it('returns false for background-generation without branding', () => {
    expect(element.isRelevantForPhase(makeContext('background-generation', baseSettings))).toBe(false)
  })

  it('returns true for background-generation with background branding', () => {
    const settings: PhotoStyleSettings = {
      ...baseSettings,
      branding: {
        mode: 'predefined',
        value: { type: 'include', position: 'background', logoKey: 'logo.png' },
      },
    }
    expect(element.isRelevantForPhase(makeContext('background-generation', settings))).toBe(true)
  })

  it('returns true for background-generation with elements branding', () => {
    const settings: PhotoStyleSettings = {
      ...baseSettings,
      branding: {
        mode: 'predefined',
        value: { type: 'include', position: 'elements', logoKey: 'logo.png' },
      },
    }
    expect(element.isRelevantForPhase(makeContext('background-generation', settings))).toBe(true)
  })

  it('returns false for background-generation with clothing branding', () => {
    const settings: PhotoStyleSettings = {
      ...baseSettings,
      branding: {
        mode: 'predefined',
        value: { type: 'include', position: 'clothing', logoKey: 'logo.png' },
      },
    }
    expect(element.isRelevantForPhase(makeContext('background-generation', settings))).toBe(false)
  })

  it('returns false for background-generation with excluded branding', () => {
    const settings: PhotoStyleSettings = {
      ...baseSettings,
      branding: {
        mode: 'predefined',
        value: { type: 'exclude' },
      },
    }
    expect(element.isRelevantForPhase(makeContext('background-generation', settings))).toBe(false)
  })
})
