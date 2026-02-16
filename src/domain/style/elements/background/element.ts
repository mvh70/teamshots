/**
 * Background Element
 *
 * Contributes background scene and environment rules to generation phases.
 * Handles different background types (office, tropical beach, city, neutral, gradient, custom)
 * and standard-shots presets (cafe, outdoor, solid, urban, stage, dark_studio, team_bright, lifestyle).
 *
 * Generation logic (Gemini API calls, image processing) lives in the worker layer:
 * @see src/queue/workers/generate-image/utils/background-branding.ts
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  type PreparedAsset,
} from '../base/StyleElement'
import sharp from 'sharp'
import { hasValue } from '../base/element-types'
import { getBackgroundEnvironment } from './config'
import {
  generateBackgroundPrompt,
  getBackgroundCompositionMustFollowRules,
  getBackgroundGenerationConstraints,
  getBackgroundGenerationRequirements,
} from './prompt'
import { resolveLogoAsset } from './utils'
import { autoRegisterElement } from '../composition/registry'
import { Logger } from '@/lib/logger'
import type { BackgroundValue } from './types'

const MAX_BACKGROUND_SMALLEST_SIDE_PX = 1536

function mimeTypeFromSharpFormat(format: string | undefined, fallback: string): string {
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  return fallback
}

function buildFormatAwarePipeline(image: sharp.Sharp, format: string | undefined): sharp.Sharp {
  if (format === 'jpeg' || format === 'jpg') return image.jpeg({ quality: 95 })
  if (format === 'png') return image.png()
  if (format === 'webp') return image.webp({ quality: 95 })
  return image.jpeg({ quality: 95 })
}

export class BackgroundElement extends StyleElement {
  readonly id = 'background'
  readonly name = 'Background'
  readonly description = 'Background scene and environment settings'

  private async downscaleBackgroundIfNeeded(
    imageBuffer: Buffer,
    fallbackMimeType: string,
    generationId: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const oriented = await sharp(imageBuffer).rotate().toBuffer({ resolveWithObject: true })
    const width = oriented.info.width
    const height = oriented.info.height
    const format = oriented.info.format

    const smallestSide = Math.min(width, height)
    if (smallestSide <= MAX_BACKGROUND_SMALLEST_SIDE_PX) {
      return {
        buffer: oriented.data,
        mimeType: mimeTypeFromSharpFormat(format, fallbackMimeType),
      }
    }

    const scale = MAX_BACKGROUND_SMALLEST_SIDE_PX / smallestSide
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const resized = await buildFormatAwarePipeline(
      sharp(oriented.data).resize({
        width: targetWidth,
        height: targetHeight,
        fit: 'inside',
        withoutEnlargement: true,
      }),
      format
    ).toBuffer({ resolveWithObject: true })

    Logger.info('[BackgroundElement] Downscaled custom background to 1.5K-smallest-side cap', {
      generationId,
      originalWidth: width,
      originalHeight: height,
      resizedWidth: resized.info.width,
      resizedHeight: resized.info.height,
      maxSmallestSide: MAX_BACKGROUND_SMALLEST_SIDE_PX,
    })

    return {
      buffer: resized.data,
      mimeType: mimeTypeFromSharpFormat(resized.info.format, fallbackMimeType),
    }
  }

  private getBrandingValue(settings: ElementContext['settings']) {
    const branding = settings.branding
    return branding && hasValue(branding) ? branding.value : undefined
  }

  // Must run after BrandingElement so we can reuse the prepared logo asset.
  get dependsOn(): string[] | undefined {
    return ['branding']
  }

  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context
    const background = settings.background

    if (!background || !hasValue(background)) {
      return false
    }

    // background-generation phase: only when branding needs Step 0 data
    if (phase === 'background-generation') {
      const brandingValue = this.getBrandingValue(settings)
      return (
        brandingValue?.type === 'include' &&
        (brandingValue.position === 'background' || brandingValue.position === 'elements')
      )
    }

    // Step 1a intentionally uses a fixed grey background; background element only
    // contributes to Step 2 composition (and Step 0 background-generation when relevant).
    return phase === 'composition'
  }

  needsPreparation(context: ElementContext): boolean {
    const { settings } = context
    const background = settings.background

    if (!background || !hasValue(background)) {
      return false
    }

    const bgValue = background.value
    const brandingValue = this.getBrandingValue(settings)

    // Background/elements branding is always pre-generated in Step 0
    if (
      brandingValue?.type === 'include' &&
      (brandingValue.position === 'background' || brandingValue.position === 'elements')
    ) {
      return true
    }

    // Custom backgrounds always need preparation (download + optional branding)
    if (bgValue.type === 'custom' && !!(bgValue.key || bgValue.assetId)) {
      return true
    }

    return false
  }

  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const background = settings.background

    if (!background || !hasValue(background)) {
      throw new Error('BackgroundElement.prepare(): Background value required')
    }

    const bgValue = background.value
    const brandingValue = this.getBrandingValue(settings)
    const brandingPosition = brandingValue?.position
    const shouldPreBrand =
      brandingValue?.type === 'include' &&
      (brandingPosition === 'background' || brandingPosition === 'elements')

    if (bgValue.type !== 'custom') {
      if (brandingPosition !== 'background' && brandingPosition !== 'elements') {
        throw new Error(`BackgroundElement.prepare(): Unexpected branding position: ${brandingPosition}`)
      }
      return this.prepareEnvironmentBranding(context, bgValue, brandingPosition)
    }

    return this.prepareCustomBackground(context, bgValue, shouldPreBrand, brandingPosition)
  }

  // ---------------------------------------------------------------------------
  // Preparation helpers (thin orchestrators delegating to worker utilities)
  // ---------------------------------------------------------------------------

  private async prepareEnvironmentBranding(
    context: ElementContext,
    bgValue: BackgroundValue,
    brandingPosition: 'background' | 'elements',
  ): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const generationId = generationContext.generationId || 'unknown'
    const brandingValue = this.getBrandingValue(settings)
    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined

    // Extract scene data from canonical prompt
    const canonicalPrompt = generationContext.canonicalPrompt as Record<string, unknown> | undefined
    const aspectRatio = settings.aspectRatio || '3:4'

    if (!canonicalPrompt) {
      throw new Error(
        'BackgroundElement.prepareEnvironmentBranding(): canonicalPrompt is required for Step 0 branded scene generation'
      )
    }

    const logo = await resolveLogoAsset({
      preparedAssets: generationContext.preparedAssets,
      logoKey: brandingValue?.logoKey,
      logoAssetId: brandingValue?.logoAssetId,
      downloadAsset,
      generationId,
    })

    if (!logo) {
      // Graceful fallback: generate without branding rather than failing the entire generation
      Logger.warn('[BackgroundElement] Logo not available for environment branding, proceeding without branding', {
        generationId,
        backgroundType: bgValue.type,
        brandingPosition,
      })
      return {
        elementId: this.id,
        assetType: 'custom-background',
        data: {
          base64: '',
          mimeType: 'image/png',
          metadata: {
            preBrandedWithLogo: false,
            preBrandedPosition: brandingPosition,
            brandingSkipped: true,
            brandingSkipReason: 'logo-unavailable',
            backgroundType: bgValue.type,
          },
        },
      }
    }

    const isStudioType = getBackgroundEnvironment(bgValue.type) === 'studio'

    Logger.info('[BackgroundElement] Generating branded environment background', {
      generationId,
      backgroundType: bgValue.type,
      brandingPosition,
      aspectRatio,
      isStudioType,
    })

    const { generateBrandedEnvironmentScene, saveTmpBrandedBackground } = await import(
      '@/queue/workers/generate-image/utils/background-branding'
    )

    const MAX_ATTEMPTS = 3
    let finalBuffer: Buffer | null = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        finalBuffer = await generateBrandedEnvironmentScene({
            canonicalPrompt,
            isStudioType,
            brandingPosition,
            logoBase64: logo.base64,
            logoMimeType: logo.mimeType,
          generationId,
          aspectRatio,
        })
        if (finalBuffer) break

        Logger.warn('[BackgroundElement] Environment branding generation returned no output', {
          generationId,
          attempt,
          maxAttempts: MAX_ATTEMPTS,
        })
      } catch (error) {
        Logger.warn('[BackgroundElement] Environment branding generation failed', {
          generationId,
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (!finalBuffer) {
      throw new Error(`[BackgroundElement] All ${MAX_ATTEMPTS} environment branding attempts failed`)
    }

    await saveTmpBrandedBackground(generationId, finalBuffer)

    const logoIdentifier = brandingValue?.logoKey || brandingValue?.logoAssetId

    // Detect actual image format from buffer
    let mimeType = 'image/png'
    try {
      const sharp = (await import('sharp')).default
      const meta = await sharp(finalBuffer).metadata()
      if (meta.format === 'jpeg') mimeType = 'image/jpeg'
      else if (meta.format === 'webp') mimeType = 'image/webp'
    } catch {
      // Fall back to png if detection fails
    }

    return {
      elementId: this.id,
      assetType: 'custom-background',
      data: {
        base64: finalBuffer.toString('base64'),
        mimeType,
        metadata: {
          preBrandedWithLogo: true,
          preBrandedPosition: brandingPosition,
          logoIdentifier: logoIdentifier || 'prepared-logo',
          preBrandingMethod: 'gemini',
          generatedFromDescription: true,
          backgroundType: bgValue.type,
        },
      },
    }
  }

  private async prepareCustomBackground(
    context: ElementContext,
    bgValue: BackgroundValue,
    shouldPreBrand: boolean,
    brandingPosition: string | undefined,
  ): Promise<PreparedAsset> {
    const { settings, generationContext } = context
    const generationId = generationContext.generationId || 'unknown'
    const brandingValue = this.getBrandingValue(settings)
    const canonicalPrompt = generationContext.canonicalPrompt as Record<string, unknown> | undefined

    const downloadAsset = generationContext.downloadAsset as
      | ((key: string) => Promise<{ base64: string; mimeType: string } | null>)
      | undefined

    if (!downloadAsset) {
      throw new Error('BackgroundElement.prepare(): downloadAsset must be provided')
    }

    const bgKey = bgValue.key || bgValue.assetId
    if (!bgKey) {
      throw new Error('BackgroundElement.prepare(): Custom background requires a key or assetId')
    }

    Logger.info('[BackgroundElement] Downloading custom background', { generationId, backgroundKey: bgKey })

    const backgroundImage = await downloadAsset(bgKey)
    if (!backgroundImage) {
      throw new Error(`BackgroundElement.prepare(): Failed to download custom background: ${bgKey}`)
    }

    const originalBackgroundBuffer = Buffer.from(backgroundImage.base64, 'base64')
    const normalizedBackground = await this.downscaleBackgroundIfNeeded(
      originalBackgroundBuffer,
      backgroundImage.mimeType || 'image/jpeg',
      generationId
    )

    let finalBase64 = normalizedBackground.buffer.toString('base64')
    let finalMimeType = normalizedBackground.mimeType
    let preBrandedWithLogo = false
    let preBrandingMethod: 'gemini' | 'sharp-fallback' | undefined
    let logoIdentifierUsed: string | undefined

    if (shouldPreBrand && canonicalPrompt) {
      const logo = await resolveLogoAsset({
        preparedAssets: generationContext.preparedAssets,
        logoKey: brandingValue?.logoKey,
        logoAssetId: brandingValue?.logoAssetId,
        downloadAsset,
        generationId,
      })

      if (logo) {
        const { brandCustomBackground, saveTmpBrandedBackground } = await import(
          '@/queue/workers/generate-image/utils/background-branding'
        )

        const MAX_BRANDING_ATTEMPTS = 3
        for (let attempt = 1; attempt <= MAX_BRANDING_ATTEMPTS; attempt++) {
          try {
            const geminiBranded = await brandCustomBackground({
              backgroundBuffer: normalizedBackground.buffer,
              logoBase64: logo.base64,
              logoMimeType: logo.mimeType,
              generationId,
              brandingPosition: brandingPosition === 'elements' ? 'elements' : 'background',
              canonicalPrompt,
            })
            if (geminiBranded) {
              const normalizedBranded = await this.downscaleBackgroundIfNeeded(
                geminiBranded,
                'image/jpeg',
                generationId
              )
              finalBase64 = normalizedBranded.buffer.toString('base64')
              finalMimeType = normalizedBranded.mimeType
              preBrandedWithLogo = true
              preBrandingMethod = 'gemini'
              logoIdentifierUsed = brandingValue?.logoKey || brandingValue?.logoAssetId || 'prepared-logo'
              await saveTmpBrandedBackground(generationId, normalizedBranded.buffer)
              break
            }
            Logger.warn('[BackgroundElement] Gemini background branding returned no usable output', {
              generationId,
              attempt,
              maxAttempts: MAX_BRANDING_ATTEMPTS,
            })
          } catch (error) {
            Logger.warn('[BackgroundElement] Gemini background branding failed', {
              generationId,
              attempt,
              maxAttempts: MAX_BRANDING_ATTEMPTS,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
        if (!preBrandedWithLogo) {
          Logger.warn('[BackgroundElement] All Gemini branding attempts failed; using plain background', {
            generationId,
            attempts: MAX_BRANDING_ATTEMPTS,
          })
        }
      } else {
        Logger.warn('[BackgroundElement] Background branding requested but no logo available', {
          generationId,
        })
      }
    } else if (shouldPreBrand && !canonicalPrompt) {
      Logger.warn('[BackgroundElement] Background branding requested but canonicalPrompt is missing', {
        generationId,
      })
    }

    return {
      elementId: this.id,
      assetType: 'custom-background',
      data: {
        base64: finalBase64,
        mimeType: finalMimeType,
        s3Key: bgValue.key,
        metadata: {
          preBrandedWithLogo,
          preBrandedPosition: shouldPreBrand ? brandingPosition : undefined,
          logoIdentifier: logoIdentifierUsed,
          preBrandingMethod,
        },
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Phase contributions (pure data — no generation calls)
  // ---------------------------------------------------------------------------

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const background = settings.background

    if (!background || !hasValue(background)) {
      return { mustFollow: [], payload: {} }
    }

    const bgValue = background.value

    // background-generation phase: provide structured environment data for Step 0
    if (context.phase === 'background-generation') {
      return this.contributeToBackgroundGeneration(bgValue)
    }

    if (context.phase !== 'composition') {
      return { mustFollow: [], payload: {} }
    }

    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = { backgroundType: bgValue.type }

    const bgPrompt = generateBackgroundPrompt(bgValue)
    const environment = this.buildEnvironmentFromPrompt(bgPrompt)

    switch (bgValue.type) {
      case 'office':
      case 'tropical-beach':
      case 'busy-city':
      case 'neutral':
      case 'gradient':
      case 'custom':
      case 'cafe':
      case 'outdoor':
      case 'solid':
      case 'urban':
      case 'stage':
      case 'dark_studio':
      case 'team_bright':
      case 'lifestyle':
        mustFollow.push(...getBackgroundCompositionMustFollowRules(bgValue))
        break
      default:
        Logger.warn('[BackgroundElement] Unhandled background type in contribute()', {
          type: (bgValue as { type: string }).type,
        })
        return { mustFollow: [], payload: {} }
    }

    const payload: Record<string, unknown> = { scene: { environment } }

    return { mustFollow, payload, metadata }
  }

  /**
   * Contribute environment requirements for background-generation phase.
   * Provides structured scene.environment data with requirements for Step 0.
   */
  private contributeToBackgroundGeneration(bgValue: BackgroundValue): ElementContribution {
    const bgPrompt = generateBackgroundPrompt(bgValue)
    const environment = this.buildEnvironmentFromPrompt(bgPrompt)
    const requirements = getBackgroundGenerationRequirements(bgValue)
    environment.requirements = requirements.requirements
    if (requirements.customDetails) {
      environment.custom_details = requirements.customDetails
    }

    const payload: Record<string, unknown> = {
      scene: { environment },
      constraints: getBackgroundGenerationConstraints(),
    }

    return { payload }
  }

  /**
   * Build a scene.environment object from a background prompt result.
   */
  private buildEnvironmentFromPrompt(bgPrompt: ReturnType<typeof generateBackgroundPrompt>): Record<string, unknown> {
    const environment: Record<string, unknown> = {}
    if (bgPrompt.location_type) environment.location_type = bgPrompt.location_type
    if (bgPrompt.description) environment.description = bgPrompt.description
    if (bgPrompt.color_palette) environment.color_palette = bgPrompt.color_palette
    return environment
  }

  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const background = settings.background

    if (!background || !hasValue(background)) return errors

    const bgValue = background.value
    const COLOR_REQUIRED_TYPES = ['neutral', 'gradient', 'solid', 'dark_studio', 'team_bright']
    if (COLOR_REQUIRED_TYPES.includes(bgValue.type) && !bgValue.color) {
      errors.push(`${bgValue.type} background requires a color`)
    }
    if (bgValue.type === 'custom' && !bgValue.key && !bgValue.assetId) {
      errors.push('Custom background requires key or assetId')
    }

    return errors
  }

  get priority(): number {
    return 70
  }
}

export const backgroundElement = new BackgroundElement()
export default backgroundElement

autoRegisterElement(backgroundElement)
