import { BackgroundElement } from '../element'

import type { ElementContext } from '@/domain/style/elements/base/StyleElement'
import type { PhotoStyleSettings } from '@/types/photo-style'

function makeContext(styleSettings: PhotoStyleSettings): ElementContext {
  return {
    phase: 'preparation',
    settings: styleSettings,
    generationContext: {
      selfieS3Keys: ['selfies/1.jpg'],
    },
    existingContributions: [],
  }
}

describe('BackgroundElement.needsPreparation', () => {
  const element = new BackgroundElement()

  it('requires preparation for neutral background branding (Option 1 invariant)', () => {
    const styleSettings: PhotoStyleSettings = {
      background: {
        mode: 'predefined',
        value: { type: 'neutral', color: '#808080' },
      },
      branding: {
        mode: 'predefined',
        value: {
          type: 'include',
          position: 'background',
          logoKey: 'logos/company.png',
        },
      },
    }

    expect(element.needsPreparation(makeContext(styleSettings))).toBe(true)
  })

  it('requires preparation for gradient elements branding (Option 1 invariant)', () => {
    const styleSettings: PhotoStyleSettings = {
      background: {
        mode: 'predefined',
        value: { type: 'gradient', color: '#808080' },
      },
      branding: {
        mode: 'predefined',
        value: {
          type: 'include',
          position: 'elements',
          logoKey: 'logos/company.png',
        },
      },
    }

    expect(element.needsPreparation(makeContext(styleSettings))).toBe(true)
  })

  it('does not require preparation for unbranded studio backgrounds', () => {
    const styleSettings: PhotoStyleSettings = {
      background: {
        mode: 'predefined',
        value: { type: 'dark_studio' },
      },
      branding: {
        mode: 'predefined',
        value: { type: 'exclude' },
      },
    }

    expect(element.needsPreparation(makeContext(styleSettings))).toBe(false)
  })

  it('requires preparation for custom backgrounds even without branding', () => {
    const styleSettings: PhotoStyleSettings = {
      background: {
        mode: 'predefined',
        value: { type: 'custom', key: 'backgrounds/custom.jpg' },
      },
      branding: {
        mode: 'predefined',
        value: { type: 'exclude' },
      },
    }

    expect(element.needsPreparation(makeContext(styleSettings))).toBe(true)
  })
})
