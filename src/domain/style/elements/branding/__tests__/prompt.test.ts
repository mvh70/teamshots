import {
  getContextualBackgroundBrandingRules,
  generateBrandingPrompt,
  getBrandingIntegrationRules,
  getCompositionLayoutBrandingNote,
  getLogoReferenceDescription,
  getStep0BrandingEvalActiveCriteria,
  getStep0BrandingEvalCandidateDescription,
  getStep0BrandingEvalLogoReferenceDescription,
  getStep0BrandingEvalPrompt,
} from '../prompt'

describe('branding prompt helpers', () => {
  it('keeps branding enabled when only logoAssetId is provided', () => {
    const result = generateBrandingPrompt({
      branding: {
        mode: 'predefined',
        value: {
          type: 'include',
          position: 'background',
          logoAssetId: 'asset_123',
        },
      },
      styleKey: 'startup',
      detailKey: 't-shirt',
    })

    expect((result.branding as Record<string, unknown>).enabled).toBe(true)
    expect((result.branding as Record<string, unknown>).position).toBe('background')
    expect(result.rules.length).toBeGreaterThan(0)
  })

  it('returns position-specific logo reference descriptions', () => {
    expect(getLogoReferenceDescription('clothing')).toContain('onto the clothing')
    expect(getLogoReferenceDescription('background')).toContain('Place it in the scene')
    expect(getLogoReferenceDescription('elements')).toContain('Place it in the scene')
  })

  it('exposes merged integration and layout rules', () => {
    expect(getBrandingIntegrationRules()).toHaveLength(4)
    expect(getCompositionLayoutBrandingNote()).toContain('visible but secondary')
  })

  it('requires centered-behind-subject background branding only for neutral/gradient', () => {
    expect(
      getContextualBackgroundBrandingRules({
        position: 'background',
        backgroundType: 'neutral',
      }).join(' ')
    ).toContain('centered on the rear wall directly behind the person')

    expect(
      getContextualBackgroundBrandingRules({
        position: 'background',
        backgroundType: 'gradient',
      }).join(' ')
    ).toContain('centered on the rear wall directly behind the person')

    expect(
      getContextualBackgroundBrandingRules({
        position: 'background',
        backgroundType: 'office',
      })
    ).toEqual([])

    expect(
      getContextualBackgroundBrandingRules({
        position: 'elements',
        backgroundType: 'neutral',
      })
    ).toEqual([])
  })

  it('provides step0 branding eval prompt and criteria from branding domain helpers', () => {
    const clothingEvalPrompt = getStep0BrandingEvalPrompt('clothing')
    expect(clothingEvalPrompt).toContain('CRITICAL CHROMA RULES')
    expect(clothingEvalPrompt).toContain('clothing_logo_no_overflow')

    const backgroundEvalPrompt = getStep0BrandingEvalPrompt('background')
    expect(backgroundEvalPrompt).toContain('logo_integrated')

    expect(getStep0BrandingEvalActiveCriteria('clothing')).toEqual([
      'logo_visible',
      'logo_accurate',
      'logo_placement',
      'clothing_logo_no_overflow',
    ])
    expect(getStep0BrandingEvalActiveCriteria('background')).toEqual([
      'logo_visible',
      'logo_accurate',
      'logo_integrated',
    ])
    expect(getStep0BrandingEvalCandidateDescription('clothing')).toContain('clothing overlay')
    expect(getStep0BrandingEvalCandidateDescription('background')).toContain('pre-branded background')
    expect(getStep0BrandingEvalLogoReferenceDescription()).toContain('transparency guidance only')
  })
})
