
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { getS3BucketName, createS3Client } from '@/lib/s3-client'
import type { GenerationContext, GenerationPayload, ReferenceImage } from '@/types/generation'
import type { PhotoStyleSettings, ClothingColorValue } from '@/types/photo-style'
import { ClientStylePackage } from '../packages/types'
import { mergeUserSettings } from '../packages/shared/utils'
import { resolveShotType } from '../elements/shot-type/config'
import { resolvePackageAspectRatio } from '../packages/shared/aspect-ratio-resolver'
import { buildDefaultReferencePayload, buildSplitSelfieComposites } from '@/lib/generation/reference-utils'
import { downloadAssetAsBase64 } from '@/queue/workers/generate-image/s3-utils'
import { hasValue, predefined } from '../elements/base/element-types'
import { compositionRegistry } from '../elements/composition'
import { ElementContext } from '../elements/base/StyleElement'
import '../elements/quality/GlobalQualityElement' // Register Global Quality Element

/**
 * Base class for Server Style Packages to reduce boilerplate.
 * Handles common logic like:
 * - Telemetry
 * - Settings hierarchy (Preset -> Package -> User)
 * - Aspect ratio resolution
 * - Selfie processing & composites
 * - Payload composition via Registry
 */
export class BasePackageServer {
    private readonly s3Client = createS3Client({ forcePathStyle: false })

    constructor(protected readonly packageConfig: ClientStylePackage) {
        if (!packageConfig) {
            Logger.error('[BasePackageServer] Constructor received undefined packageConfig')
        } else if (!packageConfig.defaultSettings) {
            Logger.error('[BasePackageServer] Constructor received packageConfig without defaultSettings', { pkgId: packageConfig.id })
        }
    }

    /**
     * Main entry point for building the generation payload.
     * Packages can override specific steps if needed, but the default flow covers 90% of cases.
     */
    async buildGenerationPayload(context: GenerationContext): Promise<GenerationPayload> {
        const { generationId, personId, styleSettings, selfieKeys, processedSelfies, selfieTypeMap, demographics, options } = context
        const pkg = this.packageConfig

        // 1. Telemetry
        Telemetry.increment(`generation.package.${pkg.id}`)
        Telemetry.increment(`generation.package.${pkg.id}.workflow.${options.workflowVersion}`)

        // 2. Settings Resolution
        const effectiveSettings = this.resolveEffectiveSettings(styleSettings)

        // Hydrate partial clothing colors so prompt composition receives complete layer colors.
        // This prevents cases where UI displays default/fallback colors but only a subset
        // of colors is persisted (e.g., missing baseLayer for multi-layer outfits).
        this.hydratePartialClothingColors(effectiveSettings)

        // Hook for packages to modify settings before processing (e.g. injecting film types)
        this.customizeSettings(effectiveSettings)

        // 3. Aspect Ratio & Shot Type
        const defaultShotType = pkg.defaultSettings.shotType
        const packageShotType = hasValue(defaultShotType) ? defaultShotType.value.type : 'medium-shot'

        // Check if user has overridden shot type and it's visible, otherwise use package default
        if (!effectiveSettings.shotType) {
            effectiveSettings.shotType = predefined({ type: packageShotType })
        }

        // We trust what's in effectiveSettings now (either user choice or package default)
        const activeShotType = hasValue(effectiveSettings.shotType) ? effectiveSettings.shotType.value.type : packageShotType
        const shotTypeConfig = resolveShotType(activeShotType)
        const shotText = shotTypeConfig.id.replace(/-/g, ' ')

        const { ratioConfig, aspectRatio, aspectRatioDescription } = resolvePackageAspectRatio(
            effectiveSettings,
            shotTypeConfig,
            pkg.id as string
        )

        // 4. Asset Preparation Helpers
        const getSelfieBuffer = async (key: string): Promise<Buffer> => {
            const buffer = processedSelfies[key]
            if (!buffer) {
                throw new Error(`Selfie buffer not found for key: ${key}. All selfies should be preprocessed.`)
            }
            return buffer
        }

        const bucketName = getS3BucketName()

        // 5. Build Composites
        let faceComposite: ReferenceImage | undefined
        let bodyComposite: ReferenceImage | undefined
        let selfieComposite: ReferenceImage | undefined

        if (selfieTypeMap && Object.keys(selfieTypeMap).length > 0) {
            Logger.info('Building split selfie composites', {
                generationId,
                hasTypeMap: true,
                mapKeys: Object.keys(selfieTypeMap),
                mapValues: Object.values(selfieTypeMap)
            })
            const splitComposites = await buildSplitSelfieComposites({
                selfieKeys,
                selfieTypeMap,
                getSelfieBuffer,
                generationId
            })
            faceComposite = splitComposites.faceComposite ?? undefined
            bodyComposite = splitComposites.bodyComposite ?? undefined
            // Only use combined composite when no split composites exist
            selfieComposite = splitComposites.combinedComposite ?? undefined
        }

        // 6. Build Reference Payload
        // If split composites were created, skip the mixed "all-in-one" composite to avoid confusing the AI
        const hasSplitComposites = Boolean(faceComposite || bodyComposite)

        const refPayload = await buildDefaultReferencePayload({
            styleSettings: effectiveSettings,
            selfieKeys,
            getSelfieBuffer,
            downloadAsset: (key) => downloadAssetAsBase64({ bucketName, s3Client: this.s3Client, key }),
            generationId,
            shotDescription: shotText,
            aspectRatioDescription,
            aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height },
            workflowVersion: options.workflowVersion,
            skipSelfieComposite: hasSplitComposites
        })

        // 7. Compose Final Prompt via Registry
        const elementContext: ElementContext = {
            phase: 'person-generation',
            settings: effectiveSettings,
            packageContext: {
                packageId: pkg.id,
                // If package declares requiredElements, use them as the active elements filter
                // This gives packages control over which elements contribute
                activeElements: pkg.requiredElements,
            },
            generationContext: {
                selfieS3Keys: selfieKeys,
                userId: personId,
                generationId,
                demographics,
                hasFaceComposite: Boolean(faceComposite),
                hasBodyComposite: Boolean(bodyComposite),
            },
            existingContributions: [],
        }

        const contributions = await compositionRegistry.composeContributions(elementContext)

        // Hook for final payload modification
        const finalPayload = this.modifyFinalPayload(contributions.payload as Record<string, unknown>, effectiveSettings)
        const promptString = JSON.stringify(finalPayload, null, 2)

        // 8. Merge reference images from elements (e.g. custom clothing collages)
        // Element contributions use data URIs (url: "data:mime;base64,...") which need
        // converting to the { base64, mimeType } format used by the generation pipeline
        const elementReferenceImages: ReferenceImage[] = []
        for (const ref of contributions.referenceImages || []) {
            if (ref.url?.startsWith('data:')) {
                const match = ref.url.match(/^data:(.*?);base64,(.*)$/)
                if (match) {
                    elementReferenceImages.push({
                        base64: match[2],
                        mimeType: match[1],
                        description: ref.description,
                    })
                }
            }
        }

        const allReferenceImages = [...(refPayload.referenceImages || []), ...elementReferenceImages]

        return {
            prompt: promptString,
            mustFollowRules: contributions.mustFollow || [],
            freedomRules: contributions.freedom || [],
            referenceImages: allReferenceImages,
            labelInstruction: refPayload.labelInstruction,
            aspectRatio,
            aspectRatioDescription,
            faceComposite,
            bodyComposite,
            selfieComposite
        }
    }

    /**
     * Resolves the settings hierarchy: Package Defaults -> User Settings
     *
     * Package's defaultSettings is the source of truth. It defines:
     * - All default values for all categories
     * - Which settings are predefined vs user-choice
     *
     * User settings are merged only for visible categories.
     */
    protected resolveEffectiveSettings(userSettings: PhotoStyleSettings): PhotoStyleSettings {
        const pkg = this.packageConfig

        // 1. Start with package defaults (the source of truth)
        const baseSettings: PhotoStyleSettings = {
            ...pkg.defaultSettings,
            presetId: userSettings.presetId || pkg.defaultPresetId || pkg.defaultSettings.presetId,
        }

        // 2. Merge user settings for visible categories only
        return mergeUserSettings(
            baseSettings,
            userSettings,
            pkg.visibleCategories
        )
    }

    /**
     * Fill missing clothing color fields when the user provided a partial palette.
     *
     * Notes:
     * - Only runs when at least one clothing color is explicitly set.
     * - Skips `source: 'outfit'` to avoid interfering with outfit-transfer matching.
     * - Uses package defaults first, then shared fallbacks matching UI behavior.
     */
    protected hydratePartialClothingColors(settings: PhotoStyleSettings): void {
        if (!settings.clothingColors || !hasValue(settings.clothingColors)) {
            return
        }

        const current = settings.clothingColors.value
        const source = current.source
        if (source === 'outfit') {
            return
        }

        const hasAnyExplicitColor = Boolean(
            current.topLayer ||
            current.baseLayer ||
            current.bottom ||
            current.shoes
        )
        if (!hasAnyExplicitColor) {
            return
        }

        const pkgDefaults = this.packageConfig.defaultSettings.clothingColors
        const defaultColors = pkgDefaults && hasValue(pkgDefaults) ? pkgDefaults.value : undefined

        const fallbackColors = {
            topLayer: '#2C3E50',
            baseLayer: '#F8F9FA',
            bottom: '#1A1A2E',
            shoes: '#2D2D2D',
        }

        const merged: ClothingColorValue = {
            ...current,
            topLayer: current.topLayer ?? defaultColors?.topLayer ?? fallbackColors.topLayer,
            baseLayer: current.baseLayer ?? defaultColors?.baseLayer ?? fallbackColors.baseLayer,
            bottom: current.bottom ?? defaultColors?.bottom ?? fallbackColors.bottom,
            shoes: current.shoes ?? defaultColors?.shoes ?? fallbackColors.shoes,
        }

        const changed =
            merged.topLayer !== current.topLayer ||
            merged.baseLayer !== current.baseLayer ||
            merged.bottom !== current.bottom ||
            merged.shoes !== current.shoes

        if (!changed) {
            return
        }

        settings.clothingColors = {
            ...settings.clothingColors,
            value: merged,
        }
    }

    /**
     * Override this to inject specific settings (like Film Type) before processing.
     */
    protected customizeSettings(settings: PhotoStyleSettings): void {
        // No-op by default
    }

    /**
     * Override this to modify the final JSON payload before it's stringified.
     * Useful for manual injections if absolutely necessary (e.g. legacy wardrobe).
     */
    protected modifyFinalPayload(payload: Record<string, unknown>, settings: PhotoStyleSettings): Record<string, unknown> {
        return payload
    }
}
