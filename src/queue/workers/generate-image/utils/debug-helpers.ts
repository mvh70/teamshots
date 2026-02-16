import { promises as fs } from 'fs'
import path from 'path'
import { Logger } from '@/lib/logger'
import { detectImageFormat } from '@/lib/image-format'

function sanitizeGenerationId(generationId: string): string {
  const sanitized = generationId.replace(/[^a-zA-Z0-9_-]/g, '')
  return sanitized || 'unknown-generation'
}

function resolveSafeDebugPath(
  debugDir: string,
  filename: string
): { tmpDir: string; filePath: string } {
  const tmpDir = path.resolve(path.join(process.cwd(), 'tmp', debugDir))
  const filePath = path.resolve(path.join(tmpDir, filename))
  if (!filePath.startsWith(tmpDir)) {
    throw new Error('Resolved debug path is outside expected directory')
  }
  return { tmpDir, filePath }
}

/**
 * Save intermediate file for debugging
 * Consolidates duplicate debug file saving logic from workflow-v3.ts and other files
 */
export async function saveIntermediateFile(
  buffer: Buffer,
  stepName: string,
  generationId: string,
  debugMode: boolean,
  debugDir = 'v3-debug'
): Promise<void> {
  if (!debugMode) return

  try {
    const safeGenerationId = sanitizeGenerationId(generationId)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const { extension } = await detectImageFormat(buffer)
    const filename = `${stepName}-${safeGenerationId}-${timestamp}.${extension}`
    const { tmpDir, filePath } = resolveSafeDebugPath(debugDir, filename)

    await fs.mkdir(tmpDir, { recursive: true })
    await fs.writeFile(filePath, buffer)

    Logger.info(`Saved intermediate file: ${filePath}`, {
      step: stepName,
      generationId,
      filePath,
      fileSize: buffer.length
    })
  } catch (error) {
    Logger.warn('Failed to save intermediate file', {
      step: stepName,
      generationId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Save all generated images for debugging (handles multiple images with suffixes)
 * Saves images as stepName-generationId-timestamp-1.<ext>, -2.<ext>, etc.
 */
export async function saveAllIntermediateImages(
  images: Buffer[],
  stepName: string,
  generationId: string,
  debugMode: boolean,
  debugDir = 'v3-debug'
): Promise<void> {
  if (!debugMode || images.length === 0) return

  try {
    const safeGenerationId = sanitizeGenerationId(generationId)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const tmpDir = path.resolve(path.join(process.cwd(), 'tmp', debugDir))

    await fs.mkdir(tmpDir, { recursive: true })

    for (let i = 0; i < images.length; i++) {
      const suffix = images.length > 1 ? `-${i + 1}` : ''
      const { extension } = await detectImageFormat(images[i])
      const filename = `${stepName}-${safeGenerationId}-${timestamp}${suffix}.${extension}`
      const { filePath } = resolveSafeDebugPath(debugDir, filename)
      await fs.writeFile(filePath, images[i])

      Logger.info(`Saved intermediate file: ${filePath}`, {
        step: stepName,
        generationId,
        filePath,
        fileSize: images[i].length,
        imageIndex: i + 1,
        totalImages: images.length
      })
    }
  } catch (error) {
    Logger.warn('Failed to save intermediate files', {
      step: stepName,
      generationId,
      imageCount: images.length,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Save a JSON debug artifact for deterministic prompt/debug inspection.
 */
export async function saveDebugJson(
  data: unknown,
  baseName: string,
  generationId: string,
  debugMode: boolean,
  debugDir = 'v3-debug'
): Promise<void> {
  if (!debugMode) return

  try {
    const safeGenerationId = sanitizeGenerationId(generationId)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${baseName}-${safeGenerationId}-${timestamp}.json`
    const { tmpDir, filePath } = resolveSafeDebugPath(debugDir, filename)

    await fs.mkdir(tmpDir, { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

    Logger.info(`Saved debug JSON: ${filePath}`, {
      generationId,
      filePath,
      baseName,
    })
  } catch (error) {
    Logger.warn('Failed to save debug JSON', {
      generationId,
      baseName,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
