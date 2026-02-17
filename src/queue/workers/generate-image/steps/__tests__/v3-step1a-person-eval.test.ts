import sharp from 'sharp'

const generateTextWithGeminiMock = jest.fn()

jest.mock('../../gemini', () => ({
  generateTextWithGemini: (...args: unknown[]) => generateTextWithGeminiMock(...args),
}))

import { executeV3Step1aEval } from '../v3-step1a-person-eval'

async function makeImageBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 230, g: 230, b: 230 },
    },
  })
    .jpeg()
    .toBuffer()
}

describe('executeV3Step1aEval', () => {
  beforeEach(() => {
    generateTextWithGeminiMock.mockReset()
    generateTextWithGeminiMock.mockResolvedValue({
      text: JSON.stringify({
        is_fully_generated: 'YES',
        identity_preserved: 'YES',
        proportions_realistic: 'YES',
        no_unauthorized_add_ons: 'YES',
        no_unauthorized_accessories: 'YES',
        no_visible_reference_labels: 'YES',
        wardrobe_and_colors_match: 'YES',
        explanations: {
          identity_preserved: 'Face matches references',
        },
      }),
      usage: {
        durationMs: 100,
        inputTokens: 10,
        outputTokens: 5,
      },
      providerUsed: 'vertex',
    })
  })

  it('reuses step1a projected prompt context and scopes accessories to face references', async () => {
    const candidate = await makeImageBuffer(1024, 1024)
    const faceRef = await makeImageBuffer(800, 1000)
    const bodyRef = await makeImageBuffer(800, 1000)

    const output = await executeV3Step1aEval({
      imageBuffer: candidate,
      selfieReferences: [],
      faceComposite: {
        base64: faceRef.toString('base64'),
        mimeType: 'image/jpeg',
      },
      bodyComposite: {
        base64: bodyRef.toString('base64'),
        mimeType: 'image/jpeg',
      },
      expectedWidth: 1024,
      expectedHeight: 1024,
      aspectRatioConfig: { id: '1:1', width: 1024, height: 1024 },
      generationPrompt: JSON.stringify({
        subject: {
          demographic_guidance: {
            gender: 'female',
          },
          wardrobe: {
            inherent_accessories: ['belt'],
          },
        },
        framing: {
          shot_type: 'medium-shot',
        },
        camera: {
          lens: {
            focal_length_mm: 70,
          },
        },
      }),
      generationId: 'gen-step1a-eval-projection',
    })

    expect(output.evaluation.status).toBe('Approved')

    const [promptText, evalImages] = generateTextWithGeminiMock.mock.calls[0] as [
      string,
      Array<{ name?: string; description?: string }>
    ]

    expect(promptText).toContain('---BEGIN_GENERATION_PROMPT_JSON---')
    expect(promptText).toContain('"scene"')
    expect(promptText).not.toContain('"camera"')
    expect(promptText).toContain(
      'FACE REFERENCE is the source of truth for facial identity and face/head accessories'
    )
    expect(promptText).toContain(
      'BODY REFERENCE is ONLY for body proportions/form (including natural breast/chest shape)'
    )
    expect(promptText).toContain('CLOTHING-LEVEL ACCESSORIES AUTHORIZED: belt')
    expect(promptText).toContain('Accessories visible in FACE REFERENCE are authorized')
    expect(promptText).toContain('wardrobe_and_colors_match')
    expect(promptText).toContain('subject.wardrobe in the prompt JSON as the source of truth')
    expect(promptText).not.toContain('N/A (not applicable)')
    expect(promptText).not.toContain('custom_background_matches')
    expect(promptText).not.toContain('branding_logo_matches')

    const faceImage = evalImages.find((image) => image.name?.startsWith('face-reference'))
    const bodyImage = evalImages.find((image) => image.name?.startsWith('body-reference'))
    expect(faceImage?.description).toContain('Source of truth for facial identity and face/head accessories')
    expect(bodyImage?.description).toContain('Use ONLY for body proportions/form')
    expect(bodyImage?.description).toContain('female chest/breast shape')
  })

  it('rejects when wardrobe and colors do not match', async () => {
    generateTextWithGeminiMock.mockResolvedValueOnce({
      text: JSON.stringify({
        is_fully_generated: 'YES',
        identity_preserved: 'YES',
        proportions_realistic: 'YES',
        no_unauthorized_add_ons: 'YES',
        no_unauthorized_accessories: 'YES',
        no_visible_reference_labels: 'YES',
        wardrobe_and_colors_match: 'NO',
        explanations: {
          wardrobe_and_colors_match: 'Jacket color and garment layers do not match wardrobe guidance',
        },
      }),
      usage: {
        durationMs: 110,
        inputTokens: 12,
        outputTokens: 8,
      },
      providerUsed: 'vertex',
    })

    const candidate = await makeImageBuffer(1024, 1024)
    const output = await executeV3Step1aEval({
      imageBuffer: candidate,
      selfieReferences: [],
      expectedWidth: 1024,
      expectedHeight: 1024,
      aspectRatioConfig: { id: '1:1', width: 1024, height: 1024 },
      generationPrompt: JSON.stringify({
        subject: {
          wardrobe: {
            details: 'Business suit',
            color_palette: ['top_layer (formal): navy color', 'base_layer (shirt underneath): white color'],
          },
        },
        framing: {
          shot_type: 'medium-close-up',
        },
      }),
      generationId: 'gen-step1a-eval-wardrobe-mismatch',
    })

    expect(output.evaluation.status).toBe('Not Approved')
    expect(output.evaluation.reason).toContain('wardrobe_and_colors_match: NO')
  })
})
