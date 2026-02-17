jest.mock('../../gemini', () => ({ generateWithGemini: jest.fn() }))

import { generateWithGemini } from '../../gemini'
import { executeV3Step1a, projectForStep1a } from '../v3-step1a-person-generation'
import type { PhotoStyleSettings } from '@/types/photo-style'

describe('projectForStep1a', () => {
  it('retains subject wardrobe, removes camera, and applies step1a overrides', () => {
    const canonicalPrompt: Record<string, unknown> = {
      subject: {
        wardrobe: {
          color_palette: ['black', 'white', 'navy'],
          style: 'business-formal',
        },
      },
      framing: {
        shot_type: 'medium-shot',
      },
      wardrobe: {
        notes: 'from step0 garment analysis',
      },
      camera: {
        lens: { focal_length: '50mm' },
        settings: { aperture: 'f2.8' },
        positioning: {
          subject_to_background_ft: 8,
          camera_height: 'eye-level',
        },
        color: {
          white_balance_kelvin: 5600,
        },
      },
      rendering: {
        effects: ['film_grain'],
      },
      scene: {
        background: {
          type: 'office',
        },
      },
    }

    const projected = projectForStep1a(canonicalPrompt)

    expect((projected.subject as Record<string, unknown>)?.wardrobe).toEqual({
      color_palette: ['black', 'white', 'navy'],
      style: 'business-formal',
    })

    expect(projected.scene).toEqual({
      background: {
        type: 'solid',
        color: '#808080',
        description: 'Solid flat neutral grey background (#808080)',
      },
    })

    expect(projected).not.toHaveProperty('rendering')

    expect(projected).not.toHaveProperty('camera')

    expect(projected).not.toHaveProperty('lighting')
  })
})

describe('executeV3Step1a prompt artifact pass-through', () => {
  beforeEach(() => {
    ;(generateWithGemini as jest.Mock).mockReset()
    ;(generateWithGemini as jest.Mock).mockResolvedValue({
      images: [Buffer.from('mock-image')],
      providerUsed: 'vertex',
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        imagesGenerated: 1,
        durationMs: 10,
      },
    })
  })

  it('includes Step 1a artifact rules directly and still enforces baseline neutral-light guidance', async () => {
    await executeV3Step1a({
      selfieReferences: [
        {
          base64: Buffer.from('selfie').toString('base64'),
          mimeType: 'image/jpeg',
          description: 'Reference selfie 1',
        },
      ],
      styleSettings: {} as PhotoStyleSettings,
      downloadAsset: jest.fn(),
      aspectRatio: '1:1',
      aspectRatioConfig: { id: '1:1', width: 1024, height: 1024 },
      expectedWidth: 1024,
      expectedHeight: 1024,
      canonicalPrompt: {
        subject: {
          expression: 'calm',
          wardrobe: {
            color_palette: ['top_layer (formal): navy color', 'base_layer (shirt underneath): white color'],
          },
        },
        framing: { shot_type: 'medium-shot' },
      },
      step1aArtifacts: {
        mustFollowRules: ['Match lighting direction from camera left', 'Preserve face identity'],
        freedomRules: ['Use soft shadows under the jawline', 'Keep natural skin texture'],
      },
      generationId: 'gen-test',
      personId: 'person-test',
      debugMode: false,
    })

    const prompt = (generateWithGemini as jest.Mock).mock.calls[0][0] as string

    expect(prompt).toContain('Keep lighting neutral and even on the subject')
    expect(prompt).not.toContain('"lighting":')
    expect(prompt).toContain('Preserve face identity')
    expect(prompt).toContain('Match lighting direction from camera left')
    expect(prompt).toContain('Keep natural skin texture')
    expect(prompt).toContain('Use soft shadows under the jawline')
    expect(prompt).toContain('**Wardrobe colors:** Follow the wardrobe color guidance in the prompt JSON exactly')
  })
})
