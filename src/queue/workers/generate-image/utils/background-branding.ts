/**
 * Background Branding Utilities
 *
 * Handles Gemini API calls for branded background generation.
 * Extracted from BackgroundElement to keep the element as a pure data contributor.
 */

import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { Logger } from '@/lib/logger'
import { logPrompt } from '@/queue/workers/generate-image/utils/logging'
import {
  projectStep0BackgroundBrandingPayload,
  getStep0BackgroundReferenceDescription,
} from '@/domain/style/elements/background/prompt'
import {
  getLogoReferenceDescription,
} from '@/domain/style/elements/branding/prompt'
import {
  buildStep0BackgroundBrandingPrompt,
} from '@/queue/workers/generate-image/steps/prompts/v3-step0-background-branding-prompt'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASPECT_RATIO_CANDIDATES = [
  { label: '9:16', ratio: 9 / 16 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '2:3', ratio: 2 / 3 },
  { label: '1:1', ratio: 1 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '5:4', ratio: 5 / 4 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '21:9', ratio: 21 / 9 },
]

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Find the closest standard Gemini aspect ratio for given dimensions.
 */
function resolveClosestAspectRatio(width: number, height: number): string {
  const target = width / height
  let best = '1:1'
  let bestDelta = Number.POSITIVE_INFINITY

  for (const candidate of ASPECT_RATIO_CANDIDATES) {
    const delta = Math.abs(target - candidate.ratio)
    if (delta < bestDelta) {
      bestDelta = delta
      best = candidate.label
    }
  }

  return best
}

/**
 * Save a branded background to the debug tmp folder.
 */
export async function saveTmpBrandedBackground(
  generationId: string,
  imageBuffer: Buffer
): Promise<void> {
  try {
    const tmpDir = path.join(process.cwd(), 'tmp', 'collages')
    await fs.mkdir(tmpDir, { recursive: true })

    const filename = `${generationId}-background-branding.png`
    await fs.writeFile(path.join(tmpDir, filename), imageBuffer)

    Logger.info('[BackgroundBranding] Saved branded background to tmp folder', {
      path: `tmp/collages/${filename}`,
      generationId,
    })
  } catch (error) {
    Logger.warn('[BackgroundBranding] Failed to save branded background to tmp folder', {
      generationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// ---------------------------------------------------------------------------
// Custom background branding (edit an existing image)
// ---------------------------------------------------------------------------

/**
 * Brand an existing custom background image by adding a logo via Gemini.
 *
 * Takes an uploaded background and overlays a logo as environmental branding
 * (acrylic signage for 'background' position, flag/banner for 'elements').
 */
export async function brandCustomBackground(params: {
  backgroundBuffer: Buffer
  logoBase64: string
  logoMimeType: string
  generationId: string
  brandingPosition: 'background' | 'elements'
  canonicalPrompt: Record<string, unknown>
}): Promise<Buffer | null> {
  const {
    backgroundBuffer,
    logoBase64,
    logoMimeType,
    generationId,
    brandingPosition,
    canonicalPrompt,
  } = params

  const bgMetadata = await sharp(backgroundBuffer).metadata()
  const bgWidth = bgMetadata.width || 0
  const bgHeight = bgMetadata.height || 0
  if (!bgWidth || !bgHeight) {
    return null
  }

  const { generateWithGemini } = await import('@/queue/workers/generate-image/gemini')

  const aspectRatio = resolveClosestAspectRatio(bgWidth, bgHeight)
  const jsonPrompt = projectStep0BackgroundBrandingPayload(canonicalPrompt)
  const prompt = buildStep0BackgroundBrandingPrompt({
    mode: 'custom-edit',
    jsonPrompt,
  })

  logPrompt('Step 0 Background Branding (custom)', prompt, generationId)

  const result = await generateWithGemini(
    prompt,
    [
      {
        mimeType: 'image/png',
        base64: backgroundBuffer.toString('base64'),
        description: getStep0BackgroundReferenceDescription(),
      },
      {
        mimeType: logoMimeType || 'image/png',
        base64: logoBase64,
        description: getLogoReferenceDescription(brandingPosition),
      },
    ],
    aspectRatio,
    undefined,
    {
      temperature: 0.3,
      stage: 'BACKGROUND_BRANDING',
    }
  )

  if (!result.images || result.images.length === 0) {
    Logger.warn('[BackgroundBranding] Gemini custom branding returned no images', { generationId })
    return null
  }

  const outputBuffer = result.images[0]
  const outputMeta = await sharp(outputBuffer).metadata()
  const outputWidth = outputMeta.width || 0
  const outputHeight = outputMeta.height || 0
  if (!outputWidth || !outputHeight) {
    Logger.warn('[BackgroundBranding] Gemini custom branding output has no dimensions', {
      generationId,
      outputWidth,
      outputHeight,
      bufferSize: outputBuffer.length,
      format: outputMeta.format,
    })
    return null
  }

  Logger.info('[BackgroundBranding] Prepared custom background branding via Gemini', {
    generationId,
    aspectRatio,
    outputDimensions: `${outputWidth}x${outputHeight}`,
    originalDimensions: `${bgWidth}x${bgHeight}`,
    outputSize: `${Math.round(outputBuffer.length / 1024)}KB`,
    provider: result.providerUsed,
  })

  if (result.thinking && process.env.NODE_ENV !== 'production') {
    const { saveDebugJson } = await import('@/queue/workers/generate-image/utils/debug-helpers')
    await saveDebugJson(
      { step: 'step0-background-custom', thinking: result.thinking },
      'thinking-step0-background-custom',
      generationId,
      true
    )
  }

  return outputBuffer
}

// ---------------------------------------------------------------------------
// Environment background generation (generate scene from scratch)
// ---------------------------------------------------------------------------

/**
 * Generate a branded environment background scene from a text description.
 *
 * Unlike brandCustomBackground which edits an existing image, this generates
 * the entire scene from scratch and integrates the logo in a single Gemini call.
 *
 * Uses the canonical prompt JSON as the single source of truth.
 */
export async function generateBrandedEnvironmentScene(params: {
  canonicalPrompt: Record<string, unknown>
  isStudioType: boolean
  brandingPosition: 'background' | 'elements'
  logoBase64: string
  logoMimeType: string
  generationId: string
  aspectRatio: string
}): Promise<Buffer | null> {
  const {
    canonicalPrompt,
    isStudioType,
    brandingPosition,
    logoBase64,
    logoMimeType,
    generationId,
    aspectRatio,
  } = params

  const { generateWithGemini } = await import('@/queue/workers/generate-image/gemini')

  const jsonPrompt = projectStep0BackgroundBrandingPayload(canonicalPrompt)

  const prompt = buildStep0BackgroundBrandingPrompt({
    mode: 'environment-generate',
    isStudioType,
    jsonPrompt,
  })

  logPrompt('Step 0 Background Branding (generated)', prompt, generationId)

  const result = await generateWithGemini(
    prompt,
    [
      {
        mimeType: logoMimeType || 'image/png',
        base64: logoBase64,
        description: getLogoReferenceDescription(brandingPosition),
      },
    ],
    aspectRatio,
    undefined,
    {
      temperature: 0.4,
      stage: 'BACKGROUND_BRANDING',
    }
  )

  if (!result.images || result.images.length === 0) {
    Logger.warn('[BackgroundBranding] Environment branding generation returned no images', { generationId })
    return null
  }

  const outputBuffer = result.images[0]
  const outputMeta = await sharp(outputBuffer).metadata()
  const outputWidth = outputMeta.width || 0
  const outputHeight = outputMeta.height || 0

  if (!outputWidth || !outputHeight) {
    Logger.warn('[BackgroundBranding] Environment branding output has no dimensions', {
      generationId,
      outputWidth,
      outputHeight,
      bufferSize: outputBuffer.length,
      format: outputMeta.format,
    })
    return null
  }

  Logger.info('[BackgroundBranding] Generated branded environment background', {
    generationId,
    aspectRatio,
    outputDimensions: `${outputWidth}x${outputHeight}`,
    outputSize: `${Math.round(outputBuffer.length / 1024)}KB`,
    provider: result.providerUsed,
  })

  if (result.thinking && process.env.NODE_ENV !== 'production') {
    const { saveDebugJson } = await import('@/queue/workers/generate-image/utils/debug-helpers')
    await saveDebugJson(
      { step: 'step0-background', thinking: result.thinking },
      'thinking-step0-background',
      generationId,
      true
    )
  }

  return outputBuffer
}
