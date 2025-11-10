import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'

import type { DownloadSelfieFn } from '@/types/generation'

export interface PreprocessParams {
  packageId: string
  selfieKey: string
  styleSettings: PhotoStyleSettings
  downloadSelfie: DownloadSelfieFn
  onStepProgress?: (stepName: string) => void
}

export async function preprocessSelfie({
  packageId,
  selfieKey,
  styleSettings,
  downloadSelfie,
  onStepProgress
}: PreprocessParams): Promise<Buffer> {
  try {
    const preprocessor = await loadPreprocessor(packageId)

    if (!preprocessor) {
      Logger.debug('No package-specific preprocessor found, using original selfie', { packageId })
      return await downloadSelfieBuffer(selfieKey, downloadSelfie)
    }

    const selfieBuffer = await downloadSelfieBuffer(selfieKey, downloadSelfie)

    const backgroundKey = styleSettings.background?.key
    const logoKey = styleSettings.branding?.logoKey

    const usesExtendedSignature = preprocessor.length > 2
    const preprocessResult = usesExtendedSignature
      ? await preprocessor(
          selfieBuffer,
          styleSettings,
          {
            backgroundS3Key: backgroundKey,
            logoS3Key: logoKey,
            onStepProgress
          }
        )
      : await preprocessor(selfieBuffer, styleSettings)

    Logger.debug('Applied package-specific preprocessing', {
      packageId,
      hasMetadata: Boolean(preprocessResult.metadata)
    })

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
      context?: { backgroundS3Key?: string; logoS3Key?: string; onStepProgress?: (stepName: string) => void }
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

