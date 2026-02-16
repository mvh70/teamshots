import sharp from 'sharp'

import type { PhotoStyleSettings } from '@/types/photo-style'

const generateTextWithGeminiMock = jest.fn()

jest.mock('../../gemini', () => ({
  generateTextWithGemini: (...args: unknown[]) => generateTextWithGeminiMock(...args),
}))

import { executeV3Step3 } from '../v3-step3-final-eval'

async function makeImageBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .jpeg()
    .toBuffer()
}

describe('executeV3Step3', () => {
  beforeEach(() => {
    generateTextWithGeminiMock.mockReset()
  })

  it('skips branding criterion when explicit branding evaluation is disabled', async () => {
    const refinedBuffer = await makeImageBuffer(1200, 1200)

    generateTextWithGeminiMock.mockResolvedValue({
      text: JSON.stringify({
        face_similarity: 'YES',
        characteristic_preservation: 'YES',
        person_prominence: 'YES',
        overall_quality: 'YES',
        branding_placement: 'NO',
        explanations: { face_similarity: 'ok' },
      }),
      usage: {
        durationMs: 100,
        inputTokens: 10,
        outputTokens: 5,
      },
      providerUsed: 'vertex',
    })

    const output = await executeV3Step3({
      refinedBuffer,
      expectedWidth: 1200,
      expectedHeight: 1200,
      aspectRatio: '1:1',
      evaluateBrandingPlacement: false,
      logoReference: {
        mimeType: 'image/png',
        base64: refinedBuffer.toString('base64'),
        description: 'Logo reference',
      },
      step3EvalArtifacts: {
        mustFollowRules: ['Face must match references.'],
        freedomRules: ['Minor background variance is acceptable.'],
      },
      generationId: 'gen-step3-no-branding-eval',
    })

    expect(output.evaluation.status).toBe('Approved')

    const [promptText] = generateTextWithGeminiMock.mock.calls[0] as [string]
    expect(promptText).not.toContain('5. branding_placement')
    expect(promptText).not.toContain('"branding_placement": "YES"')
  })

  it('includes branding criterion and conditional JSON field when branding evaluation is active', async () => {
    const refinedBuffer = await makeImageBuffer(1200, 1200)

    generateTextWithGeminiMock.mockResolvedValue({
      text: JSON.stringify({
        face_similarity: 'YES',
        characteristic_preservation: 'YES',
        person_prominence: 'YES',
        overall_quality: 'YES',
        branding_placement: 'YES',
        explanations: { face_similarity: 'ok' },
      }),
      usage: {
        durationMs: 100,
        inputTokens: 10,
        outputTokens: 5,
      },
      providerUsed: 'vertex',
    })

    const styleSettings: PhotoStyleSettings = {
      branding: {
        mode: 'predefined',
        value: {
          type: 'include',
          position: 'background',
          logoKey: 'logos/company.png',
        },
      },
    }

    const output = await executeV3Step3({
      refinedBuffer,
      expectedWidth: 1200,
      expectedHeight: 1200,
      aspectRatio: '1:1',
      styleSettings,
      evaluateBrandingPlacement: true,
      canonicalPrompt: {
        scene: {
          branding: {
            enabled: true,
            position: 'background',
            placement: 'center-left wall signage',
          },
        },
      },
      logoReference: {
        mimeType: 'image/png',
        base64: refinedBuffer.toString('base64'),
        description: 'Logo reference',
      },
      step3EvalArtifacts: {
        mustFollowRules: ['Branding must be clearly visible in the background.'],
        freedomRules: ['Minor perspective variation is acceptable.'],
      },
      generationId: 'gen-step3-branding-eval',
    })

    expect(output.evaluation.status).toBe('Approved')

    const [promptText, evalImages] = generateTextWithGeminiMock.mock.calls[0] as [
      string,
      Array<{ base64: string; mimeType: string }>
    ]

    expect(promptText).toContain('5. branding_placement')
    expect(promptText).toContain('"branding_placement": "YES"')
    expect(promptText).toContain('(40-60%+ of image height)')

    const candidateBuffer = Buffer.from(evalImages[0].base64, 'base64')
    const candidateMeta = await sharp(candidateBuffer).metadata()
    expect(candidateMeta.width).toBe(1200)
    expect(candidateMeta.height).toBe(1200)
    expect(evalImages[0].mimeType).toBe('image/jpeg')
  })

  it('uses shared prominence label in retry suggestions', async () => {
    const refinedBuffer = await makeImageBuffer(1200, 1200)

    generateTextWithGeminiMock.mockResolvedValue({
      text: JSON.stringify({
        face_similarity: 'YES',
        characteristic_preservation: 'YES',
        person_prominence: 'NO',
        overall_quality: 'YES',
        explanations: { person_prominence: 'person is too small' },
      }),
      usage: {
        durationMs: 100,
        inputTokens: 10,
        outputTokens: 5,
      },
      providerUsed: 'vertex',
    })

    const output = await executeV3Step3({
      refinedBuffer,
      expectedWidth: 1200,
      expectedHeight: 1200,
      aspectRatio: '1:1',
      step3EvalArtifacts: {
        mustFollowRules: [],
        freedomRules: [],
      },
      generationId: 'gen-step3-prominence-label',
    })

    expect(output.evaluation.status).toBe('Not Approved')
    expect(output.evaluation.suggestedAdjustments).toContain('40-60%+ of image height')
  })
})
