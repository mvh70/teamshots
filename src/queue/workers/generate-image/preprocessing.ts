import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'

import type { DownloadSelfieFn } from '@/types/generation'

export interface PreprocessParams {
  packageId: string
  selfieKey: string
  styleSettings: PhotoStyleSettings
  downloadSelfie: DownloadSelfieFn
  skipLogoPlacement?: boolean // Skip logo placement (for V2 workflow where Step 1 handles it)
  skipBackgroundProcessing?: boolean // Skip background processing (for V2 workflow where Step 2 handles it)
}

export async function preprocessSelfie({
  packageId,
  selfieKey,
  styleSettings,
  downloadSelfie,
  skipLogoPlacement = false,
  skipBackgroundProcessing = false
}: PreprocessParams): Promise<Buffer> {
  try {
    const preprocessor = await loadPreprocessor(packageId)

    if (!preprocessor) {
      Logger.debug('No package-specific preprocessor found, using original selfie', { packageId })
      return await downloadSelfieBuffer(selfieKey, downloadSelfie)
    }

    const selfieBuffer = await downloadSelfieBuffer(selfieKey, downloadSelfie)

    // For V2 workflow, temporarily modify styleSettings to skip background/logo processing
    const modifiedStyleSettings: PhotoStyleSettings = {
      ...styleSettings,
      ...(skipBackgroundProcessing && { background: undefined }),
      ...(skipLogoPlacement && styleSettings.branding && {
        branding: {
          ...styleSettings.branding,
          logoKey: undefined
        }
      })
    }

    const backgroundKey = modifiedStyleSettings.background?.key
    const logoKey = modifiedStyleSettings.branding?.logoKey

    const usesExtendedSignature = preprocessor.length > 2
    const preprocessResult = usesExtendedSignature
      ? await preprocessor(selfieBuffer, modifiedStyleSettings, {
          backgroundS3Key: backgroundKey,
          logoS3Key: logoKey
        })
      : await preprocessor(selfieBuffer, modifiedStyleSettings)

    return preprocessResult.processedBuffer
  } catch (error) {
    Logger.error('Preprocessing failed, using original selfie', {
      packageId,
      error: error instanceof Error ? error.message : String(error)
    })
    return await downloadSelfieBuffer(selfieKey, downloadSelfie)
  }
}

type Preprocessor =
  | ((
      selfieBuffer: Buffer,
      styleSettings: PhotoStyleSettings
    ) => Promise<{ processedBuffer: Buffer; metadata?: Record<string, unknown> }>)
  | ((
      selfieBuffer: Buffer,
      styleSettings: PhotoStyleSettings,
      context?: { backgroundS3Key?: string; logoS3Key?: string }
    ) => Promise<{ processedBuffer: Buffer; metadata?: Record<string, unknown> }>)

async function loadPreprocessor(packageId: string): Promise<Preprocessor | null> {
  try {
    if (packageId === 'headshot1') {
      const preprocessorModule = await import('@/domain/style/packages/headshot1/preprocessor')
      return preprocessorModule.preprocessHeadshot1 as Preprocessor
    }
    if (packageId === 'freepackage') {
      const preprocessorModule = await import('@/domain/style/packages/freepackage/preprocessor')
      return preprocessorModule.preprocessFreepackage as Preprocessor
    }
  } catch (error) {
    Logger.warn('Could not load package preprocessor, defaulting to original selfie', {
      packageId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return null
}

async function downloadSelfieBuffer(selfieKey: string, downloadSelfie: DownloadSelfieFn): Promise<Buffer> {
  const selfie = await downloadSelfie(selfieKey)
  return Buffer.from(selfie.base64, 'base64')
}