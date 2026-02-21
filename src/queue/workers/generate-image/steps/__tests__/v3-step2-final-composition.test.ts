import sharp from 'sharp'

import type { PhotoStyleSettings } from '@/types/photo-style'
import type { PreparedAsset } from '@/domain/style/elements/composition'

const generateWithGeminiMock = jest.fn()

jest.mock('../../gemini', () => ({
  generateWithGemini: (...args: unknown[]) => generateWithGeminiMock(...args),
}))

import { executeV3Step2, projectForStep2 } from '../v3-step2-final-composition'

async function makeImageBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 127, g: 127, b: 127 },
    },
  })
    .jpeg()
    .toBuffer()
}

function makeStyleSettings(params: {
  backgroundType: string
  backgroundColor?: string
  brandingPosition?: 'background' | 'elements' | 'clothing'
}): PhotoStyleSettings {
  return {
    background: {
      mode: 'predefined',
      value: {
        type: params.backgroundType as never,
        ...(params.backgroundColor ? { color: params.backgroundColor } : {}),
      },
    },
    branding: {
      mode: 'predefined',
      value: params.brandingPosition
        ? {
            type: 'include',
            position: params.brandingPosition,
            logoKey: 'logos/company.png',
          }
        : {
            type: 'exclude',
          },
    },
  }
}

function makeCanonicalPrompt(): Record<string, unknown> {
  return {
    scene: {
      environment: {
        location_type: 'office',
      },
    },
    camera: {
      positioning: {
        subject_to_background_ft: 8,
      },
    },
    lighting: {
      quality: 'soft',
    },
    rendering: {
      style_mode: 'raw',
    },
    framing: {
      shot_type: 'medium-shot',
      crop_points: 'Portrait framing from top of head to natural waistline.',
    },
    subject: {
      pose: { description: 'direct headshot' },
      expression: { type: 'soft_smile' },
      wardrobe: {
        style: 'business',
        details: 'navy blazer',
      },
    },
  }
}

describe('v3-step2-final-composition', () => {
  beforeEach(() => {
    generateWithGeminiMock.mockReset()
  })

  it('drops full subject block from step2 projected prompt', () => {
    const canonicalPrompt = {
      ...makeCanonicalPrompt(),
      subject: {
        pose: 'standing',
        expression: 'confident',
        wardrobe: {
          style: 'formal',
          details: 'navy blazer',
          top_layer: 'blazer',
          base_layer: 'shirt',
          notes: 'no tie',
          color_palette: ['navy', 'white'],
          style_key: 'business',
          detail_key: 'clean',
          inherent_accessories: ['glasses'],
        },
      },
    }

    const payloadOverlay: Record<string, unknown> = {
      scene: {
        branding: {
          enabled: true,
          placement: 'center-left',
        },
      },
      rendering: {
        effects: ['vignette'],
      },
    }

    const { step2Prompt } = projectForStep2(canonicalPrompt, payloadOverlay)

    expect(step2Prompt).not.toHaveProperty('subject')
    expect(step2Prompt.scene).toEqual({
      environment: { location_type: 'office' },
      branding: { enabled: true, placement: 'center-left' },
    })
    expect((step2Prompt.rendering as Record<string, unknown>)?.effects).toEqual(['vignette'])

  })

  it('builds immutable prompt with background reference and no extra logo reference when pre-branded', async () => {
    const personBuffer = await makeImageBuffer(1024, 1024)
    const backgroundBuffer = await makeImageBuffer(1024, 1024)
    const canonicalWithBranding = makeCanonicalPrompt()
    ;(canonicalWithBranding.scene as Record<string, unknown>).branding = {
      enabled: true,
      logo_source: 'Use the attached image labeled "logo" as the branding element for the scene',
      placement: 'center-left wall signage',
    }

    generateWithGeminiMock.mockResolvedValue({
      images: [await makeImageBuffer(1024, 1024)],
      usage: {
        durationMs: 100,
        inputTokens: 100,
        outputTokens: 100,
        imagesGenerated: 1,
      },
      providerUsed: 'vertex',
    })

    const preparedAssets = new Map<string, PreparedAsset>()
    preparedAssets.set('background-custom-background', {
      elementId: 'background',
      assetType: 'custom-background',
      data: {
        base64: backgroundBuffer.toString('base64'),
        metadata: {
          preBrandedWithLogo: true,
          preBrandedPosition: 'background',
        },
      },
    })

    await executeV3Step2({
      personBuffer,
      backgroundBuffer,
      styleSettings: makeStyleSettings({ backgroundType: 'neutral', brandingPosition: 'background' }),
      aspectRatio: '1:1',
      canonicalPrompt: canonicalWithBranding,
      step2Artifacts: {
        mustFollowRules: ['Preserve background exactly'],
        freedomRules: [],
      },
      preparedAssets,
    })

    const [promptText, referenceImages] = generateWithGeminiMock.mock.calls[0] as [
      string,
      Array<{ description?: string }>
    ]

    expect(promptText).toContain('Compositing Instructions (Immutable Background)')
    expect(promptText).toContain('Use the attached BACKGROUND REFERENCE as-is')
    expect(promptText).toContain('Natural crop/reframe is allowed when needed for output format, but do not compress.')
    expect(promptText).toContain('Place the person centrally in the background composition.')
    expect(promptText).toContain('Match visible background lighting first')
    expect(promptText).toContain('Person must be DOMINANT in frame (40-60% of image height minimum).')
    expect(promptText).toContain('Enhance natural skin micro-texture detail')
    expect(promptText).not.toContain('"scene":')
    expect(promptText).not.toContain('Subject Reference (FOR FRAMING CONTEXT ONLY):')
    expect(promptText).not.toContain('Compositing Instructions (Studio Background)')
    expect(promptText).not.toContain('"branding"')
    expect(promptText).not.toContain('"logo_source"')

    expect(referenceImages.some((ref) => ref.description?.startsWith('BACKGROUND REFERENCE'))).toBe(true)
    expect(referenceImages.some((ref) => ref.description?.startsWith('LOGO REFERENCE'))).toBe(false)
  })

  it('builds studio prompt and passes Step 2 element rules through without step-level filtering', async () => {
    const personBuffer = await makeImageBuffer(1024, 1024)

    generateWithGeminiMock.mockResolvedValue({
      images: [await makeImageBuffer(1024, 1024)],
      usage: {
        durationMs: 100,
        inputTokens: 100,
        outputTokens: 100,
        imagesGenerated: 1,
      },
      providerUsed: 'vertex',
    })

    await executeV3Step2({
      personBuffer,
      styleSettings: makeStyleSettings({
        backgroundType: 'neutral',
        backgroundColor: '#d8dcd6',
      }),
      aspectRatio: '1:1',
      canonicalPrompt: makeCanonicalPrompt(),
      step2Artifacts: {
        mustFollowRules: [
          'Preserve background reference exactly',
          'LOGO INTEGRITY: Copy the logo EXACTLY from the reference image - same letters, shapes, colors, proportions. Preserve background reference exactly.',
          'DO NOT redesign, reinterpret, stylize, simplify, or modify the logo in any way.',
          'Treat it as a fixed trademark asset: only its placement/material integration can change, never the logo design itself.',
          'If the logo has a bright green background, treat it as chroma key - do NOT render green in the output.',
          'PRESERVE from BASE: pose, expression, eye direction, clothing, body position, hair style',
          'REFINE to match selfies: facial structure, head shape, skin texture, distinctive marks',
          'Output dimensions must be exactly 1024x1024 pixels',
          'Background must be smooth and uniform',
          'No patterns, textures, or additional elements',
          'Background color must be exactly #d8dcd6 — no gradients, no tonal variation, uniform across the entire background',
        ],
        freedomRules: [],
      },
    })

    const [promptText, referenceImages] = generateWithGeminiMock.mock.calls[0] as [
      string,
      Array<{ description?: string }>
    ]

    expect(promptText).toContain('Compositing Instructions (Studio Background)')
    expect(promptText).toContain('Apply JSON lighting as the primary light source')
    expect(promptText).toContain('Studio Color Uniformity')
    expect(promptText).toContain('scene.environment.color_palette exactly (#d8dcd6)')
    expect(promptText).toContain('No Secondary Tones')
    expect(promptText).toContain('Background must be smooth and uniform')
    expect(promptText).toContain('No patterns, textures, or additional elements')
    expect(promptText).toContain(
      'Background color must be exactly #d8dcd6 — no gradients, no tonal variation, uniform across the entire background'
    )
    expect(promptText).not.toContain(
      'For non-gradient studio backgrounds, use ONE uniform wall color matching scene.environment.color_palette exactly.'
    )
    expect(promptText).not.toContain(
      'Do NOT introduce secondary tones, gradients, banding, mottling, vignettes, or color shifts across the background.'
    )
    expect(promptText).not.toContain('Compositing Instructions (Immutable Background)')
    expect(promptText).not.toContain('Ground Plane & Contact')

    expect(promptText).toContain('PRESERVE from BASE:')
    expect(promptText).toContain('REFINE to match selfies:')
    expect(promptText).toContain('Output dimensions must be exactly 1024x1024 pixels')
    expect(promptText).toContain('LOGO INTEGRITY: Copy the logo EXACTLY from the reference image - same letters, shapes, colors, proportions. Preserve background reference exactly.')
    expect(promptText).toContain('DO NOT redesign, reinterpret, stylize, simplify, or modify the logo in any way.')
    expect(promptText).toContain('Treat it as a fixed trademark asset: only its placement/material integration can change, never the logo design itself.')
    expect(promptText).toContain('If the logo has a bright green background, treat it as chroma key - do NOT render green in the output.')

    expect(referenceImages.some((ref) => ref.description?.startsWith('BACKGROUND REFERENCE'))).toBe(false)
  })

  it('builds environmental prompt with full spatial integration guidance', async () => {
    const personBuffer = await makeImageBuffer(1024, 1024)

    generateWithGeminiMock.mockResolvedValue({
      images: [await makeImageBuffer(1024, 1024)],
      usage: {
        durationMs: 100,
        inputTokens: 100,
        outputTokens: 100,
        imagesGenerated: 1,
      },
      providerUsed: 'vertex',
    })

    await executeV3Step2({
      personBuffer,
      styleSettings: makeStyleSettings({ backgroundType: 'office' }),
      aspectRatio: '1:1',
      canonicalPrompt: makeCanonicalPrompt(),
      step2Artifacts: {
        mustFollowRules: [],
        freedomRules: [],
      },
    })

    const [promptText] = generateWithGeminiMock.mock.calls[0] as [string]

    expect(promptText).toContain('Compositing Instructions (Environmental Background)')
    expect(promptText).toContain('Ground Plane & Contact')
    expect(promptText).toContain('Apply JSON lighting spec as the primary key-light guidance.')
    expect(promptText).toContain('Subject should appear ~8 feet from the background surface.')
  })

  it('includes element creative latitude rules in step2 when provided', async () => {
    const personBuffer = await makeImageBuffer(1024, 1024)

    generateWithGeminiMock.mockResolvedValue({
      images: [await makeImageBuffer(1024, 1024)],
      usage: {
        durationMs: 100,
        inputTokens: 100,
        outputTokens: 100,
        imagesGenerated: 1,
      },
      providerUsed: 'vertex',
    })

    await executeV3Step2({
      personBuffer,
      styleSettings: makeStyleSettings({ backgroundType: 'dark_studio' }),
      aspectRatio: '1:1',
      canonicalPrompt: makeCanonicalPrompt(),
      step2Artifacts: {
        mustFollowRules: [],
        freedomRules: [
          'Adjust background scale to create better balance',
          'Modify background positioning for composition',
          'Gently refine tonal cohesion in midtones',
          'Preserve subtle natural micro-contrast',
          'Maintain natural-looking highlight rolloff on skin',
          'Apply nuanced color balancing for skin and wardrobe',
        ],
      },
    })

    const [promptText] = generateWithGeminiMock.mock.calls[0] as [string]

    expect(promptText).toContain('Creative Latitude:')
    expect(promptText).toContain('Adjust background scale to create better balance')
    expect(promptText).toContain('Modify background positioning for composition')
    expect(promptText).toContain('Gently refine tonal cohesion in midtones')
    expect(promptText).toContain('Preserve subtle natural micro-contrast')
    expect(promptText).toContain('Maintain natural-looking highlight rolloff on skin')
    expect(promptText).toContain('Apply nuanced color balancing for skin and wardrobe')
  })

  it('throws for custom background without Step 0 background buffer', async () => {
    const personBuffer = await makeImageBuffer(1024, 1024)

    await expect(
      executeV3Step2({
        personBuffer,
        styleSettings: {
          ...makeStyleSettings({ backgroundType: 'custom' }),
          background: {
            mode: 'predefined',
            value: { type: 'custom', key: 'custom/background.jpg' },
          },
        },
        aspectRatio: '1:1',
        canonicalPrompt: makeCanonicalPrompt(),
        step2Artifacts: {
          mustFollowRules: [],
          freedomRules: [],
        },
      })
    ).rejects.toThrow('custom background requires Step 0 background buffer')
  })

  it('throws when background/elements branding is requested but preBrandedWithLogo metadata is missing', async () => {
    const personBuffer = await makeImageBuffer(1024, 1024)
    const backgroundBuffer = await makeImageBuffer(1024, 1024)

    await expect(
      executeV3Step2({
        personBuffer,
        backgroundBuffer,
        styleSettings: makeStyleSettings({ backgroundType: 'office', brandingPosition: 'background' }),
        aspectRatio: '1:1',
        canonicalPrompt: makeCanonicalPrompt(),
        step2Artifacts: {
          mustFollowRules: [],
          freedomRules: [],
        },
        preparedAssets: new Map(),
      })
    ).rejects.toThrow('requires Step 0 pre-branded background metadata')
  })
})
