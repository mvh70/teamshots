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

