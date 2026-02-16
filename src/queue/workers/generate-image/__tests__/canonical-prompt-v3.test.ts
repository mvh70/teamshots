import type { PhotoStyleSettings } from '@/types/photo-style'

const composeElementContributionsMock = jest.fn()

jest.mock('../utils/element-composition', () => ({
  composeElementContributions: (...args: unknown[]) => composeElementContributionsMock(...args),
}))

import {
  buildCanonicalPromptV3,
  restoreCanonicalPromptState,
  serializeCanonicalPromptState,
} from '../canonical-prompt-v3'

describe('canonical-prompt-v3', () => {
  const styleSettings = {} as PhotoStyleSettings

  beforeEach(() => {
    composeElementContributionsMock.mockReset()
    composeElementContributionsMock.mockImplementation(async (phase: string) => {
      if (phase === 'person-generation') {
        return {
          payload: {
            subject: {
              wardrobe: {
                color_palette: ['navy', 'white'],
                inherent_accessories: ['watch'],
              },
            },
            profile_images: ['override-profile-image'],
          },
          mustFollow: ['person-rule-1'],
          freedom: ['person-freedom-1'],
        }
      }

      if (phase === 'composition') {
        return {
          payload: {
            scene: {
              branding: {
                enabled: true,
                placement: 'center',
              },
            },
            rendering: {
              effects: ['vignette'],
            },
          },
          mustFollow: ['composition-rule-1'],
          freedom: ['composition-freedom-1'],
        }
      }

      return {
        payload: {},
        mustFollow: ['eval-rule-1'],
        freedom: ['eval-freedom-1'],
      }
    })
  })

  it('merges canonical prompt with field-aware array strategies', async () => {
    const basePrompt = JSON.stringify({
      subject: {
        wardrobe: {
          color_palette: ['black', 'white'],
          inherent_accessories: ['glasses'],
        },
      },
      profile_images: ['base-profile-image-1', 'base-profile-image-2'],
      rendering: {
        effects: ['film_grain'],
      },
    })

    const result = await buildCanonicalPromptV3({
      basePrompt,
      styleSettings,
      demographics: undefined,
      hasFaceComposite: false,
      hasBodyComposite: false,
      generationId: 'gen-canonical-1',
      personId: 'person-1',
      teamId: 'team-1',
      selfieS3Keys: ['selfies/person-1/selfie-1.jpg'],
      debugMode: false,
    })

    const wardrobe = ((result.canonicalPrompt.subject as Record<string, unknown>).wardrobe ?? {}) as Record<
      string,
      unknown
    >

    expect(wardrobe.color_palette).toEqual(['black', 'white', 'navy'])
    expect(wardrobe.inherent_accessories).toEqual(['glasses', 'watch'])

    expect(result.canonicalPrompt.profile_images).toEqual(['override-profile-image'])
    expect(result.step2Artifacts.payloadOverlay?.rendering).toEqual({ effects: ['vignette'] })
    expect(Array.isArray(result.debugMetadata.conflictPaths)).toBe(true)
  })

  it('is deterministic for identical inputs and can round-trip via workflow state', async () => {
    const basePrompt = JSON.stringify({
      subject: {
        wardrobe: {
          color_palette: ['black'],
        },
      },
    })

    const [first, second] = await Promise.all([
      buildCanonicalPromptV3({
        basePrompt,
        styleSettings,
        demographics: undefined,
        hasFaceComposite: true,
        hasBodyComposite: true,
        generationId: 'gen-canonical-2',
        personId: 'person-2',
        teamId: 'team-2',
        selfieS3Keys: ['selfies/person-2/selfie-1.jpg'],
        debugMode: false,
      }),
      buildCanonicalPromptV3({
        basePrompt,
        styleSettings,
        demographics: undefined,
        hasFaceComposite: true,
        hasBodyComposite: true,
        generationId: 'gen-canonical-2',
        personId: 'person-2',
        teamId: 'team-2',
        selfieS3Keys: ['selfies/person-2/selfie-1.jpg'],
        debugMode: false,
      }),
    ])

    expect(first.debugMetadata.promptHash).toBe(second.debugMetadata.promptHash)
    expect(first.debugMetadata.conflictPaths).toEqual(second.debugMetadata.conflictPaths)
    expect(first.step1aArtifacts).toEqual(second.step1aArtifacts)
    expect(first.step2Artifacts).toEqual(second.step2Artifacts)
    expect(first.step3EvalArtifacts).toEqual(second.step3EvalArtifacts)

    const restored = restoreCanonicalPromptState(serializeCanonicalPromptState(first))
    expect(restored.promptHash).toBe(first.debugMetadata.promptHash)
    expect(restored.canonicalPrompt).toEqual(first.canonicalPrompt)
    expect(restored.step2Artifacts.payloadOverlay).toEqual(first.step2Artifacts.payloadOverlay)
  })
})
