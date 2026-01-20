/**
 * Industry Headshot Package - Server Implementation
 *
 * Builds generation payloads with industry-specific styling.
 * All style settings are derived from the industry selection.
 */

import { industryHeadshot } from './index'
import { getIndustryConfig, type IndustryType } from './industry-config'
import { buildDefaultReferencePayload, buildSplitSelfieComposites } from '@/lib/generation/reference-utils'
import { applyStandardPreset } from '../standard-settings'
import { resolveShotType } from '../../elements/shot-type/config'
import { ensureServerDefaults } from '../shared/utils'
import { resolvePackageAspectRatio } from '../shared/aspect-ratio-resolver'
import { downloadAssetAsBase64 } from '@/queue/workers/generate-image/s3-utils'
import { getS3BucketName, createS3Client } from '@/lib/s3-client'
import { compositionRegistry } from '../../elements/composition'
import { Telemetry } from '@/lib/telemetry'
import { hasValue, predefined } from '../../elements/base/element-types'
import type { GenerationContext, GenerationPayload, ReferenceImage } from '@/types/generation'
import type { ServerStylePackage } from '../types'
import { Logger } from '@/lib/logger'

export type IndustryHeadshotServerPackage = typeof industryHeadshot & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

export const industryHeadshotServer: IndustryHeadshotServerPackage = {
  ...industryHeadshot,

  buildGenerationPayload: async ({
    generationId,
    personId,
    styleSettings,
    selfieKeys,
    processedSelfies,
    selfieTypeMap,
    options,
  }: GenerationContext): Promise<GenerationPayload> => {
    // Track package usage
    Telemetry.increment(`generation.package.${industryHeadshot.id}`)
    Telemetry.increment(`generation.package.${industryHeadshot.id}.workflow.${options.workflowVersion}`)

    // Extract industry from styleSettings
    // Industry is stored in ElementSetting format: { mode: 'predefined', value: { type: 'medical' } }
    const industrySettings = (styleSettings as Record<string, unknown>).industry as
      | { mode?: string; value?: { type?: string } }
      | string
      | undefined

    let industry: string
    if (typeof industrySettings === 'string') {
      // Legacy: direct string value
      industry = industrySettings
    } else if (industrySettings && typeof industrySettings === 'object') {
      // New format: ElementSetting with value.type
      industry = industrySettings.value?.type || 'law-firms'
    } else {
      // Fallback
      industry = (styleSettings.customPrompt as string) || 'law-firms'
    }

    // Get industry-specific configuration
    const industryConfig = getIndustryConfig(industry)

    // Track which industry is being used
    Telemetry.increment(`generation.package.${industryHeadshot.id}.industry.${industry}`)

    // 1. Start with preset defaults (base configuration)
    const { settings: presetDefaults } = applyStandardPreset(
      styleSettings.presetId || industryHeadshot.defaultPresetId,
      {},
      industryHeadshot.presets || {}
    )

    // 2. Apply package defaults
    const withPackageDefaults = ensureServerDefaults(industryHeadshot, presetDefaults)

    // 3. Override with industry-specific settings
    // NOTE: We deliberately DON'T set clothing here - the standard clothing element
    // expects a detail key (like "formal") but industry configs use full descriptions.
    // Instead, we inject our own wardrobe section after composition.
    const effectiveSettings = {
      ...withPackageDefaults,
      // Background from industry config
      background: predefined({
        type: industryConfig.background.type,
        prompt: industryConfig.background.prompt,
      }),
      // Pose from industry config
      pose: predefined({
        type: industryConfig.pose.type,
      }),
      // Expression from industry config
      expression: predefined({
        type: industryConfig.expression.type,
      }),
      // Don't set clothing - we'll handle wardrobe manually
    }

    // Use fixed shot type for consistent professional headshots
    const packageShotType = 'medium-shot'
    effectiveSettings.shotType = predefined({ type: packageShotType })
    const shotTypeConfig = resolveShotType(packageShotType)
    const shotText = shotTypeConfig.id.replace(/-/g, ' ')

    // Resolve aspect ratio - use 4:5 for professional portraits
    const { ratioConfig, aspectRatio, aspectRatioDescription } = resolvePackageAspectRatio(
      effectiveSettings,
      shotTypeConfig,
      industryHeadshot.id
    )

    const getSelfieBuffer = async (key: string): Promise<Buffer> => {
      const buffer = processedSelfies[key]
      if (!buffer) {
        throw new Error(
          `Selfie buffer not found for key: ${key}. All selfies should be preprocessed before calling buildGenerationPayload.`
        )
      }
      return buffer
    }

    // Build reference payload with selfies
    const bucketName = getS3BucketName()
    const s3Client = createS3Client({ forcePathStyle: false })

    // Build split composites if selfieTypeMap is available
    let faceComposite: ReferenceImage | undefined
    let bodyComposite: ReferenceImage | undefined
    let selfieComposite: ReferenceImage | undefined

    if (selfieTypeMap && Object.keys(selfieTypeMap).length > 0) {
      Logger.info('Building split selfie composites (face/body)', {
        generationId,
        selfieTypeMap,
        selfieCount: selfieKeys.length
      })

      const splitComposites = await buildSplitSelfieComposites({
        selfieKeys,
        selfieTypeMap,
        getSelfieBuffer,
        generationId
      })

      faceComposite = splitComposites.faceComposite ?? undefined
      bodyComposite = splitComposites.bodyComposite ?? undefined
      selfieComposite = splitComposites.combinedComposite

      Logger.info('Split selfie composites built', {
        generationId,
        hasFaceComposite: !!faceComposite,
        hasBodyComposite: !!bodyComposite,
        hasCombinedComposite: !!selfieComposite
      })
    }

    const payload = await buildDefaultReferencePayload({
      styleSettings: effectiveSettings,
      selfieKeys,
      getSelfieBuffer,
      downloadAsset: (key) => downloadAssetAsBase64({ bucketName, s3Client, key }),
      generationId,
      shotDescription: shotText,
      aspectRatioDescription,
      aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height },
      workflowVersion: options.workflowVersion,
    })

    const referenceImages = payload.referenceImages
    const labelInstruction = payload.labelInstruction

    // Use element composition system to build the final prompt payload
    const elementContext = {
      phase: 'person-generation' as const,
      settings: effectiveSettings,
      generationContext: {
        selfieS3Keys: selfieKeys,
        userId: personId,
        generationId,
      },
      existingContributions: [],
    }

    const contributions = await compositionRegistry.composeContributions(elementContext)

    // Inject industry-specific wardrobe directly into the payload at subject.wardrobe
    // This overrides the standard clothing element which expects detail keys
    const basePayload = contributions.payload as Record<string, unknown>
    const subjectPayload = (basePayload.subject as Record<string, unknown>) || {}

    const finalPayload = {
      ...basePayload,
      subject: {
        ...subjectPayload,
        wardrobe: {
          style: industryConfig.clothing.style,
          details: industryConfig.clothing.details,
          top_layer: industryConfig.clothing.details,
          color_palette: [
            `top_layer: ${industryConfig.clothing.colors.topLayer} color`,
            `base_layer: ${industryConfig.clothing.colors.baseLayer} color`,
          ],
          notes: 'Follow the clothing description exactly as specified for this industry.',
        },
      },
    }

    const promptString = JSON.stringify(finalPayload, null, 2)

    return {
      prompt: promptString,
      mustFollowRules: contributions.mustFollow || [],
      freedomRules: contributions.freedom || [],
      referenceImages,
      labelInstruction,
      aspectRatio,
      aspectRatioDescription,
      // Split selfie composites for focused reference
      faceComposite,
      bodyComposite,
      selfieComposite,
    }
  },
}

export default industryHeadshotServer
