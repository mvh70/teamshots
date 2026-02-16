import sharp from 'sharp'

import type { PhotoStyleSettings } from '@/types/photo-style'
import type { PreparedAsset } from '@/domain/style/elements/composition'

const generateTextWithGeminiMock = jest.fn()

jest.mock('../../gemini', () => ({
  generateTextWithGemini: (...args: unknown[]) => generateTextWithGeminiMock(...args),
}))

import { executeV3Step0Eval } from '../v3-step0-eval'

async function makeImageBase64(
  width: number,
  height: number,
  background: { r: number; g: number; b: number }
): Promise<string> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background,
    },
  })
    .png()
    .toBuffer()

  return buffer.toString('base64')
}

function makePreparedAsset(params: {
  elementId: string
  assetType: string
  base64: string
  mimeType?: string
  metadata?: Record<string, unknown>
}): PreparedAsset {
  return {
    elementId: params.elementId,
    assetType: params.assetType,
    data: {
      base64: params.base64,
      mimeType: params.mimeType || 'image/png',
      metadata: params.metadata,
    },
  }
}

describe('executeV3Step0Eval', () => {
  beforeEach(() => {
    generateTextWithGeminiMock.mockReset()
  })

  it('skips evaluation when branding is excluded', async () => {
    const styleSettings: PhotoStyleSettings = {
      branding: {
        mode: 'predefined',
        value: {
          type: 'exclude',
        },
      },
    }

    const output = await executeV3Step0Eval({
      styleSettings,
      preparedAssets: new Map(),
      downloadAsset: jest.fn(),
      generationId: 'gen-step0-no-branding',
    })

    expect(output.evaluation.status).toBe('Approved')
    expect(output.evaluation.scenario).toBe('none')
    expect(generateTextWithGeminiMock).not.toHaveBeenCalled()
  })

  it('evaluates clothing overlay with chroma guidance in prompt', async () => {
    const overlayBase64 = await makeImageBase64(300, 200, { r: 120, g: 120, b: 120 })
    const logoWithGreenMatteBase64 = await makeImageBase64(120, 80, { r: 0, g: 255, b: 0 })

    const styleSettings: PhotoStyleSettings = {
      branding: {
        mode: 'predefined',
        value: {
          type: 'include',
          position: 'clothing',
          logoKey: 'logos/company.png',
        },
      },
    }

    const preparedAssets = new Map<string, PreparedAsset>()
    preparedAssets.set(
      'clothing-overlay-overlay',
      makePreparedAsset({
        elementId: 'clothing-overlay',
        assetType: 'overlay',
        base64: overlayBase64,
        metadata: {
          brandingPosition: 'clothing',
        },
      })
    )
    preparedAssets.set(
      'branding-logo',
      makePreparedAsset({
        elementId: 'branding',
        assetType: 'logo',
        base64: logoWithGreenMatteBase64,
      })
    )

    generateTextWithGeminiMock.mockResolvedValue({
      text: JSON.stringify({
        logo_visible: 'YES',
        logo_accurate: 'YES',
        logo_placement: 'YES',
        clothing_logo_no_overflow: 'YES',
        explanations: {
          logo_accurate: 'Foreground content matches after ignoring chroma matte',
        },
      }),
      usage: {
        durationMs: 120,
        inputTokens: 10,
        outputTokens: 5,
      },
      providerUsed: 'vertex',
    })

    const output = await executeV3Step0Eval({
      styleSettings,
      preparedAssets,
      downloadAsset: jest.fn(),
      generationId: 'gen-step0-clothing',
    })

    expect(output.evaluation.status).toBe('Approved')
    expect(output.evaluation.scenario).toBe('clothing')

    const [promptText] = generateTextWithGeminiMock.mock.calls[0] as [string]
    expect(promptText).toContain('CRITICAL CHROMA RULES')
    expect(promptText).toContain('transparency guidance only')
  })

  it('fails clothing scenario when logo reference is unavailable', async () => {
    const overlayBase64 = await makeImageBase64(300, 200, { r: 120, g: 120, b: 120 })

    const styleSettings: PhotoStyleSettings = {
      branding: {
        mode: 'predefined',
        value: {
          type: 'include',
          position: 'clothing',
          logoKey: 'logos/company.png',
        },
      },
    }

    const preparedAssets = new Map<string, PreparedAsset>()
    preparedAssets.set(
      'clothing-overlay-overlay',
      makePreparedAsset({
        elementId: 'clothing-overlay',
        assetType: 'overlay',
        base64: overlayBase64,
        metadata: {
          brandingPosition: 'clothing',
        },
      })
    )

    const output = await executeV3Step0Eval({
      styleSettings,
      preparedAssets,
      downloadAsset: jest.fn(),
      generationId: 'gen-step0-missing-logo',
    })

    expect(output.evaluation.status).toBe('Not Approved')
    expect(output.evaluation.failedAssetKeys).toEqual(['clothing-overlay-overlay'])
    expect(generateTextWithGeminiMock).not.toHaveBeenCalled()
  })

  it('uses background logo fallback with logoAssetId priority', async () => {
    const backgroundBase64 = await makeImageBase64(600, 400, { r: 200, g: 200, b: 200 })
    const fallbackLogoBase64 = await makeImageBase64(120, 80, { r: 10, g: 10, b: 10 })

    const styleSettings: PhotoStyleSettings = {
      branding: {
        mode: 'predefined',
        value: {
          type: 'include',
          position: 'background',
          logoAssetId: 'asset-logo-id',
          logoKey: 'logos/company.png',
        },
      },
    }

    const preparedAssets = new Map<string, PreparedAsset>()
    preparedAssets.set(
      'background-custom-background',
      makePreparedAsset({
        elementId: 'background',
        assetType: 'custom-background',
        base64: backgroundBase64,
        metadata: {
          preBrandedWithLogo: true,
          preBrandedPosition: 'background',
        },
      })
    )

    const downloadAssetMock = jest.fn().mockResolvedValue({
      base64: fallbackLogoBase64,
      mimeType: 'image/png',
    })

    generateTextWithGeminiMock.mockResolvedValue({
      text: JSON.stringify({
        logo_visible: 'YES',
        logo_accurate: 'YES',
        logo_integrated: 'YES',
        explanations: {
          logo_integrated: 'Looks naturally integrated',
        },
      }),
      usage: {
        durationMs: 100,
        inputTokens: 10,
        outputTokens: 5,
      },
      providerUsed: 'vertex',
    })

    const output = await executeV3Step0Eval({
      styleSettings,
      preparedAssets,
      downloadAsset: downloadAssetMock,
      generationId: 'gen-step0-background-fallback',
    })

    expect(output.evaluation.status).toBe('Approved')
    expect(downloadAssetMock).toHaveBeenCalledWith('asset-logo-id')
  })

  it('rejects background scenario when integration fails (e.g. chroma halo)', async () => {
    const backgroundBase64 = await makeImageBase64(600, 400, { r: 210, g: 210, b: 210 })
    const logoBase64 = await makeImageBase64(120, 80, { r: 0, g: 255, b: 0 })

    const styleSettings: PhotoStyleSettings = {
      branding: {
        mode: 'predefined',
        value: {
          type: 'include',
          position: 'elements',
          logoKey: 'logos/company.png',
        },
      },
    }

    const preparedAssets = new Map<string, PreparedAsset>()
    preparedAssets.set(
      'background-custom-background',
      makePreparedAsset({
        elementId: 'background',
        assetType: 'custom-background',
        base64: backgroundBase64,
        metadata: {
          preBrandedWithLogo: true,
          preBrandedPosition: 'elements',
        },
      })
    )
    preparedAssets.set(
      'branding-logo',
      makePreparedAsset({
        elementId: 'branding',
        assetType: 'logo',
        base64: logoBase64,
      })
    )

    generateTextWithGeminiMock.mockResolvedValue({
      text: JSON.stringify({
        logo_visible: 'YES',
        logo_accurate: 'YES',
        logo_integrated: 'NO',
        explanations: {
          logo_integrated: 'Visible green halo behind logo',
        },
      }),
      usage: {
        durationMs: 100,
        inputTokens: 10,
        outputTokens: 5,
      },
      providerUsed: 'vertex',
    })

    const output = await executeV3Step0Eval({
      styleSettings,
      preparedAssets,
      downloadAsset: jest.fn(),
      generationId: 'gen-step0-background-reject',
    })

    expect(output.evaluation.status).toBe('Not Approved')
    expect(output.evaluation.failedAssetKeys).toEqual(['background-custom-background'])
    expect(output.evaluation.reason).toContain('logo_integrated: NO')
  })
})
