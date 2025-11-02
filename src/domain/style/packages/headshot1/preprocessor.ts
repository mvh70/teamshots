/**
 * Headshot1 Image Preprocessor
 * 
 * Processes images before generation. Currently no preprocessing needed for headshot1,
 * but this interface allows for future enhancements.
 */

export interface PreprocessorResult {
  processedBuffer: Buffer
  metadata?: Record<string, unknown>
}

export async function preprocessHeadshot1(
  selfieBuffer: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _styleSettings: unknown
): Promise<PreprocessorResult> {
  // Headshot1 doesn't require custom preprocessing
  // Return the original buffer unchanged
  return {
    processedBuffer: selfieBuffer,
    metadata: {
      preprocessor: 'headshot1',
      version: 1,
      applied: false
    }
  }
}

