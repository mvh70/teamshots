import sharp from 'sharp'

const generateWithGeminiMock = jest.fn()

jest.mock('@/queue/workers/generate-image/gemini', () => ({
  generateWithGemini: (...args: unknown[]) => generateWithGeminiMock(...args),
}))

import {
  brandCustomBackground,
  generateBrandedEnvironmentScene,
} from '../background-branding'

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 120, b: 120 },
    },
  })
    .png()
    .toBuffer()
}

describe('background-branding step0 prompt contract', () => {
  beforeEach(() => {
    generateWithGeminiMock.mockReset()
  })

  it('uses high-level role/task + JSON prompt format for custom background branding', async () => {
    const backgroundBuffer = await makePngBuffer(800, 1000)
    const outputBuffer = await makePngBuffer(800, 1000)

    generateWithGeminiMock.mockResolvedValue({
      images: [outputBuffer],
      providerUsed: 'vertex',
    })

    const result = await brandCustomBackground({
      backgroundBuffer,
      logoBase64: Buffer.from('logo').toString('base64'),
      logoMimeType: 'image/png',
      generationId: 'gen-custom',
      brandingPosition: 'background',
      canonicalPrompt: {
        scene: {
          environment: { location_type: 'office' },
          branding: { enabled: true, position: 'background' },
        },
      },
    })

    expect(result).not.toBeNull()

    const [prompt, referenceImages] = generateWithGeminiMock.mock.calls[0] as [
      string,
      Array<{ description?: string }>
    ]

    expect(prompt).toContain('Scene Specifications:')
    expect(prompt).toContain('Edit only the provided background image')
    expect(prompt).not.toContain('HARD CONSTRAINTS:')
    expect(prompt).not.toContain('COMPOSITION LAYOUT:')
    expect(prompt).not.toContain('"composition_layout"')
    expect(prompt).not.toContain('"constraints"')

    expect(referenceImages[0].description).toContain('BACKGROUND REFERENCE')
    expect(referenceImages[1].description).toContain('LOGO REFERENCE')
  })

  it('uses high-level role/task + JSON prompt format for generated environment branding', async () => {
    const outputBuffer = await makePngBuffer(1024, 1024)

    generateWithGeminiMock.mockResolvedValue({
      images: [outputBuffer],
      providerUsed: 'vertex',
    })

    const result = await generateBrandedEnvironmentScene({
      canonicalPrompt: {
        scene: {
          environment: { location_type: 'studio' },
          branding: { enabled: true, position: 'background' },
        },
      },
      isStudioType: true,
      brandingPosition: 'background',
      logoBase64: Buffer.from('logo').toString('base64'),
      logoMimeType: 'image/png',
      generationId: 'gen-environment',
      aspectRatio: '1:1',
    })

    expect(result).not.toBeNull()

    const [prompt] = generateWithGeminiMock.mock.calls[0] as [string]
    expect(prompt).toContain('Scene Specifications:')
    expect(prompt).toContain('Generate a branded studio background scene')
    expect(prompt).not.toContain('HARD CONSTRAINTS:')
    expect(prompt).not.toContain('COMPOSITION LAYOUT:')
    expect(prompt).not.toContain('"composition_layout"')
    expect(prompt).not.toContain('"constraints"')
  })
})
