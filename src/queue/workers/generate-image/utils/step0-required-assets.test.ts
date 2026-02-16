import type { PhotoStyleSettings } from '@/types/photo-style'
import type { PreparedAsset } from '@/domain/style/elements/composition'

import { getRequiredStep0AssetErrors } from './step0-required-assets'

function makePreparedAssets(
  opts: { hasBackground?: boolean; preBrandedWithLogo?: boolean; hasOverlay?: boolean } = {}
) {
  const preparedAssets = new Map<string, PreparedAsset>()

  if (opts.hasBackground) {
    preparedAssets.set('background-custom-background', {
      elementId: 'background',
      assetType: 'custom-background',
      data: {
        base64: 'abc123',
        metadata: {
          preBrandedWithLogo: opts.preBrandedWithLogo === true,
        },
      },
    })
  }

  if (opts.hasOverlay) {
    preparedAssets.set('clothing-overlay-overlay', {
      elementId: 'clothing-overlay',
      assetType: 'overlay',
      data: {
        base64: 'overlay123',
      },
    })
  }

  return preparedAssets
}

describe('getRequiredStep0AssetErrors', () => {
  it('fails when custom background is requested but no background buffer was prepared', () => {
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

    const errors = getRequiredStep0AssetErrors(styleSettings)
    expect(errors.some((err) => err.includes('Custom background requested'))).toBe(true)
  })

  it('fails when background/elements branding is requested without preBrandedWithLogo metadata', () => {
    const styleSettings: PhotoStyleSettings = {
      background: {
        mode: 'predefined',
        value: { type: 'neutral', color: '#808080' },
      },
      branding: {
        mode: 'predefined',
        value: { type: 'include', position: 'background', logoKey: 'logos/company.png' },
      },
    }

    const errors = getRequiredStep0AssetErrors(
      styleSettings,
      makePreparedAssets({ hasBackground: true, preBrandedWithLogo: false })
    )
    expect(errors.some((err) => err.includes('metadata.preBrandedWithLogo is not true'))).toBe(true)
  })

  it('passes background/elements branding requirement when preBrandedWithLogo is true', () => {
    const styleSettings: PhotoStyleSettings = {
      background: {
        mode: 'predefined',
        value: { type: 'gradient', color: '#808080' },
      },
      branding: {
        mode: 'predefined',
        value: { type: 'include', position: 'elements', logoKey: 'logos/company.png' },
      },
    }

    const errors = getRequiredStep0AssetErrors(
      styleSettings,
      makePreparedAssets({ hasBackground: true, preBrandedWithLogo: true })
    )
    expect(errors).toHaveLength(0)
  })

  it('fails when clothing branding is requested but clothing overlay is missing', () => {
    const styleSettings: PhotoStyleSettings = {
      background: {
        mode: 'predefined',
        value: { type: 'office' },
      },
      clothing: {
        mode: 'predefined',
        value: { style: 'business', details: 'blazer' },
      },
      branding: {
        mode: 'predefined',
        value: { type: 'include', position: 'clothing', logoKey: 'logos/company.png' },
      },
    }

    const errors = getRequiredStep0AssetErrors(styleSettings)
    expect(errors.some((err) => err.includes('Clothing branding requires prepared clothing overlay'))).toBe(
      true
    )
  })
})
