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
        pose: {
          description: 'High-level pose summary',
          detailed_instructions: 'Precise pose details',
          body_angle: 'Angled 45 degrees away from camera',
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

    expect((projected.subject as Record<string, unknown>)?.pose).toEqual({
      detailed_instructions: 'Precise pose details',
      body_angle: 'Angled 45 degrees away from camera',
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

  it('adds explicit precedence when accessory removal is configured', async () => {
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
          beautification: {
            accessories: {
              facialHair: { action: 'remove' },
            },
          },
        },
        framing: { shot_type: 'medium-shot' },
      },
      step1aArtifacts: {
        mustFollowRules: ['Preserve face identity'],
        freedomRules: [],
      },
      generationId: 'gen-test-accessory-remove',
      personId: 'person-test',
      debugMode: false,
    })

    const prompt = (generateWithGemini as jest.Mock).mock.calls[0][0] as string

    expect(prompt).toContain('Directive precedence: Explicit accessory REMOVE actions')
    expect(prompt).toContain('Mandatory removals for this generation: facial hair')
    expect(prompt).toContain('must be absent in the output even if visible in selfie references')
  })

  it('deduplicates repeated instructions and removes preserve facial-hair conflicts when removal is required', async () => {
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
          beautification: {
            accessories: {
              facialHair: { action: 'remove' },
            },
          },
        },
        framing: { shot_type: 'medium-shot' },
      },
      step1aArtifacts: {
        mustFollowRules: [
          'Preserve facial hair exactly as shown in the selfie references.',
          'Preserve facial hair exactly as shown in the selfie references.',
          'Keep lighting neutral and even on the subject. Do not apply scene-specific dramatic or directional lighting in this step.',
        ],
        freedomRules: [
          'Subtle color grading to enhance professional appearance',
          'Subtle color grading to enhance professional appearance',
        ],
      },
      generationId: 'gen-test-dedupe-conflict',
      personId: 'person-test',
      debugMode: false,
    })

    const prompt = (generateWithGemini as jest.Mock).mock.calls[0][0] as string

    expect(prompt).not.toContain('Preserve facial hair exactly as shown in the selfie references.')
    expect(prompt).toContain('Mandatory removals for this generation: facial hair')
    expect(
      prompt.split('Keep lighting neutral and even on the subject. Do not apply scene-specific dramatic or directional lighting in this step.').length - 1
    ).toBe(1)
    expect(prompt.split('Subtle color grading to enhance professional appearance').length - 1).toBe(1)
  })

  it('requires visible belt guidance when belt is an inherent accessory in waist-revealing shots', async () => {
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
          wardrobe: {
            inherent_accessories: ['belt'],
          },
        },
        framing: { shot_type: 'medium-shot' },
      },
      step1aArtifacts: {
        mustFollowRules: [],
        freedomRules: [],
      },
      generationId: 'gen-test-belt-guidance',
      personId: 'person-test',
      debugMode: false,
    })

    const prompt = (generateWithGemini as jest.Mock).mock.calls[0][0] as string
    expect(prompt).toContain('Belt visibility requirement')
    expect(prompt).toContain('Belt styling requirement')
    expect(prompt).toContain('distinct from the trousers color')
  })
})
