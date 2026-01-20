import { promises as fs } from 'fs'
import path from 'path'
import { Logger } from '@/lib/logger'

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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${stepName}-${generationId}-${timestamp}.png`
    const tmpDir = path.join(process.cwd(), 'tmp', debugDir)

    await fs.mkdir(tmpDir, { recursive: true })

    const filePath = path.join(tmpDir, filename)
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
 * Saves images as stepName-generationId-timestamp-1.png, -2.png, etc.
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const tmpDir = path.join(process.cwd(), 'tmp', debugDir)

    await fs.mkdir(tmpDir, { recursive: true })

    for (let i = 0; i < images.length; i++) {
      const suffix = images.length > 1 ? `-${i + 1}` : ''
      const filename = `${stepName}-${generationId}-${timestamp}${suffix}.png`
      const filePath = path.join(tmpDir, filename)
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
 * Log debug information about a prompt
 * Consolidates duplicate debug logging patterns
 */
export function logDebugPrompt(
  stepName: string,
  attempt: number,
  prompt: string,
  metadata?: Record<string, unknown>
): void {
  const maxLength = 10000
  const truncated = prompt.length > maxLength
  const displayPrompt = truncated 
    ? prompt.substring(0, maxLength) + '...(truncated)'
    : prompt

  Logger.info(`DEBUG - ${stepName} Prompt:`, {
    step: stepName,
    attempt,
    prompt: displayPrompt,
    promptLength: prompt.length,
    truncated,
    ...metadata
  })
}

